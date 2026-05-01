-- ─── UNIVERSITY TEAMS TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- The main University Admin
  member_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Team member
  role TEXT DEFAULT 'member', -- member, moderator, support
  permissions JSONB DEFAULT '[]'::jsonb, -- Array of strings: ['overview', 'vendors', 'catalog', 'users']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(university_id, member_id)
);

ALTER TABLE public.university_teams ENABLE ROW LEVEL SECURITY;

-- Super Admin can do everything
CREATE POLICY "Super Admins manage teams." ON public.university_teams
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- University Admins can manage their own teams
CREATE POLICY "Uni Admins manage own team." ON public.university_teams
  FOR ALL USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- Members can view their team
CREATE POLICY "Members view own team." ON public.university_teams
  FOR SELECT USING (member_id = auth.uid());
