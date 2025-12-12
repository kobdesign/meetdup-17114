import jwt from "jsonwebtoken";

const TOKEN_SECRET = process.env.PROFILE_TOKEN_SECRET || "meetdup-profile-secret-change-in-production";
const TOKEN_EXPIRY = "24h"; // 24 hours

export type TokenType = "profile_edit" | "substitute_request";

export interface ProfileTokenPayload {
  participant_id: string;
  tenant_id: string;
  type: TokenType;
  meeting_id?: string; // For substitute requests
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
 * Generate a temporary token for substitute request
 */
export function generateSubstituteToken(participant_id: string, tenant_id: string, meeting_id: string): string {
  const payload: ProfileTokenPayload = {
    participant_id,
    tenant_id,
    type: "substitute_request",
    meeting_id,
  };

  return jwt.sign(payload, TOKEN_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode profile token (supports both profile_edit and substitute_request)
 */
export function verifyProfileToken(token: string, expectedType?: TokenType): ProfileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, TOKEN_SECRET) as ProfileTokenPayload;
    
    // Verify token type if specified
    if (expectedType && decoded.type !== expectedType) {
      console.error("[ProfileToken] Invalid token type:", decoded.type, "expected:", expectedType);
      return null;
    }
    
    // Validate type is one of the allowed types
    if (decoded.type !== "profile_edit" && decoded.type !== "substitute_request") {
      console.error("[ProfileToken] Unknown token type:", decoded.type);
      return null;
    }

    return decoded;
  } catch (error: any) {
    console.error("[ProfileToken] Token verification failed:", error.message);
    return null;
  }
}
