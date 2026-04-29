-- ============================================================
-- EduSpark AI — Knowledge Graph / RAG Memory Table
-- Run this SQL in your Supabase SQL Editor
-- This stores learning context for long-term RAG memory
-- ============================================================

-- 1. Knowledge Graph entries (concepts, relationships, facts)
CREATE TABLE IF NOT EXISTS knowledge_graph (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The concept/topic this entry is about
  concept TEXT NOT NULL,
  
  -- The knowledge content (fact, explanation, relationship)
  content TEXT NOT NULL,
  
  -- Source of the knowledge
  source TEXT DEFAULT 'ai_tutor',  -- 'ai_tutor', 'quiz', 'interview', 'course', 'user_input'
  
  -- Category for filtering
  category TEXT DEFAULT 'general',  -- 'general', 'dsa', 'webdev', 'ml', 'system_design', etc.
  
  -- Embedding-like tags for simple semantic search
  tags TEXT[] DEFAULT '{}',
  
  -- How confident/accurate this knowledge is (0-100)
  confidence INTEGER DEFAULT 80,
  
  -- How many times this was referenced/used
  access_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Learning history (tracks what user learned over time)
CREATE TABLE IF NOT EXISTS learning_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- What activity type
  activity_type TEXT NOT NULL,  -- 'quiz', 'interview', 'course', 'chat', 'practice'
  
  -- Topic/subject
  topic TEXT NOT NULL,
  
  -- Summary of what was learned
  summary TEXT DEFAULT '',
  
  -- Performance score if applicable (0-100)
  score INTEGER,
  
  -- Skills demonstrated/practiced
  skills_practiced TEXT[] DEFAULT '{}',
  
  -- Weak areas identified
  weak_areas TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;

-- Knowledge graph: users see global + their own entries
CREATE POLICY "Users can view KG entries" ON knowledge_graph
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert KG entries" ON knowledge_graph
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own KG entries" ON knowledge_graph
  FOR UPDATE USING (auth.uid() = user_id);

-- Learning history: users only see their own
CREATE POLICY "Users can view own learning history" ON learning_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning history" ON learning_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_kg_concept ON knowledge_graph(concept);
CREATE INDEX IF NOT EXISTS idx_kg_user ON knowledge_graph(user_id);
CREATE INDEX IF NOT EXISTS idx_kg_tags ON knowledge_graph USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_lh_user ON learning_history(user_id);
CREATE INDEX IF NOT EXISTS idx_lh_type ON learning_history(activity_type);
