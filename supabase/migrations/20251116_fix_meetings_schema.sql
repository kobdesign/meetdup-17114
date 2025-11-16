-- Fix meetings table schema to match TypeScript types
-- Add missing columns and rename location columns

-- Add description column
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add location_details column  
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS location_details TEXT;

-- Rename venue_lat to location_lat
ALTER TABLE meetings 
RENAME COLUMN venue_lat TO location_lat;

-- Rename venue_lng to location_lng
ALTER TABLE meetings
RENAME COLUMN venue_lng TO location_lng;

-- Add comment for clarity
COMMENT ON COLUMN meetings.description IS 'Meeting description/agenda';
COMMENT ON COLUMN meetings.location_details IS 'Additional location details';
COMMENT ON COLUMN meetings.location_lat IS 'Location latitude coordinate';
COMMENT ON COLUMN meetings.location_lng IS 'Location longitude coordinate';
