CREATE TABLE public.player_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  gang SMALLINT NOT NULL DEFAULT 0 CHECK (gang BETWEEN 0 AND 3),
  money INTEGER NOT NULL DEFAULT 500,
  reputation INTEGER NOT NULL DEFAULT 0,
  owned_weapons TEXT[] NOT NULL DEFAULT ARRAY['pistol']::TEXT[],
  equipped_weapon TEXT NOT NULL DEFAULT 'pistol',
  last_position_x REAL NOT NULL DEFAULT 24,
  last_position_z REAL NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_profiles TO authenticated;
GRANT ALL ON public.player_profiles TO service_role;

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all_authenticated"
  ON public.player_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.player_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER player_profiles_touch_updated
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();