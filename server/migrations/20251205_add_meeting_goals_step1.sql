-- Migration Step 1: Add Meeting Goal Enum Types
-- RUN THIS FIRST and wait for it to commit before running step 2

-- Add new metric types for meeting-based goals
ALTER TYPE goal_metric_type ADD VALUE IF NOT EXISTS 'meeting_visitors';
ALTER TYPE goal_metric_type ADD VALUE IF NOT EXISTS 'meeting_checkins';

-- NOTE: After running this script, you MUST commit (or close the query editor)
-- before running step 2. PostgreSQL requires new enum values to be committed
-- before they can be used in INSERT statements.
