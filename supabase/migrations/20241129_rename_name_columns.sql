-- Migration: Simplify name structure from separate first/last names to full names
-- Date: 2024-11-29
-- Description: 
--   - Rename full_name → full_name_th
--   - Add full_name_en column
--   - Drop separated name columns (first_name_th, last_name_th, first_name_en, last_name_en)
--   - Keep nickname, nickname_th, nickname_en

-- Step 1: Rename full_name to full_name_th
ALTER TABLE participants RENAME COLUMN full_name TO full_name_th;

-- Step 2: Add full_name_en column (optional field for English name)
ALTER TABLE participants ADD COLUMN IF NOT EXISTS full_name_en TEXT;

-- Step 3: Drop the separated name columns (since no data exists)
ALTER TABLE participants DROP COLUMN IF EXISTS first_name_th;
ALTER TABLE participants DROP COLUMN IF EXISTS last_name_th;
ALTER TABLE participants DROP COLUMN IF EXISTS first_name_en;
ALTER TABLE participants DROP COLUMN IF EXISTS last_name_en;

-- Step 4: Update any views or indexes if needed (optional)
-- CREATE INDEX IF NOT EXISTS idx_participants_full_name_th ON participants(full_name_th);

-- Verification query (run after migration):
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'participants' AND column_name LIKE '%name%';
