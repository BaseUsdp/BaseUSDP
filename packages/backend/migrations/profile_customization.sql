-- Public profile customization fields.
-- Adds bio + banner + social handles to user_profiles so creators can
-- personalize their /@handle landing page. Apply in Supabase SQL editor.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
  ADD COLUMN IF NOT EXISTS farcaster_handle TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

COMMENT ON COLUMN user_profiles.bio IS 'Short creator bio shown on /@handle (recommended <200 chars).';
COMMENT ON COLUMN user_profiles.banner_url IS 'Optional banner image URL displayed at the top of /@handle.';
COMMENT ON COLUMN user_profiles.twitter_handle IS 'X/Twitter handle without the @, e.g. "georgesk".';
COMMENT ON COLUMN user_profiles.farcaster_handle IS 'Farcaster username without the @, e.g. "georgesk".';
COMMENT ON COLUMN user_profiles.website_url IS 'Personal website URL, full https://...';
