/**
 * URL Validator for LINE Flex Messages
 * Ensures only safe URL schemes are allowed
 */

const ALLOWED_SCHEMES = ["http:", "https:", "tel:", "mailto:", "line:"];

/**
 * Validate and sanitize URL for LINE Flex Messages
 * Prevents javascript:, data:, and other dangerous schemes
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  
  if (trimmed.length === 0) {
    return null;
  }

  try {
    // For relative URLs or URLs without protocol, assume https://
    let fullUrl = trimmed;
    if (!trimmed.includes("://") && !trimmed.startsWith("tel:") && !trimmed.startsWith("mailto:") && !trimmed.startsWith("line:")) {
      fullUrl = `https://${trimmed}`;
    }

    const parsed = new URL(fullUrl);
    
    // Check if scheme is allowed
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      console.warn(`[URLValidator] Blocked dangerous URL scheme: ${parsed.protocol}`);
      return null;
    }

    return parsed.toString();
  } catch (error) {
    console.error(`[URLValidator] Invalid URL: ${trimmed}`, error);
    return null;
  }
}

/**
 * Validate phone number for tel: links
 */
export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters except + (for country code)
  const cleaned = phone.replace(/[^0-9+]/g, "");
  
  if (cleaned.length === 0) return null;
  
  return `tel:${cleaned}`;
}

/**
 * Validate email for mailto: links
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  const trimmed = email.trim();
  
  // Basic email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return null;
  }
  
  return `mailto:${trimmed}`;
}

/**
 * Validate LINE ID and create LINE profile URL
 * LINE ID should be a bare username (e.g., "mylineid" or "@mylineid")
 * Returns null if:
 * - line_id is empty/null
 * - line_id already contains a URL scheme (http://, https://, line://)
 * - line_id contains invalid characters
 */
export function sanitizeLineId(lineId: string | null | undefined): string | null {
  if (!lineId || typeof lineId !== "string") {
    return null;
  }
  
  const trimmed = lineId.trim();
  
  if (trimmed.length === 0) {
    return null;
  }
  
  // If line_id already contains a URL scheme, it's not a valid LINE ID username
  if (trimmed.includes("://") || trimmed.startsWith("http") || trimmed.startsWith("line:")) {
    console.warn(`[URLValidator] LINE ID appears to be a URL, not a username: ${trimmed.substring(0, 30)}...`);
    return null;
  }
  
  // Remove @ prefix if present (LINE IDs can be entered with or without @)
  const username = trimmed.startsWith("@") ? trimmed.substring(1) : trimmed;
  
  // Basic validation: LINE IDs are alphanumeric with some special chars
  // Allow letters, numbers, dots, underscores, hyphens
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(username)) {
    console.warn(`[URLValidator] LINE ID contains invalid characters: ${username}`);
    return null;
  }
  
  // Create the LINE profile URL
  return `https://line.me/ti/p/~${encodeURIComponent(username)}`;
}
