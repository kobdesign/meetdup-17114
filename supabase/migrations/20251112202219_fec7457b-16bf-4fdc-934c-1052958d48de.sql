-- Add line_user_id column to participants table for LINE account binding
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS line_user_id text;

-- Create index for faster lookups by line_user_id
CREATE INDEX IF NOT EXISTS idx_participants_line_user_id 
ON public.participants(line_user_id) 
WHERE line_user_id IS NOT NULL;

-- Add unique constraint to prevent duplicate LINE user bindings per tenant
ALTER TABLE public.participants
ADD CONSTRAINT unique_tenant_line_user 
UNIQUE (tenant_id, line_user_id);