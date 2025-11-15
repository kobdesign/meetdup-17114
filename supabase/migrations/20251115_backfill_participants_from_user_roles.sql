-- Migration: Backfill participants table for existing users
-- Date: 2025-11-15
-- Description: Create participant records for users who have user_roles but no participant record

-- This handles the case where users joined before the unified approach was implemented

DO $$
DECLARE
  role_record RECORD;
  profile_record RECORD;
  auth_email TEXT;
  full_name_value TEXT;
  email_value TEXT;
  phone_value TEXT;
  status_value TEXT;
BEGIN
  -- Loop through all user_roles that don't have a matching participant
  FOR role_record IN
    SELECT ur.user_id, ur.tenant_id, ur.role
    FROM user_roles ur
    LEFT JOIN participants p ON p.user_id = ur.user_id AND p.tenant_id = ur.tenant_id
    WHERE p.participant_id IS NULL
      AND ur.tenant_id IS NOT NULL  -- Skip super admin roles
  LOOP
    -- Get profile data if exists
    SELECT full_name, phone INTO profile_record
    FROM profiles
    WHERE id = role_record.user_id;

    -- Get auth email (we can't directly query auth.users from SQL, 
    -- so we'll use email from profiles or set a placeholder)
    -- In production, this would ideally be done via a Supabase function
    
    -- Set full_name with fallback chain
    full_name_value := COALESCE(
      profile_record.full_name,
      'Member - ' || SUBSTRING(role_record.user_id::TEXT, 1, 8)
    );
    
    -- Set phone with fallback
    phone_value := profile_record.phone;
    
    -- We can't get email from auth.users directly in SQL
    -- This will be NULL and should be updated by the syncUserToParticipants function
    email_value := NULL;
    
    -- Determine status based on role
    status_value := CASE 
      WHEN role_record.role IN ('chapter_admin', 'member') THEN 'member'
      ELSE 'prospect'
    END;

    -- Insert participant record
    INSERT INTO participants (
      user_id,
      tenant_id,
      full_name,
      email,
      phone,
      status,
      joined_date
    ) VALUES (
      role_record.user_id,
      role_record.tenant_id,
      full_name_value,
      email_value,
      phone_value,
      status_value,
      CASE 
        WHEN status_value = 'member' THEN NOW()
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, tenant_id) 
    DO NOTHING;  -- Skip if somehow already exists
    
  END LOOP;
  
  RAISE NOTICE 'Backfill completed. Check participants table for new records.';
END $$;

-- Add a comment for audit trail
COMMENT ON TABLE participants IS 'Updated 2025-11-15: Backfilled existing user_roles to participants with unified approach';
