-- Step 1: เพิ่ม temporary column สำหรับ participants
ALTER TABLE participants ADD COLUMN IF NOT EXISTS new_status text;

-- Step 2: Map existing statuses → new 5 statuses
UPDATE participants SET new_status = 
  CASE 
    WHEN status::text = 'prospect' THEN 'prospect'
    WHEN status::text LIKE 'visitor%' THEN 'visitor'
    WHEN status::text LIKE 'member%' THEN 'member'
    WHEN status::text = 'alumni' THEN 'alumni'
    ELSE 'prospect'
  END;

-- Step 3: Drop old column and enum
ALTER TABLE participants DROP COLUMN status;
DROP TYPE IF EXISTS participant_status CASCADE;

-- Step 4: Create new enum with 5 statuses
CREATE TYPE participant_status AS ENUM ('prospect', 'visitor', 'declined', 'member', 'alumni');

-- Step 5: Rename and convert column
ALTER TABLE participants RENAME COLUMN new_status TO status;
ALTER TABLE participants ALTER COLUMN status TYPE participant_status USING status::participant_status;
ALTER TABLE participants ALTER COLUMN status SET DEFAULT 'prospect';
ALTER TABLE participants ALTER COLUMN status SET NOT NULL;

-- Step 6: ลบ payment_status column จาก participants (ถ้ามี)
ALTER TABLE participants DROP COLUMN IF EXISTS payment_status;