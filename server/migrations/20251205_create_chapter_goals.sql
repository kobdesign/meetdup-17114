-- Chapter Goals & Achievements System
-- This migration creates tables for tracking chapter goals and achievements

-- Goal metric types enum
DO $$ BEGIN
    CREATE TYPE goal_metric_type AS ENUM (
        'weekly_visitors',
        'monthly_visitors', 
        'total_members',
        'weekly_checkins',
        'monthly_checkins',
        'weekly_referrals',
        'monthly_referrals',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Goal status enum
DO $$ BEGIN
    CREATE TYPE goal_status AS ENUM (
        'active',
        'achieved',
        'expired',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Goal Templates table (predefined goal types)
CREATE TABLE IF NOT EXISTS goal_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type goal_metric_type NOT NULL,
    name_th TEXT NOT NULL,
    name_en TEXT,
    description_th TEXT,
    description_en TEXT,
    icon TEXT DEFAULT 'target',
    default_target INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chapter Goals table (goals set by each chapter)
CREATE TABLE IF NOT EXISTS chapter_goals (
    goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    template_id UUID REFERENCES goal_templates(template_id),
    metric_type goal_metric_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'target',
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status goal_status DEFAULT 'active',
    achieved_at TIMESTAMPTZ,
    line_notified_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chapter_goals_tenant ON chapter_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chapter_goals_status ON chapter_goals(status);
CREATE INDEX IF NOT EXISTS idx_chapter_goals_dates ON chapter_goals(start_date, end_date);

-- Enable RLS
ALTER TABLE goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for goal_templates (read-only for all authenticated users)
DROP POLICY IF EXISTS "goal_templates_select" ON goal_templates;
CREATE POLICY "goal_templates_select" ON goal_templates
    FOR SELECT TO authenticated USING (true);

-- RLS Policies for chapter_goals
DROP POLICY IF EXISTS "chapter_goals_select" ON chapter_goals;
CREATE POLICY "chapter_goals_select" ON chapter_goals
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "chapter_goals_insert" ON chapter_goals;
CREATE POLICY "chapter_goals_insert" ON chapter_goals
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "chapter_goals_update" ON chapter_goals;
CREATE POLICY "chapter_goals_update" ON chapter_goals
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "chapter_goals_delete" ON chapter_goals;
CREATE POLICY "chapter_goals_delete" ON chapter_goals
    FOR DELETE TO authenticated USING (true);

-- Insert default goal templates
INSERT INTO goal_templates (metric_type, name_th, name_en, description_th, description_en, icon, default_target, sort_order) VALUES
    ('weekly_visitors', 'Visitor รายสัปดาห์', 'Weekly Visitors', 'จำนวน visitor ใหม่ในสัปดาห์นี้', 'New visitors this week', 'users', 10, 1),
    ('monthly_visitors', 'Visitor รายเดือน', 'Monthly Visitors', 'จำนวน visitor ใหม่ในเดือนนี้', 'New visitors this month', 'users', 30, 2),
    ('total_members', 'สมาชิกทั้งหมด', 'Total Members', 'จำนวนสมาชิกทั้งหมดใน Chapter', 'Total members in chapter', 'user-check', 50, 3),
    ('weekly_checkins', 'Check-in รายสัปดาห์', 'Weekly Check-ins', 'จำนวน check-in ในสัปดาห์นี้', 'Check-ins this week', 'calendar-check', 20, 4),
    ('monthly_checkins', 'Check-in รายเดือน', 'Monthly Check-ins', 'จำนวน check-in ในเดือนนี้', 'Check-ins this month', 'calendar', 80, 5),
    ('weekly_referrals', 'Referral รายสัปดาห์', 'Weekly Referrals', 'จำนวน referral ในสัปดาห์นี้', 'Referrals this week', 'gift', 5, 6),
    ('monthly_referrals', 'Referral รายเดือน', 'Monthly Referrals', 'จำนวน referral ในเดือนนี้', 'Referrals this month', 'gift', 15, 7)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chapter_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS chapter_goals_updated_at ON chapter_goals;
CREATE TRIGGER chapter_goals_updated_at
    BEFORE UPDATE ON chapter_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_chapter_goals_updated_at();
