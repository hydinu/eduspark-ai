-- ============================================================
-- EduSpark AI — Resume Builder Database Table
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Personal Info
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  github TEXT DEFAULT '',
  portfolio TEXT DEFAULT '',
  
  -- Career Objective
  career_objective TEXT DEFAULT '',
  
  -- Structured data stored as JSONB for flexibility
  education JSONB DEFAULT '[]'::jsonb,
  -- Each entry: { degree, institution, year, score, score_type }
  
  skills JSONB DEFAULT '{}'::jsonb,
  -- Structure: { "Languages": ["Python","JS"], "Frameworks": ["React"], ... }
  
  projects JSONB DEFAULT '[]'::jsonb,
  -- Each entry: { title, tech_stack, description, bullets[], live_url, github_url }
  
  experience JSONB DEFAULT '[]'::jsonb,
  -- Each entry: { title, company, duration, bullets[] }
  
  extracurriculars JSONB DEFAULT '[]'::jsonb,
  -- Each entry: string
  
  languages JSONB DEFAULT '[]'::jsonb,
  -- Each entry: { language, proficiency }
  
  open_to_work BOOLEAN DEFAULT true,
  target_roles TEXT DEFAULT '',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- One resume per user
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own resume
CREATE POLICY "Users can view own resume" ON user_resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume" ON user_resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume" ON user_resumes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resume" ON user_resumes
  FOR DELETE USING (auth.uid() = user_id);
