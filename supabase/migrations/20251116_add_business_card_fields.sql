-- Add business card fields to participants table
-- These fields support LINE Business Card feature

ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;

-- Add comments for documentation
COMMENT ON COLUMN participants.photo_url IS 'Profile photo URL for business card';
COMMENT ON COLUMN participants.website_url IS 'Personal or company website URL';
COMMENT ON COLUMN participants.business_address IS 'Business or office address';
COMMENT ON COLUMN participants.facebook_url IS 'Facebook profile or page URL';
COMMENT ON COLUMN participants.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN participants.tagline IS 'Personal tagline or motto for business card';
COMMENT ON COLUMN participants.position IS 'Job title or position in company';
