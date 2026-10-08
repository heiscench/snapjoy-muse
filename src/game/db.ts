import { supabase } from "@/integrations/supabase/client";

export const FORGOTTEN_SCHEMA = "forgotten";

/** Supabase query client scoped to the isolated `forgotten` schema.
 * Use db().from("player_profiles") instead of supabase.from(...). */
export function db() {
  return supabase.schema(FORGOTTEN_SCHEMA as never) as unknown as typeof supabase;
}