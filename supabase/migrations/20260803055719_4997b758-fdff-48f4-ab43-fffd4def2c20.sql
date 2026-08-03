ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS owned_vehicles text[] NOT NULL DEFAULT '{}'::text[];