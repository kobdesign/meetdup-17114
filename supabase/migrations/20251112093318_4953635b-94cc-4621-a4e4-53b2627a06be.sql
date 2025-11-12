-- Add recurring meeting fields and location details to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS recurrence_pattern text CHECK (recurrence_pattern IN ('none', 'daily', 'weekly', 'monthly', 'yearly', 'weekdays', 'custom')),
ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week text[], -- ['monday', 'tuesday', etc.]
ADD COLUMN IF NOT EXISTS location_details text,
ADD COLUMN IF NOT EXISTS location_lat numeric(10, 8),
ADD COLUMN IF NOT EXISTS location_lng numeric(11, 8),
ADD COLUMN IF NOT EXISTS meeting_time time;

-- Set default for existing records
UPDATE public.meetings 
SET recurrence_pattern = 'none' 
WHERE recurrence_pattern IS NULL;