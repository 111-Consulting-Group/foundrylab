-- Migration: Coach Conversations
-- Stores AI coach chat history for context continuity

-- ============================================================================
-- COACH CONVERSATIONS
-- Stores conversation threads with the AI coach
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT, -- Auto-generated or user-set title
  context_type TEXT CHECK (context_type IN ('general', 'workout', 'block_planning', 'recovery', 'technique')),

  -- Reference to related entities (optional)
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_coach_conversations_user ON coach_conversations(user_id, updated_at DESC);
CREATE INDEX idx_coach_conversations_active ON coach_conversations(user_id, is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON coach_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON coach_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON coach_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON coach_conversations FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- COACH MESSAGES
-- Individual messages within conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Context snapshot at time of message (for AI context)
  context_snapshot JSONB, -- Stores relevant training data at message time

  -- For assistant messages - what action was taken (if any)
  suggested_action JSONB, -- {type: 'adjust_workout', details: {...}}
  action_taken BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_messages_conversation ON coach_messages(conversation_id, created_at);
CREATE INDEX idx_coach_messages_user ON coach_messages(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- UPDATE CONVERSATION STATS TRIGGER
-- Keeps message_count and last_message_at updated
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coach_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_conversation_stats
  AFTER INSERT ON coach_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_stats();


-- ============================================================================
-- COACH QUICK ACTIONS
-- Pre-defined actions the coach can suggest
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_quick_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN ('adjust_intensity', 'swap_exercise', 'add_deload', 'modify_volume', 'change_split', 'custom')),
  label TEXT NOT NULL,
  prompt_template TEXT NOT NULL, -- Pre-filled prompt for this action

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Whether this is a system default or user-created
  is_system_default BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_quick_actions_user ON coach_quick_actions(user_id);

-- RLS Policies
ALTER TABLE coach_quick_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quick actions"
  ON coach_quick_actions FOR SELECT
  USING (auth.uid() = user_id OR is_system_default = TRUE);

CREATE POLICY "Users can insert own quick actions"
  ON coach_quick_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick actions"
  ON coach_quick_actions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick actions"
  ON coach_quick_actions FOR DELETE
  USING (auth.uid() = user_id AND is_system_default = FALSE);
