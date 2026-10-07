// Signup / login gate shown before the game mounts. Matches the neon-dark
// HUD aesthetic used throughout GameScene (pills, backdrop blur, gang tints).
import { Button } from "@/components/ui/button";
import { AwakeningBackdrop } from "./AwakeningIntro";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GANGS, type GangId } from "./gangs";
import {
  applyProfileToGameState, createProfile, loadProfile,
  validateSignupEmail, validateUsername, USERNAME_MIN, USERNAME_MAX,
} from "./profileSync";

type Mode = "login" | "signup";

type Props = { onReady: () => void };

export function AuthScreen({ onReady }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gang, setGang] = useState<GangId>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const cleanName = validateUsername(username);
        const cleanEmail = validateSignupEmail(email);
        const { data, error: signErr } = await supabase.auth.signUp({
          email: cleanEmail, password,
          options: { data: { username: cleanName } },
        });
        if (signErr) throw signErr;
        const uid = data.user?.id;
        if (!uid) throw new Error("Signup failed — no user id returned");
        const row = await createProfile(uid, cleanName, gang);
        if (!row) throw new Error("Your awakening could not be saved. Please try again.");
        applyProfileToGameState(row);
      } else {
        const { data, error: logErr } = await supabase.auth.signInWithPassword({ email, password });
        if (logErr) throw logErr;
        const uid = data.user?.id;
        if (!uid) throw new Error("The threshold did not open");
        const row = await loadProfile(uid);
        if (!row) throw new Error("This account has no remembered being yet.");
        applyProfileToGameState(row);
      }
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="awakening-screen auth-screen">
      <AwakeningBackdrop />
      <div className="awakening-brand">FORGOTTEN <span>1,111 BEINGS · SOLANA</span></div>
      <section className="awakening-content auth-content">
        <div className="lore-eyebrow">11:11 · THE THRESHOLD</div>
        <h1>FORGOTTEN</h1>
        <p className="awakening-tagline">Remain forgotten.. or become remembered.</p>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="auth-heading">{mode === "login" ? "You have been here before." : "A name stirs in the silence."}</h2>
          <div className="flex gap-1 text-[10px] uppercase tracking-widest">
            <Button variant="ghost"
              type="button"
              onClick={() => setMode("login")}
              className={`rounded px-2 py-1 ${mode === "login" ? "bg-white/20 text-white" : "text-white/50"}`}
            >
              Login
            </Button>
            <Button variant="ghost"
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded px-2 py-1 ${mode === "signup" ? "bg-white/20 text-white" : "text-white/50"}`}
            >
              Sign up
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-white/60">
              Name (you may have forgotten it)
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                className="rounded border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-white/60">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-white/60">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="rounded border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>

          {mode === "signup" && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-white/60">Choose your era</span>
              <div className="grid grid-cols-2 gap-2">
                {GANGS.map((g) => (
                  <Button variant="ghost"
                    type="button"
                    key={g.id}
                    onClick={() => setGang(g.id as GangId)}
                    aria-pressed={gang === g.id}
                    data-faction={g.id}
                    className={`era-choice ${
                      gang === g.id ? "selected" : ""
                    }`}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded border border-red-500/40 bg-red-900/40 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <Button variant="ghost"
            type="submit"
            disabled={loading}
            className="awakening-cta"
          >
            {loading ? "…" : mode === "signup" ? "Begin at 11:11" : "Awaken"}
          </Button>
        </form>
      </section>
      <div className="awakening-footer"><span>THE FORGOTTEN PROJECT</span><span>AWAKENED AT 11:11</span></div>
    </main>
  );
}
