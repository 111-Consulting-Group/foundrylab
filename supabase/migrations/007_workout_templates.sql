-- Workout Templates System
-- Allows users to save and reuse workout structures

-- Create workout_templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  focus TEXT, -- e.g., "Upper Body", "Push Day"
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- exercises structure: [{ exercise_id, sets, target_reps, target_rpe, target_weight, rest_seconds }]
  estimated_duration INTEGER, -- minutes
  is_public BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user templates
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_templates_public ON workout_templates(is_public) WHERE is_public = true;

-- RLS Policies
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own templates"
  ON workout_templates FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public templates
CREATE POLICY "Users can view public templates"
  ON workout_templates FOR SELECT
  USING (is_public = true);

-- Users can create their own templates
CREATE POLICY "Users can create templates"
  ON workout_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON workout_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON workout_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_workout_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_workout_template_timestamp
  BEFORE UPDATE ON workout_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_template_timestamp();
