-- Migration: 002_configurations_table.sql
-- Configuration management system for IVA (Task 16)
-- Adds tables for configuration snapshots, experiments, and cost tracking

-- Configurations table for per-session configuration snapshots
CREATE TABLE IF NOT EXISTS configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  name text,
  description text,
  config_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Performance metrics (calculated from session data)
  performance_metrics jsonb DEFAULT '{
    "avg_response_time": null,
    "success_rate": null,
    "cost_per_conversation": null,
    "voice_characters_used": null,
    "voice_cost": null
  }'::jsonb,
  
  -- Metadata
  tags text[] DEFAULT '{}',
  is_preset boolean DEFAULT false,
  preset_id text, -- Reference to predefined presets
  
  -- Constraints
  CONSTRAINT valid_config_data CHECK (jsonb_typeof(config_data) = 'object'),
  CONSTRAINT performance_metrics_is_object CHECK (jsonb_typeof(performance_metrics) = 'object')
);

-- Configuration experiments table for A/B testing
CREATE TABLE IF NOT EXISTS configuration_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  hypothesis text,
  
  -- Experiment configurations
  control_config jsonb NOT NULL,
  test_config jsonb NOT NULL,
  metrics_to_track text[] NOT NULL DEFAULT '{}',
  
  -- Experiment lifecycle
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text CHECK (status IN ('draft', 'running', 'completed', 'paused')) NOT NULL DEFAULT 'draft',
  
  -- Results (populated when experiment completes)
  results jsonb DEFAULT '{
    "control_metrics": {},
    "test_metrics": {},
    "statistical_significance": null,
    "winner": null,
    "confidence_level": null,
    "conclusion": null
  }'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_control_config CHECK (jsonb_typeof(control_config) = 'object'),
  CONSTRAINT valid_test_config CHECK (jsonb_typeof(test_config) = 'object'),
  CONSTRAINT valid_results CHECK (jsonb_typeof(results) = 'object'),
  CONSTRAINT valid_end_date CHECK (end_date IS NULL OR end_date > start_date)
);

-- Session configuration tracking (links sessions to their active configurations)
CREATE TABLE IF NOT EXISTS session_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  configuration_id uuid REFERENCES configurations(id) ON DELETE SET NULL,
  experiment_id uuid REFERENCES configuration_experiments(id) ON DELETE SET NULL,
  variant text CHECK (variant IN ('control', 'test')), -- For A/B testing
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one configuration per session
  UNIQUE(session_id)
);

-- Configuration cost tracking (detailed cost metrics per session/configuration)
CREATE TABLE IF NOT EXISTS configuration_cost_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  configuration_id uuid REFERENCES configurations(id) ON DELETE CASCADE,
  
  -- API costs breakdown
  openai_cost numeric(10,4) NOT NULL DEFAULT 0,
  elevenlabs_cost numeric(10,4) NOT NULL DEFAULT 0,
  supabase_cost numeric(10,4) NOT NULL DEFAULT 0,
  total_cost numeric(10,4) NOT NULL DEFAULT 0,
  
  -- Usage metrics
  tokens_used integer NOT NULL DEFAULT 0,
  characters_used integer NOT NULL DEFAULT 0,
  api_calls integer NOT NULL DEFAULT 0,
  
  -- Performance metrics
  session_duration_ms integer NOT NULL DEFAULT 0,
  cost_per_minute numeric(10,4) GENERATED ALWAYS AS (
    CASE 
      WHEN session_duration_ms > 0 THEN total_cost * 60000.0 / session_duration_ms
      ELSE 0
    END
  ) STORED,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT non_negative_costs CHECK (
    openai_cost >= 0 AND 
    elevenlabs_cost >= 0 AND 
    supabase_cost >= 0 AND 
    total_cost >= 0
  ),
  CONSTRAINT non_negative_usage CHECK (
    tokens_used >= 0 AND 
    characters_used >= 0 AND 
    api_calls >= 0 AND 
    session_duration_ms >= 0
  )
);

-- Extend existing sessions table to link to configurations
-- (Adding column to existing table from Task 9)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' AND column_name = 'configuration_id'
  ) THEN
    ALTER TABLE sessions 
    ADD COLUMN configuration_id uuid REFERENCES configurations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_configurations_session_id ON configurations(session_id);
CREATE INDEX IF NOT EXISTS idx_configurations_created_at ON configurations(created_at);
CREATE INDEX IF NOT EXISTS idx_configurations_preset_id ON configurations(preset_id) WHERE preset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_configurations_is_preset ON configurations(is_preset) WHERE is_preset = true;

CREATE INDEX IF NOT EXISTS idx_configuration_experiments_status ON configuration_experiments(status);
CREATE INDEX IF NOT EXISTS idx_configuration_experiments_dates ON configuration_experiments(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_session_configurations_session_id ON session_configurations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_configurations_config_id ON session_configurations(configuration_id);
CREATE INDEX IF NOT EXISTS idx_session_configurations_experiment_id ON session_configurations(experiment_id);

CREATE INDEX IF NOT EXISTS idx_cost_metrics_session_id ON configuration_cost_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_config_id ON configuration_cost_metrics(configuration_id);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_created_at ON configuration_cost_metrics(created_at);

-- Create updated_at trigger for configurations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configurations_updated_at
  BEFORE UPDATE ON configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuration_experiments_updated_at
  BEFORE UPDATE ON configuration_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_configurations_updated_at
  BEFORE UPDATE ON session_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration presets
INSERT INTO configurations (
  session_id, 
  name, 
  description, 
  config_data, 
  is_preset, 
  preset_id, 
  tags
) VALUES 
(
  'preset', 
  'Fast & Cheap',
  'Optimized for speed and cost efficiency with basic voice support',
  '{
    "model": {
      "provider": "openai",
      "model_name": "gpt-4o-mini",
      "temperature": 0.3,
      "max_tokens": 150,
      "top_p": 0.9,
      "frequency_penalty": 0,
      "presence_penalty": 0
    },
    "safety": {
      "confidence_threshold": 0.7,
      "policy_strictness": "medium",
      "max_retries": 1,
      "fallback_on_error": true
    },
    "conversation": {
      "context_window_turns": 5,
      "memory_depth": "shallow",
      "response_style": "concise",
      "slot_validation": "flexible"
    },
    "performance": {
      "timeout_seconds": 10,
      "retry_delay_ms": 750,
      "streaming_enabled": true,
      "caching_enabled": true
    },
    "voice": {
      "enabled": false,
      "provider": "elevenlabs"
    }
  }',
  true,
  'fast-and-cheap',
  ARRAY['speed', 'cost', 'basic']
),
(
  'preset',
  'Accurate & Safe', 
  'High accuracy and safety with premium voice quality',
  '{
    "model": {
      "provider": "openai",
      "model_name": "gpt-4o",
      "temperature": 0.1,
      "max_tokens": 300,
      "top_p": 0.8,
      "frequency_penalty": 0.1,
      "presence_penalty": 0.1
    },
    "safety": {
      "confidence_threshold": 0.8,
      "policy_strictness": "high",
      "max_retries": 3,
      "fallback_on_error": true
    },
    "conversation": {
      "context_window_turns": 10,
      "memory_depth": "deep",
      "response_style": "detailed",
      "slot_validation": "strict"
    },
    "performance": {
      "timeout_seconds": 30,
      "retry_delay_ms": 1000,
      "streaming_enabled": false,
      "caching_enabled": true
    },
    "voice": {
      "enabled": false,
      "provider": "elevenlabs"
    }
  }',
  true,
  'accurate-and-safe',
  ARRAY['accuracy', 'safety', 'premium']
),
(
  'preset',
  'Voice Optimized',
  'Optimized for voice interactions with enhanced audio settings', 
  '{
    "model": {
      "provider": "openai",
      "model_name": "gpt-4o-mini",
      "temperature": 0.7,
      "max_tokens": 200,
      "top_p": 0.9,
      "frequency_penalty": 0,
      "presence_penalty": 0
    },
    "safety": {
      "confidence_threshold": 0.75,
      "policy_strictness": "medium",
      "max_retries": 2,
      "fallback_on_error": true
    },
    "conversation": {
      "context_window_turns": 8,
      "memory_depth": "medium",
      "response_style": "natural",
      "slot_validation": "flexible"
    },
    "performance": {
      "timeout_seconds": 15,
      "retry_delay_ms": 750,
      "streaming_enabled": true,
      "caching_enabled": true
    },
    "voice": {
      "enabled": true,
      "provider": "elevenlabs",
      "voice_settings": {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "model": "eleven_monolingual_v1",
        "voice_settings": {
          "stability": 0.6,
          "similarity_boost": 0.9,
          "style": 0.4,
          "use_speaker_boost": true
        }
      },
      "audio_settings": {
        "volume": 0.9,
        "playback_speed": 1.0,
        "fade_in_duration": 150,
        "fade_out_duration": 250,
        "enable_spatial_audio": false,
        "auto_play": true,
        "queue_mode": "interrupt"
      },
    }
  }',
  true,
  'voice-optimized',
  ARRAY['voice', 'conversation', 'audio']
)
ON CONFLICT DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE configurations IS 'Configuration snapshots for systematic IVA experimentation';
COMMENT ON TABLE configuration_experiments IS 'A/B testing experiments comparing different configurations';
COMMENT ON TABLE session_configurations IS 'Links sessions to their active configurations';
COMMENT ON TABLE configuration_cost_metrics IS 'Detailed cost tracking per configuration and session';
COMMENT ON COLUMN configurations.config_data IS 'Full configuration JSON matching Configuration interface';
COMMENT ON COLUMN configurations.performance_metrics IS 'Calculated performance metrics for this configuration';
COMMENT ON COLUMN configuration_cost_metrics.cost_per_minute IS 'Generated column: total cost per minute of session duration';
