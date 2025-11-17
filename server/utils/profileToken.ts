import jwt from "jsonwebtoken";

const TOKEN_SECRET = process.env.PROFILE_TOKEN_SECRET || "meetdup-profile-secret-change-in-production";
const TOKEN_EXPIRY = "24h"; // 24 hours

export interface ProfileTokenPayload {
  participant_id: string;
  tenant_id: string;
  type: "profile_edit";
}

/**
 * Generate a temporary token for participant to edit their profile
 */
export function generateProfileToken(participant_id: string, tenant_id: string): string {
  const payload: ProfileTokenPayload = {
    participant_id,
    tenant_id,
    type: "profile_edit",
  };

  return jwt.sign(payload, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode profile token
 */
export function verifyProfileToken(token: string): ProfileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, TOKEN_SECRET) as ProfileTokenPayload;
    
    // Verify token type
    if (decoded.type !== "profile_edit") {
      console.error("[ProfileToken] Invalid token type:", decoded.type);
      return null;
    }

    return decoded;
  } catch (error: any) {
    console.error("[ProfileToken] Token verification failed:", error.message);
    return null;
  }
}
