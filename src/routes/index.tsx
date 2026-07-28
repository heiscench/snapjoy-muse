import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/game/AuthScreen";
import { applyProfileToGameState, loadProfile } from "@/game/profileSync";
import { authState } from "@/game/authState";

const GameScene = lazy(() =>
  import("@/game/GameScene").then((m) => ({ default: m.GameScene })),
);

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
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <GameScene />
    </Suspense>
  );
}
