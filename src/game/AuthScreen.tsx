// Signup / login gate shown before the game mounts.
import { Button } from "@/components/ui/button";
import { AwakeningBackdrop } from "./AwakeningIntro";
import { stopMenuMusic } from "./audio";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyProfileToGameState, createProfile, ensureProfile,
  validateSignupEmail, validateUsername, USERNAME_MIN, USERNAME_MAX,
} from "./profileSync";

type Mode = "login" | "signup";

type Props = { onReady: () => void };

export function AuthScreen({ onReady }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
        if (!data.user?.id) throw new Error("Signup failed — no user id returned");

        // Email confirmation on: no session yet. The profile is created
        // (and the kingdom assigned) at first login.
        if (!data.session) {
          setNotice("Check your email to confirm, then log in to complete your awakening.");
          setMode("login");
          return;
        }

        const row = await createProfile(cleanName);
        if (!row) throw new Error("Your awakening could not be saved. Please try again.");
        applyProfileToGameState(row);
      } else {
        const { data, error: logErr } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (logErr) throw logErr;
        const user = data.user;
        if (!user) throw new Error("The threshold did not open");
        const row = await ensureProfile(user);
        if (!row) throw new Error("This account has no remembered being yet. Sign up first.");
        applyProfileToGameState(row);
      }
      stopMenuMusic(); // fade the start song out as the game begins
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
            <p className="text-[11px] italic text-white/60">
              The Forgotten will place you in the realm where you are most needed.
            </p>
          )}

          {notice && (
            <div className="rounded border border-amber-300/40 bg-amber-900/30 px-3 py-2 text-xs text-amber-100">
              {notice}
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