-- Add payment slip storage bucket and policies

-- Create bucket for payment slips if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', false)
ON CONFLICT (id) DO NOTHING;

-- Allow chapter users to upload payment slips
CREATE POLICY "Chapter users can upload payment slips"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-slips' AND
  EXISTS (
    SELECT 1 FROM public.payments
    WHERE payments.payment_id::text = (storage.foldername(name))[1]
  )
);

-- Allow chapter users to view their payment slips
CREATE POLICY "Chapter users can view their payment slips"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-slips' AND
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.payment_id::text = (storage.foldername(name))[1]
    AND has_tenant_access(auth.uid(), p.tenant_id)
  )
);

-- Add slip_url column to payments table to store payment slip image
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS slip_url text;