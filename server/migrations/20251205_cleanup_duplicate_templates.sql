-- Cleanup Script: Remove duplicate goal templates
-- Run this on Supabase SQL Editor to fix duplicate templates issue

-- Step 1: Delete duplicates (keep only the first entry for each metric_type)
DELETE FROM goal_templates 
WHERE template_id NOT IN (
  SELECT MIN(template_id) 
  FROM goal_templates 
  GROUP BY metric_type
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE goal_templates 
ADD CONSTRAINT goal_templates_metric_type_unique UNIQUE (metric_type);

-- Step 3: Verify the result
SELECT template_id, metric_type, name_th, sort_order 
FROM goal_templates 
ORDER BY sort_order;
