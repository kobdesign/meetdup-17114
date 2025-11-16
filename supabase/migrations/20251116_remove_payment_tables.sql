-- Remove payment module tables
-- This migration removes all payment-related tables from the database
-- as the payment processing feature has been completely removed from the system

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS refund_requests CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- Reload Supabase schema cache to clear metadata for dropped tables
NOTIFY pgrst, 'reload schema';

-- Note: This migration was created after the tables were already dropped via SQL commands
-- It serves as documentation and ensures consistency across deployments
