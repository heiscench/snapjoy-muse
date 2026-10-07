import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthScreen } from "@/game/AuthScreen";
import { applyProfileToGameState, loadProfile } from "@/game/profileSync";
import { AwakeningIntro } from "@/game/AwakeningIntro";
import { authState } from "@/game/authState";

const GameScene = lazy(() =>
  import("@/game/GameScene").then((m) => ({ default: m.GameScene })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FORGOTTEN" },
      {
        name: "description",
        content:
          "1,111 beings on Solana. Awakened at 11:11. Remain forgotten.. or become remembered.",
      },
      { property: "og:title", content: "FORGOTTEN" },
      {
        property: "og:description",
        content: "Awaken among forgotten ruins. Reclaim fractured memories. Remain forgotten.. or become remembered.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="fixed inset-0 bg-background" />}>
      <IndexGate />
    </ClientOnly>
  );
}

function IndexGate() {
  const [introComplete, setIntroComplete] = useState(false);
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

  if (!introComplete) return <AwakeningIntro onContinue={() => setIntroComplete(true)} />;
  if (status === "checking") return <div className="fixed inset-0 bg-background" />;
  if (status === "guest") return <AuthScreen onReady={() => setStatus("authed")} />;
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-background" />}>
      <GameScene />
    </Suspense>
  );
}
