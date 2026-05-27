-- MCP plugin opt-in flag.
-- Adds `mcp_enabled` to user_profiles so a user can choose whether the
-- BASEUSDP Base MCP plugin (/api/mcp/*) is allowed to expose their handle
-- to AI assistants. Defaults to false (opt-in) so no existing user is
-- exposed without explicit consent.
--
-- Apply in the Supabase SQL editor.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS mcp_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.mcp_enabled IS
  'When true, the user''s @handle can be resolved and tipped via the BASEUSDP Base MCP plugin. Off by default.';
