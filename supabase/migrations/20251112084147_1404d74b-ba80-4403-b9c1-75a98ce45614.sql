-- Add notes column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS notes TEXT;