import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Normalizes phone number by removing all non-digit characters
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Auto-link user account to participant record based on phone number match
 * Used during registration to automatically connect user_id to existing participant
 */
export async function linkUserToParticipant(
  supabase: SupabaseClient,
  userId: string,
  phone: string,
  tenantId: string
): Promise<{ success: boolean; participantId?: string; error?: string }> {
  try {
    const normalizedPhone = normalizePhone(phone);
    
    if (!normalizedPhone || normalizedPhone.length < 9) {
      return { success: false, error: 'Invalid phone number' };
    }

    // Find participant with matching phone in this tenant
    const { data: participant, error: findError } = await supabase
      .from('participants')
      .select('participant_id, user_id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('phone', normalizedPhone)
      .single();

    if (findError || !participant) {
      return { success: false, error: 'No matching participant found' };
    }

    // Check if already linked to another user
    if (participant.user_id && participant.user_id !== userId) {
      return { 
        success: false, 
        error: 'This phone number is already linked to another account' 
      };
    }

    // Check if already linked to this user
    if (participant.user_id === userId) {
      return { 
        success: true, 
        participantId: participant.participant_id 
      };
    }

    // Link the user to participant
    const { error: updateError } = await supabase
      .from('participants')
      .update({ user_id: userId })
      .eq('participant_id', participant.participant_id);

    if (updateError) {
      return { success: false, error: 'Failed to link account' };
    }

    // Also ensure user_roles exists
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: 'member',
      }, {
        onConflict: 'user_id,tenant_id',
      });

    if (roleError) {
      console.error('Failed to create user_role:', roleError);
      // Don't fail the whole operation if user_role creation fails
    }

    return { 
      success: true, 
      participantId: participant.participant_id 
    };
  } catch (error) {
    console.error('Error in linkUserToParticipant:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Generate unique activation token
 */
export function generateActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create activation token for a participant
 */
export async function createActivationToken(
  supabase: SupabaseClient,
  participantId: string,
  tenantId: string,
  createdBy: string,
  expiresInDays: number = 7
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const token = generateActivationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { error } = await supabase
      .from('activation_tokens')
      .insert({
        token,
        participant_id: participantId,
        tenant_id: tenantId,
        expires_at: expiresAt.toISOString(),
        created_by: createdBy,
      });

    if (error) {
      console.error('Error creating activation token:', error);
      return { success: false, error: 'Failed to create activation token' };
    }

    return { success: true, token };
  } catch (error) {
    console.error('Error in createActivationToken:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Validate and consume activation token
 */
export async function validateActivationToken(
  supabase: SupabaseClient,
  token: string
): Promise<{
  success: boolean;
  participant?: any;
  tenantId?: string;
  error?: string;
}> {
  try {
    // Find the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('activation_tokens')
      .select(`
        token_id,
        participant_id,
        tenant_id,
        expires_at,
        used_at,
        participants (
          participant_id,
          first_name,
          last_name,
          phone,
          email,
          user_id
        )
      `)
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return { success: false, error: 'Invalid activation link' };
    }

    // Check if already used
    if (tokenData.used_at) {
      return { success: false, error: 'This activation link has already been used' };
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return { success: false, error: 'This activation link has expired' };
    }

    const participant = Array.isArray(tokenData.participants) 
      ? tokenData.participants[0] 
      : tokenData.participants;

    // Check if participant already has a user account
    if (participant?.user_id) {
      return { 
        success: false, 
        error: 'This account has already been activated' 
      };
    }

    return {
      success: true,
      participant: participant,
      tenantId: tokenData.tenant_id,
    };
  } catch (error) {
    console.error('Error in validateActivationToken:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Mark activation token as used
 */
export async function markTokenAsUsed(
  supabase: SupabaseClient,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('activation_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      return { success: false, error: 'Failed to mark token as used' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markTokenAsUsed:', error);
    return { success: false, error: 'Internal error' };
  }
}
