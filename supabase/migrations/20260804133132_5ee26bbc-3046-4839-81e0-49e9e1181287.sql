-- 1. Normalize existing usernames (trim) so the unique index can be built.
UPDATE public.player_profiles SET username = btrim(username) WHERE username <> btrim(username);

-- 2. De-duplicate any existing case-insensitive duplicates by suffixing.
WITH d AS (
  SELECT user_id,
         row_number() OVER (PARTITION BY lower(btrim(username)) ORDER BY created_at) AS rn
  FROM public.player_profiles
)
UPDATE public.player_profiles p
SET username = p.username || '_' || d.rn
FROM d
WHERE p.user_id = d.user_id AND d.rn > 1;

-- 3. Case-insensitive unique username.
CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_username_lower_key
  ON public.player_profiles (lower(btrim(username)));

-- 4. Username format validation + auto-trim on write.
CREATE OR REPLACE FUNCTION public.validate_player_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  NEW.username := btrim(NEW.username);

  IF char_length(NEW.username) < 3 OR char_length(NEW.username) > 24 THEN
    RAISE EXCEPTION 'Username must be between 3 and 24 characters';
  END IF;

  IF NEW.username !~ '^[A-Za-z0-9 ._-]+$' THEN
    RAISE EXCEPTION 'Username may only contain letters, numbers, spaces, dots, underscores and hyphens';
  END IF;

  -- Gmail-only restriction applies to NEW profiles (new signups) only.
  IF TG_OP = 'INSERT' THEN
    SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = NEW.user_id;
    IF v_email IS NULL OR v_email NOT LIKE '%@gmail.com' THEN
      RAISE EXCEPTION 'Only @gmail.com email addresses can create an account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_profiles_validate ON public.player_profiles;
CREATE TRIGGER player_profiles_validate
BEFORE INSERT OR UPDATE ON public.player_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_player_profile();