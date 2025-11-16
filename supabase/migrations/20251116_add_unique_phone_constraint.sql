-- Add unique constraint for phone number per tenant
-- This ensures one phone number can only be used once within a tenant
-- Allows same phone across different tenants (multi-tenancy)

ALTER TABLE participants
ADD CONSTRAINT unique_phone_per_tenant 
UNIQUE (tenant_id, phone);

-- Create index for faster phone lookup
CREATE INDEX idx_participants_phone_lookup 
ON participants(tenant_id, phone)
WHERE phone IS NOT NULL;

COMMENT ON CONSTRAINT unique_phone_per_tenant ON participants IS 
'Ensures phone number uniqueness within a tenant. Phone number is the primary identifier for check-in flow.';
