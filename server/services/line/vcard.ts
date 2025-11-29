/**
 * vCard Generator
 * Creates .vcf files for easy contact saving
 * Spec: https://www.rfc-editor.org/rfc/rfc6350
 */

export interface VCardData {
  full_name_th: string;
  position?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  business_address?: string | null;
  photo_url?: string | null;
}

/**
 * Generate vCard 3.0 format string
 */
export function generateVCard(data: VCardData): string {
  const lines: string[] = [];
  
  // Start vCard
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  
  // Full Name (required)
  lines.push(`FN:${escapeVCardValue(data.full_name_th)}`);
  
  // Structured Name (N:LastName;FirstName;MiddleName;Prefix;Suffix)
  // For Thai names, we'll use full name as both first and last
  const nameParts = data.full_name_th.split(" ");
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : data.full_name_th;
  lines.push(`N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`);
  
  // Organization and Title
  if (data.company || data.position) {
    const org = data.company || "";
    lines.push(`ORG:${escapeVCardValue(org)}`);
  }
  
  if (data.position) {
    lines.push(`TITLE:${escapeVCardValue(data.position)}`);
  }
  
  // Email
  if (data.email) {
    lines.push(`EMAIL;TYPE=WORK,INTERNET:${escapeVCardValue(data.email)}`);
  }
  
  // Phone
  if (data.phone) {
    // Clean phone number (remove spaces, dashes, parentheses)
    const cleanPhone = data.phone.replace(/[^0-9+]/g, "");
    lines.push(`TEL;TYPE=WORK,VOICE:${cleanPhone}`);
  }
  
  // Website
  if (data.website_url) {
    lines.push(`URL:${escapeVCardValue(data.website_url)}`);
  }
  
  // Business Address
  if (data.business_address) {
    // ADR:PO Box;Extended Address;Street;City;State;Postal Code;Country
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(data.business_address)};;;;Thailand`);
  }
  
  // Photo URL
  if (data.photo_url) {
    lines.push(`PHOTO;VALUE=URL:${escapeVCardValue(data.photo_url)}`);
  }
  
  // End vCard
  lines.push("END:VCARD");
  
  return lines.join("\r\n");
}

/**
 * Escape special characters in vCard values
 */
function escapeVCardValue(value: string): string {
  if (!value) return "";
  
  return value
    .replace(/\\/g, "\\\\")  // Backslash
    .replace(/;/g, "\\;")    // Semicolon
    .replace(/,/g, "\\,")    // Comma
    .replace(/\n/g, "\\n");  // Newline
}

/**
 * Get vCard filename from participant name
 */
export function getVCardFilename(fullName: string): string {
  // Replace spaces and special chars with underscores
  const safeName = fullName
    .replace(/[^a-zA-Z0-9ก-๙\s]/g, "")
    .replace(/\s+/g, "_");
  
  return `${safeName}.vcf`;
}
