// Signup / login gate shown before the game mounts. Matches the neon-dark
// HUD aesthetic used throughout GameScene (pills, backdrop blur, gang tints).
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
        if (!username.trim()) throw new Error("Pick a username");
        const { data, error: signErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } },
        });
        if (signErr) throw signErr;
        const uid = data.user?.id;
        if (!uid) throw new Error("Signup failed — no user id returned");
        const row = await createProfile(uid, username.trim(), gang);
        if (!row) throw new Error("Could not create your player profile");
        applyProfileToGameState(row);
      } else {
        const { data, error: logErr } = await supabase.auth.signInWithPassword({ email, password });
        if (logErr) throw logErr;
        const uid = data.user?.id;
        if (!uid) throw new Error("Login failed");
        const row = await loadProfile(uid);
        if (!row) throw new Error("No profile found for this account");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-4">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/70 p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black uppercase tracking-widest text-white">Gang Wars</h1>
          <div className="flex gap-1 text-[10px] uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded px-2 py-1 ${mode === "login" ? "bg-white/20 text-white" : "text-white/50"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded px-2 py-1 ${mode === "signup" ? "bg-white/20 text-white" : "text-white/50"}`}
            >
              Sign up
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-white/60">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={24}
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
              <span className="text-[10px] uppercase tracking-widest text-white/60">Choose your gang</span>
              <div className="grid grid-cols-2 gap-2">
                {GANGS.map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setGang(g.id as GangId)}
                    className={`rounded border px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest transition ${
                      gang === g.id ? "border-white/70 text-white" : "border-white/10 text-white/70 hover:border-white/30"
                    }`}
                    style={{ backgroundColor: `${g.color}${gang === g.id ? "cc" : "66"}` }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded border border-red-500/40 bg-red-900/40 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded bg-white px-4 py-2 text-sm font-black uppercase tracking-widest text-black disabled:opacity-50"
          >
            {loading ? "…" : mode === "signup" ? "Create & play" : "Enter city"}
          </button>
        </form>
      </div>
    </div>
  );
}
