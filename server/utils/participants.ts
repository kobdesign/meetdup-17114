import { supabaseAdmin } from "./supabaseClient";

// Define types locally to avoid cross-boundary imports
type AppRole = 'super_admin' | 'chapter_admin' | 'member';
type ParticipantStatus = 'prospect' | 'visitor' | 'member' | 'not_following' | 'declined';

interface SyncParticipantParams {
  user_id: string;
  tenant_id: string;
  role: AppRole;
}

/**
 * Sync user to participants table after they join a chapter
 * Creates or updates participant record with data from profiles/auth
 * 
 * @param params - user_id, tenant_id, and role from user_roles
 * @returns Success or error object
 */
export async function syncUserToParticipants(params: SyncParticipantParams) {
  const { user_id, tenant_id, role } = params;

  try {
    // Step 1: Fetch profile data
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user_id)
      .maybeSingle();

    // Step 2: Fetch auth user data as fallback
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    // Log warning if auth fetch fails (but don't fail the whole operation)
    if (authError) {
      console.warn(`[syncUserToParticipants] Failed to fetch auth user ${user_id}:`, authError.message);
    }
    
    // Step 3: Extract data with fallback chain: profile → auth.user_metadata → auth.email → placeholder
    const full_name = 
      profile?.full_name || 
      authUser?.user?.user_metadata?.full_name || 
      authUser?.user?.email?.split('@')[0] || 
      'ไม่ระบุชื่อ';
    
    const email = authUser?.user?.email || null;
    const phone = profile?.phone || authUser?.user?.user_metadata?.phone || null;

    // Step 4: Determine participant status based on role
    // chapter_admin and member both become 'member' status in participants
    const status: ParticipantStatus = (role === 'chapter_admin' || role === 'member') ? 'member' : 'prospect';

    // Step 5: Check if participant already exists
    const { data: existingParticipant } = await supabaseAdmin
      .from("participants")
      .select("participant_id, status, joined_date, user_id")
      .eq("user_id", user_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existingParticipant) {
      // Update existing participant
      // Only set joined_date if transitioning to member and it wasn't set before
      const shouldSetJoinedDate = 
        status === 'member' && 
        existingParticipant.status !== 'member' && 
        !existingParticipant.joined_date;

      const { error: updateError } = await supabaseAdmin
        .from("participants")
        .update({
          full_name,
          email,
          phone,
          status,
          ...(shouldSetJoinedDate && { joined_date: new Date().toISOString() }),
        })
        .eq("participant_id", existingParticipant.participant_id);

      if (updateError) {
        console.error("Error updating participant:", updateError);
        return { success: false, error: updateError.message };
      }

      return { 
        success: true, 
        participant_id: existingParticipant.participant_id,
        action: 'updated'
      };

    } else {
      // Create new participant
      const { data: newParticipant, error: insertError } = await supabaseAdmin
        .from("participants")
        .insert({
          user_id,
          tenant_id,
          full_name,
          email,
          phone,
          status,
          // Set joined_date immediately for members (chapter_admin or member)
          joined_date: status === 'member' ? new Date().toISOString() : null,
        })
        .select("participant_id")
        .single();

      if (insertError) {
        console.error("Error creating participant:", insertError);
        return { success: false, error: insertError.message };
      }

      return { 
        success: true, 
        participant_id: newParticipant.participant_id,
        action: 'created'
      };
    }

  } catch (error: any) {
    console.error("Participant sync error:", error);
    return { success: false, error: error.message };
  }
}
