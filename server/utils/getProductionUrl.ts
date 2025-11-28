/**
 * Get production base URL for the application
 * Priority:
 * 1. PRODUCTION_DOMAIN env var (custom domain)
 * 2. REPLIT_DEPLOYMENT_DOMAIN (Replit deployment)
 * 3. REPLIT_DEV_DOMAIN (development)
 * 4. Fallback to meetdup.com (production domain)
 */
export function getProductionBaseUrl(): string {
  if (process.env.PRODUCTION_DOMAIN) {
    return `https://${process.env.PRODUCTION_DOMAIN}`;
  }
  if (process.env.REPLIT_DEPLOYMENT_DOMAIN) {
    return `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "https://meetdup.com";
}
