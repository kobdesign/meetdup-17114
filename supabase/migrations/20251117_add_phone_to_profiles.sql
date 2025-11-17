-- Add phone column to profiles table
-- This allows users to store their phone number in their profile

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone text;

-- Create index for phone lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Add comment
COMMENT ON COLUMN profiles.phone IS 'User phone number for contact purposes';
