/**
 * Get base URL for user-facing URLs (activation links, etc.)
 * Priority:
 * 1. Development mode: Use REPLIT_DEV_DOMAIN if in dev (NOT in deployment)
 * 2. Production mode: Use PRODUCTION_DOMAIN (custom domain like meetdup.com)
 * 3. Fallback: REPLIT_DEPLOYMENT_DOMAIN (Replit autoscale deployment without custom domain)
 * 4. NODE_ENV=production -> meetdup.com (production fallback)
 * 5. localhost:5000 (local development fallback)
 * 
 * Note: Dev mode is detected when REPLIT_DEV_DOMAIN exists but REPLIT_DEPLOYMENT_DOMAIN does not
 */
export function getProductionBaseUrl(): string {
  // In dev mode (has dev domain but NOT deployment domain), use dev URL
  // This ensures testing via LINE webhook uses the correct dev endpoint
  const isDevMode = process.env.REPLIT_DEV_DOMAIN && !process.env.REPLIT_DEPLOYMENT_DOMAIN;
  
  if (isDevMode) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // In production/deployment mode - PRODUCTION_DOMAIN takes priority over deployment domain
  // This ensures custom domain (meetdup.com) is used for user-facing URLs
  if (process.env.PRODUCTION_DOMAIN) {
    return `https://${process.env.PRODUCTION_DOMAIN}`;
  }
  // Fallback to deployment domain if no custom domain configured
  if (process.env.REPLIT_DEPLOYMENT_DOMAIN) {
    return `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`;
  }
  // In production mode without other vars, use production domain
  if (process.env.NODE_ENV === "production") {
    return "https://meetdup.com";
  }
  // Local development fallback
  return "http://localhost:5000";
}

/**
 * Get base URL for internal API calls (server-to-server)
 * Uses Replit deployment domain which is resolvable from within the container
 * Priority:
 * 1. REPLIT_DEPLOYMENT_DOMAIN (Replit autoscale deployment - resolvable from container)
 * 2. REPLIT_DEV_DOMAIN (Replit development environment)
 * 3. localhost:5000 (local development fallback)
 * 
 * NOTE: Custom domains like meetdup.com are NOT used here because
 * they may not be resolvable from within the Replit container (DNS issue)
 */
export function getInternalApiBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_DOMAIN) {
    return `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // Local development fallback
  return "http://localhost:5000";
}
