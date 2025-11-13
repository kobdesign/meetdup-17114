-- =========================================================================
-- STEP 1: CLEAN DATABASE (รันก่อน)
-- =========================================================================
-- ลบ schema public ทั้งหมด (รวม tables, functions, types ทั้งหมด)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
