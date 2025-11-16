-- ========================================
-- CLEAR ALL DATA (ลบข้อมูลทั้งหมดออก)
-- ========================================
-- คำเตือน: SQL script นี้จะลบข้อมูลทั้งหมดและสร้าง Mock Data ใหม่
-- โปรด BACKUP ข้อมูลก่อนรัน!

-- Delete in order (respect foreign key constraints)
DELETE FROM checkins;
DELETE FROM meeting_registrations;
DELETE FROM participants;
DELETE FROM meetings;

-- ========================================
-- MOCK DATA - MEETINGS
-- ========================================
-- สร้าง 5 การประชุม (ผ่านมา 2, วันนี้ 1, อนาคต 2)

-- ดึง tenant_id แรกที่มีใน database (สมมติว่ามี 1 tenant)
DO $$
DECLARE
  v_tenant_id VARCHAR;
  v_meeting_past_1 VARCHAR;
  v_meeting_past_2 VARCHAR;
  v_meeting_today VARCHAR;
  v_meeting_future_1 VARCHAR;
  v_meeting_future_2 VARCHAR;
  
  -- Participants IDs
  v_prospect_1 VARCHAR;
  v_prospect_2 VARCHAR;
  v_prospect_3 VARCHAR;
  v_visitor_1 VARCHAR;
  v_visitor_2 VARCHAR;
  v_visitor_3 VARCHAR;
  v_hotlead_1 VARCHAR;
  v_hotlead_2 VARCHAR;
  v_declined_1 VARCHAR;
  v_member_1 VARCHAR;
  v_member_2 VARCHAR;
  v_member_3 VARCHAR;
  v_alumni_1 VARCHAR;
  
BEGIN
  -- Get first tenant_id
  SELECT tenant_id INTO v_tenant_id FROM tenants LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found! Please create a tenant first.';
  END IF;
  
  RAISE NOTICE 'Using tenant_id: %', v_tenant_id;
  
  -- ========================================
  -- INSERT MEETINGS
  -- ========================================
  
  -- Meeting 1: Past (14 days ago)
  INSERT INTO meetings (
    tenant_id, meeting_date, meeting_time, venue, 
    location_lat, location_lng, theme, description, visitor_fee
  ) VALUES (
    v_tenant_id,
    CURRENT_DATE - INTERVAL '14 days',
    '07:00',
    'โรงแรมเซ็นทรัล แกรนด์ พลาซ่า ลาดพร้าว',
    13.8115,
    100.5606,
    'การสร้างเครือข่ายธุรกิจที่แข็งแกร่ง',
    '<p>หัวข้อพิเศษ: วิธีการสร้าง Referral ที่มีคุณภาพ</p>',
    500
  ) RETURNING meeting_id INTO v_meeting_past_1;
  
  -- Meeting 2: Past (7 days ago)
  INSERT INTO meetings (
    tenant_id, meeting_date, meeting_time, venue, 
    location_lat, location_lng, theme, description, visitor_fee
  ) VALUES (
    v_tenant_id,
    CURRENT_DATE - INTERVAL '7 days',
    '07:00',
    'โรงแรมเซ็นทรัล แกรนด์ พลาซ่า ลาดพร้าว',
    13.8115,
    100.5606,
    'กลยุทธ์การตลาดดิจิทัล 2025',
    '<p>วิทยากรพิเศษ: คุณสมชาย ใจดี - Digital Marketing Expert</p>',
    500
  ) RETURNING meeting_id INTO v_meeting_past_2;
  
  -- Meeting 3: Today
  INSERT INTO meetings (
    tenant_id, meeting_date, meeting_time, venue, 
    location_lat, location_lng, theme, description, visitor_fee
  ) VALUES (
    v_tenant_id,
    CURRENT_DATE,
    '07:00',
    'โรงแรมเซ็นทรัล แกรนด์ พลาซ่า ลาดพร้าว',
    13.8115,
    100.5606,
    'การนำเสนอธุรกิจแบบมืออาชีพ',
    '<p>เรียนรู้เทคนิคการนำเสนอที่ทรงพลัง ภายใน 60 วินาที</p>',
    500
  ) RETURNING meeting_id INTO v_meeting_today;
  
  -- Meeting 4: Future (7 days later)
  INSERT INTO meetings (
    tenant_id, meeting_date, meeting_time, venue, 
    location_lat, location_lng, theme, description, visitor_fee
  ) VALUES (
    v_tenant_id,
    CURRENT_DATE + INTERVAL '7 days',
    '07:00',
    'โรงแรมเซ็นทรัล แกรนด์ พลาซ่า ลาดพร้าว',
    13.8115,
    100.5606,
    'Building Trust in Business Relationships',
    '<p>How to build long-term trust with your clients and partners</p>',
    500
  ) RETURNING meeting_id INTO v_meeting_future_1;
  
  -- Meeting 5: Future (14 days later)
  INSERT INTO meetings (
    tenant_id, meeting_date, meeting_time, venue, 
    location_lat, location_lng, theme, description, visitor_fee
  ) VALUES (
    v_tenant_id,
    CURRENT_DATE + INTERVAL '14 days',
    '07:00',
    'โรงแรมเซ็นทรัล แกรนด์ พลาซ่า ลาดพร้าว',
    13.8115,
    100.5606,
    'Year-End Networking Celebration',
    '<p>Join us for our special year-end networking event!</p>',
    500
  ) RETURNING meeting_id INTO v_meeting_future_2;
  
  RAISE NOTICE 'Created 5 meetings';
  
  -- ========================================
  -- INSERT PARTICIPANTS - PROSPECTS (ลงทะเบียนแล้วยังไม่เช็คอิน)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, business_type, goal, status
  ) VALUES 
    (v_tenant_id, 'สมหญิง แสนดี', 'somying@example.com', '081-111-1111', 'ร้านกาแฟสดเมล็ดคัด', 'อาหารและเครื่องดื่ม', 'ต้องการหาลูกค้าใหม่และขยายธุรกิจ', 'prospect'),
    (v_tenant_id, 'ประยุทธ์ มั่นคง', 'prayuth@example.com', '081-222-2222', 'บริษัทประกันภัย ABC', 'ประกันภัย', 'สร้างเครือข่ายและเพิ่ม Referral', 'prospect'),
    (v_tenant_id, 'วิชัย เจริญธุรกิจ', 'wichai@example.com', '081-333-3333', 'IT Solutions Pro', 'เทคโนโลยี', 'หาพันธมิตรทางธุรกิจ', 'prospect')
  RETURNING participant_id INTO v_prospect_1, v_prospect_2, v_prospect_3;
  
  RAISE NOTICE 'Created 3 prospects';
  
  -- ========================================
  -- INSERT PARTICIPANTS - VISITORS (เช็คอินแล้ว 1-2 ครั้ง)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, business_type, goal, status, joined_date
  ) VALUES 
    (v_tenant_id, 'สุชาดา ธุรกิจดี', 'suchada@example.com', '082-111-1111', 'Studio Fitness & Spa', 'สุขภาพและความงาม', 'หาลูกค้าคุณภาพสูง', 'visitor', CURRENT_DATE - INTERVAL '14 days'),
    (v_tenant_id, 'ธนพล รุ่งเรือง', 'thanapol@example.com', '082-222-2222', 'Real Estate Excellence', 'อสังหาริมทรัพย์', 'สร้างเครือข่ายนักลงทุน', 'visitor', CURRENT_DATE - INTERVAL '14 days'),
    (v_tenant_id, 'นภัสสร สวยงาม', 'napat@example.com', '082-333-3333', 'Beauty Salon Premium', 'ความงาม', 'ขยายฐานลูกค้าระดับไฮเอนด์', 'visitor', CURRENT_DATE - INTERVAL '7 days')
  RETURNING participant_id INTO v_visitor_1, v_visitor_2, v_visitor_3;
  
  RAISE NOTICE 'Created 3 visitors';
  
  -- ========================================
  -- INSERT PARTICIPANTS - HOT LEADS (มาแล้ว 3+ ครั้ง, มี engagement สูง)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, business_type, goal, status, joined_date
  ) VALUES 
    (v_tenant_id, 'รัตนา ประสบการณ์', 'rattana@example.com', '083-111-1111', 'Marketing Agency Plus', 'การตลาด', 'สร้าง Network คุณภาพและ Referral ต่อเนื่อง', 'hot_lead', CURRENT_DATE - INTERVAL '21 days'),
    (v_tenant_id, 'ชัยวัฒน์ มีผล', 'chaiwat@example.com', '083-222-2222', 'Construction Solutions', 'ก่อสร้าง', 'หาพันธมิตรและโครงการใหม่', 'hot_lead', CURRENT_DATE - INTERVAL '21 days')
  RETURNING participant_id INTO v_hotlead_1, v_hotlead_2;
  
  RAISE NOTICE 'Created 2 hot leads';
  
  -- ========================================
  -- INSERT PARTICIPANTS - DECLINED (ไม่สนใจ)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, business_type, status, joined_date, notes
  ) VALUES 
    (v_tenant_id, 'ปรีชา เลิกสน', 'preecha@example.com', '084-111-1111', 'Old School Business', 'ค้าส่ง', 'declined', CURRENT_DATE - INTERVAL '30 days', 'ไม่สนใจเข้าร่วมในขณะนี้')
  RETURNING participant_id INTO v_declined_1;
  
  RAISE NOTICE 'Created 1 declined participant';
  
  -- ========================================
  -- INSERT PARTICIPANTS - MEMBERS (สมาชิกปัจจุบัน)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, business_type, goal, status, joined_date, user_id
  ) VALUES 
    (v_tenant_id, 'ดร.สมศักดิ์ ผู้นำ', 'somsak@example.com', '085-111-1111', 'Medical Center Excellence', 'การแพทย์', 'สร้างเครือข่ายและแนะนำผู้ป่วย', 'member', CURRENT_DATE - INTERVAL '180 days', NULL),
    (v_tenant_id, 'อรุณี ธุรการดี', 'arunee@example.com', '085-222-2222', 'Accounting & Tax Pro', 'บัญชีและภาษี', 'รับ Referral ลูกค้าคุณภาพ', 'member', CURRENT_DATE - INTERVAL '150 days', NULL),
    (v_tenant_id, 'พงษ์ศักดิ์ ช่างคิด', 'pongsak@example.com', '085-333-3333', 'Creative Design Studio', 'ออกแบบและโฆษณา', 'ขยายฐานลูกค้าองค์กร', 'member', CURRENT_DATE - INTERVAL '120 days', NULL)
  RETURNING participant_id INTO v_member_1, v_member_2, v_member_3;
  
  RAISE NOTICE 'Created 3 members';
  
  -- ========================================
  -- INSERT PARTICIPANTS - ALUMNI (อดีตสมาชิก)
  -- ========================================
  
  INSERT INTO participants (
    tenant_id, full_name, email, phone, company, status, joined_date, notes
  ) VALUES 
    (v_tenant_id, 'มานพ ย้ายไป', 'manop@example.com', '086-111-1111', 'Relocated Business', 'alumni', CURRENT_DATE - INTERVAL '365 days', 'ย้ายสาขาไปต่างจังหวัด')
  RETURNING participant_id INTO v_alumni_1;
  
  RAISE NOTICE 'Created 1 alumni';
  
  -- ========================================
  -- INSERT MEETING REGISTRATIONS
  -- ========================================
  
  -- Prospects registered for future meetings
  INSERT INTO meeting_registrations (participant_id, meeting_id, tenant_id, registration_status)
  VALUES 
    (v_prospect_1, v_meeting_future_1, v_tenant_id, 'registered'),
    (v_prospect_2, v_meeting_future_1, v_tenant_id, 'registered'),
    (v_prospect_3, v_meeting_future_2, v_tenant_id, 'registered');
  
  -- Visitors registered for past/today meetings
  INSERT INTO meeting_registrations (participant_id, meeting_id, tenant_id, registration_status)
  VALUES 
    (v_visitor_1, v_meeting_past_1, v_tenant_id, 'registered'),
    (v_visitor_2, v_meeting_past_1, v_tenant_id, 'registered'),
    (v_visitor_3, v_meeting_past_2, v_tenant_id, 'registered');
  
  -- Hot leads registered for multiple meetings
  INSERT INTO meeting_registrations (participant_id, meeting_id, tenant_id, registration_status)
  VALUES 
    (v_hotlead_1, v_meeting_past_1, v_tenant_id, 'registered'),
    (v_hotlead_1, v_meeting_past_2, v_tenant_id, 'registered'),
    (v_hotlead_1, v_meeting_today, v_tenant_id, 'registered'),
    (v_hotlead_2, v_meeting_past_1, v_tenant_id, 'registered'),
    (v_hotlead_2, v_meeting_past_2, v_tenant_id, 'registered'),
    (v_hotlead_2, v_meeting_today, v_tenant_id, 'registered');
  
  RAISE NOTICE 'Created meeting registrations';
  
  -- ========================================
  -- INSERT CHECK-INS
  -- ========================================
  
  -- Visitors: 1-2 check-ins
  INSERT INTO checkins (participant_id, meeting_id, tenant_id, checkin_time, status)
  VALUES 
    (v_visitor_1, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:05:00', 'present'),
    (v_visitor_2, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:10:00', 'present'),
    (v_visitor_3, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:08:00', 'present');
  
  -- Hot Leads: 3+ check-ins each
  INSERT INTO checkins (participant_id, meeting_id, tenant_id, checkin_time, status)
  VALUES 
    -- Hot Lead 1: 3 check-ins
    (v_hotlead_1, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '06:55:00', 'present'),
    (v_hotlead_1, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '06:58:00', 'present'),
    (v_hotlead_1, v_meeting_today, v_tenant_id, CURRENT_TIMESTAMP - INTERVAL '1 hour', 'present'),
    -- Hot Lead 2: 3 check-ins
    (v_hotlead_2, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:02:00', 'present'),
    (v_hotlead_2, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:05:00', 'present'),
    (v_hotlead_2, v_meeting_today, v_tenant_id, CURRENT_TIMESTAMP - INTERVAL '50 minutes', 'present');
  
  -- Members: Regular check-ins
  INSERT INTO checkins (participant_id, meeting_id, tenant_id, checkin_time, status)
  VALUES 
    (v_member_1, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:00:00', 'present'),
    (v_member_1, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:01:00', 'present'),
    (v_member_1, v_meeting_today, v_tenant_id, CURRENT_TIMESTAMP - INTERVAL '1 hour 5 minutes', 'present'),
    (v_member_2, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:03:00', 'present'),
    (v_member_2, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:00:00', 'present'),
    (v_member_2, v_meeting_today, v_tenant_id, CURRENT_TIMESTAMP - INTERVAL '55 minutes', 'present'),
    (v_member_3, v_meeting_past_1, v_tenant_id, (CURRENT_DATE - INTERVAL '14 days')::timestamp + TIME '07:15:00', 'late'),
    (v_member_3, v_meeting_past_2, v_tenant_id, (CURRENT_DATE - INTERVAL '7 days')::timestamp + TIME '07:12:00', 'present'),
    (v_member_3, v_meeting_today, v_tenant_id, CURRENT_TIMESTAMP - INTERVAL '45 minutes', 'present');
  
  RAISE NOTICE 'Created check-ins';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MOCK DATA SUMMARY:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Meetings: 5 (Past: 2, Today: 1, Future: 2)';
  RAISE NOTICE 'Participants:';
  RAISE NOTICE '  - Prospects: 3 (registered, not checked in)';
  RAISE NOTICE '  - Visitors: 3 (checked in 1-2 times)';
  RAISE NOTICE '  - Hot Leads: 2 (checked in 3+ times)';
  RAISE NOTICE '  - Declined: 1 (not interested)';
  RAISE NOTICE '  - Members: 3 (active members)';
  RAISE NOTICE '  - Alumni: 1 (former member)';
  RAISE NOTICE 'Check-ins: 18 records';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Mock data created successfully!';
  RAISE NOTICE '========================================';
  
END $$;
