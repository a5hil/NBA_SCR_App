-- ================================================================
-- SUPABASE MIGRATION: Smart Classroom live-data support
-- Run this in the Supabase Dashboard > SQL Editor (one time).
-- Adds columns/tables needed by the app + anon access policies.
-- ================================================================

-- 1. Controllers: relay channel info
ALTER TABLE public.controllers
  ADD COLUMN IF NOT EXISTS relay_channels INT DEFAULT 8,
  ADD COLUMN IF NOT EXISTS used_channels INT[] DEFAULT '{}';
  
-- 2. Devices: capabilities + live settings (brightness/speed/temp/...)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{"power": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 3. Alerts: text id (to match app mock ids) + classroom name
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS classroom_name TEXT;
ALTER TABLE public.alerts
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE TEXT USING id::text;

-- 4. Notifications: text id + classroom name
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS classroom_name TEXT;
ALTER TABLE public.notifications
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE TEXT USING id::text;

-- 5. Activity table (recent actions per classroom)
CREATE TABLE IF NOT EXISTS public.activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id TEXT REFERENCES public.classrooms(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  "user" TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Allow the public (anon) key to read and mutate the app tables.
--    NOTE: this is fine for mock/dev data, but for production access
--    you should scope policies per authenticated role instead.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

-- 7. Announcements / Digital Notice Board Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL, -- 'all' for broadcast, or 'cls-a101', 'cls-a102', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  duration TEXT DEFAULT '24h',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['campuses','classrooms','controllers','devices','alerts','notifications','activity','announcements'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;