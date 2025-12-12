import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabaseAdmin } from "./supabaseClient";

const TOKEN_SECRET = process.env.CHECKIN_TOKEN_SECRET || process.env.PROFILE_TOKEN_SECRET || "meetdup-checkin-secret-change-in-production";
const TOKEN_EXPIRY = "15m";
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

export interface CheckinTokenPayload {
  participant_id: string;
  tenant_id: string;
  type: "pos_checkin";
  nonce: string;
  iat: number;
  exp: number;
}

export function generateCheckinToken(participant_id: string, tenant_id: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  
  const payload = {
    participant_id,
    tenant_id,
    type: "pos_checkin",
    nonce
  };

  return jwt.sign(payload, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyCheckinToken(token: string): CheckinTokenPayload | null {
  try {
    const decoded = jwt.verify(token, TOKEN_SECRET) as CheckinTokenPayload;
    
    if (decoded.type !== "pos_checkin") {
      console.error("[CheckinToken] Invalid token type:", decoded.type);
      return null;
    }

    return decoded;
  } catch (error: any) {
    console.error("[CheckinToken] Token verification failed:", error.message);
    return null;
  }
}

export async function consumeCheckinTokenAsync(token: string): Promise<CheckinTokenPayload | null> {
  const decoded = verifyCheckinToken(token);
  if (!decoded) return null;
  
  try {
    // Check if nonce already used (persistent database check)
    const { data: existingNonce, error: checkError } = await supabaseAdmin
      .from("used_checkin_tokens")
      .select("nonce")
      .eq("nonce", decoded.nonce)
      .single();
    
    if (existingNonce) {
      console.error("[CheckinToken] Token already used (nonce replay):", decoded.nonce);
      return null;
    }
    
    // Mark nonce as used with expiry timestamp
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
    const { error: insertError } = await supabaseAdmin
      .from("used_checkin_tokens")
      .insert({
        nonce: decoded.nonce,
        participant_id: decoded.participant_id,
        tenant_id: decoded.tenant_id,
        expires_at: expiresAt
      });
    
    if (insertError) {
      // If unique constraint violation, token was already used (race condition)
      if (insertError.code === "23505") {
        console.error("[CheckinToken] Token already used (race condition):", decoded.nonce);
        return null;
      }
      console.error("[CheckinToken] Failed to mark token as used:", insertError);
      return null;
    }
    
    return decoded;
  } catch (error: any) {
    console.error("[CheckinToken] Error consuming token:", error);
    return null;
  }
}

// Cleanup expired tokens (can be called periodically or via cron)
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .from("used_checkin_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("nonce");
    
    if (error) {
      console.error("[CheckinToken] Cleanup error:", error);
      return 0;
    }
    
    return data?.length || 0;
  } catch (error) {
    console.error("[CheckinToken] Cleanup failed:", error);
    return 0;
  }
}
