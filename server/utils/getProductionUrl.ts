/**
 * Get base URL for the application
 * Priority:
 * 1. PRODUCTION_DOMAIN env var (custom domain for production)
 * 2. REPLIT_DEPLOYMENT_DOMAIN (Replit autoscale deployment)
 * 3. REPLIT_DEV_DOMAIN (Replit development environment)
 * 4. NODE_ENV=production -> meetdup.com (production fallback)
 * 5. localhost:5000 (local development fallback)
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
  // In production mode without other vars, use production domain
  if (process.env.NODE_ENV === "production") {
    return "https://meetdup.com";
  }
  // Local development fallback
  return "http://localhost:5000";
}
