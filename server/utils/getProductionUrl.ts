/**
 * Get base URL for user-facing URLs (activation links, etc.)
 * Priority:
 * 1. Production deployment: Use PRODUCTION_DOMAIN (custom domain like meetdup.com)
 * 2. Production deployment fallback: REPLIT_DEPLOYMENT_DOMAIN or hardcoded meetdup.com
 * 3. Development mode: Use REPLIT_DEV_DOMAIN
 * 4. localhost:5000 (local development fallback)
 * 
 * Note: REPLIT_DEPLOYMENT=1 is set by Replit when app is deployed (most reliable detection)
 * REPLIT_DEV_DOMAIN is NOT available in deployments per Replit docs, but may be set as secret
 */
export function getProductionBaseUrl(): string {
  // Check if we're in production deployment using REPLIT_DEPLOYMENT flag
  // This is the most reliable way per Replit documentation
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production";
  
  if (isProduction) {
    // In production/deployment mode - PRODUCTION_DOMAIN takes priority
    // This ensures custom domain (meetdup.com) is used for user-facing URLs
    if (process.env.PRODUCTION_DOMAIN) {
      return `https://${process.env.PRODUCTION_DOMAIN}`;
    }
    // Fallback to deployment domain if no custom domain configured
    if (process.env.REPLIT_DEPLOYMENT_DOMAIN) {
      return `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`;
    }
    // Hardcoded production fallback
    return "https://meetdup.com";
  }
  
  // Development mode - use dev domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
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
