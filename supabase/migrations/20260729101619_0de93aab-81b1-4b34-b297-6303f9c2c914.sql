CREATE TABLE public.territory (
  district text PRIMARY KEY,
  owner smallint,
  lock_until timestamptz,
  captured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.territory TO authenticated;
GRANT ALL ON public.territory TO service_role;

ALTER TABLE public.territory ENABLE ROW LEVEL SECURITY;

CREATE POLICY territory_select_authenticated ON public.territory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY territory_insert_authenticated ON public.territory
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY territory_update_authenticated ON public.territory
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER territory_touch_updated_at
  BEFORE UPDATE ON public.territory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bank_state (
  bank_id integer PRIMARY KEY,
  robbery_lock_until timestamptz,
  guards_respawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bank_state TO authenticated;
GRANT ALL ON public.bank_state TO service_role;

ALTER TABLE public.bank_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_state_select_authenticated ON public.bank_state
  FOR SELECT TO authenticated USING (true);
CREATE POLICY bank_state_insert_authenticated ON public.bank_state
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY bank_state_update_authenticated ON public.bank_state
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER bank_state_touch_updated_at
  BEFORE UPDATE ON public.bank_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.territory REPLICA IDENTITY FULL;
ALTER TABLE public.bank_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.territory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_state;

INSERT INTO public.territory (district, owner) VALUES
  ('downtown', 0),
  ('industrial', 1),
  ('shopping', 2),
  ('harbor', 3),
  ('stadium', NULL),
  ('bank', NULL),
  ('residential', NULL);