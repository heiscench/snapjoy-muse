// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Component, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/game/AuthScreen";
import { applyProfileToGameState, loadProfile } from "@/game/profileSync";
import { authState } from "@/game/authState";
import { GameScene } from "@/game/GameScene";
import { reportLovableError } from "../lib/lovable-error-reporting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gang Wars — 3D Turf Warfare" },
      {
        name: "description",
        content:
          "Mobile-first 3D multiplayer turf war. Pick a gang, capture districts, defend your city.",
      },
      { property: "og:title", content: "Gang Wars — 3D Turf Warfare" },
      {
        property: "og:description",
        content: "Mobile-first 3D multiplayer turf war set in a neon-lit night city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="fixed inset-0 bg-black" />}>
      <IndexGate />
    </ClientOnly>
  );
}

function IndexGate() {
  const [status, setStatus] = useState<"checking" | "authed" | "guest">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) { if (!cancelled) setStatus("guest"); return; }
        const row = await loadProfile(uid);
        if (cancelled) return;
        if (row) {
          applyProfileToGameState(row);
          setStatus("authed");
        } else {
          setStatus("guest");
        }
      } catch (err) {
        console.error("[IndexGate] session check failed", err);
        if (!cancelled) setStatus("guest");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        authState.userId = null;
        setStatus("guest");
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  if (status === "checking") return <div className="fixed inset-0 bg-black" />;
  if (status === "guest") return <AuthScreen onReady={() => setStatus("authed")} />;
  return (
    <GameErrorBoundary>
      <GameScene />
    </GameErrorBoundary>
  );
}

// Local boundary so a gameplay crash (e.g. WebGL init failure, a bad frame)
// shows the real error and a retry button instead of taking down the whole
// app to the generic root error page.
class GameErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportLovableError(error, { boundary: "game_scene" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black px-4">
          <div className="max-w-md text-center text-white">
            <h1 className="text-xl font-semibold">The game failed to start</h1>
            <p className="mt-2 text-sm text-white/60 break-words">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-6 rounded bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest text-black"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}