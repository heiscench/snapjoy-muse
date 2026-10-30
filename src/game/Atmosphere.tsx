import { useCallback, useState } from "react";
import { Clouds, Mist } from "./fx/Sky";
import { Particles } from "./fx/Particles";
import { Smoke } from "./fx/Smoke";
import { Border } from "./fx/Border";
import { SkyDome, Sun, Wasteland, Mountains, CloudBanks } from "./fx/Horizon";
import { CloudShadows, Birds } from "./fx/Life";
import { KingdomClouds, KingdomEntry } from "./fx/KingdomBorders";
import { SkyIslands } from "./SkyIslands";
import { AdaptiveQuality, PerfOverlay } from "./PerfTools";
import { pushAlert } from "./alertState";

// Cheap, always on: the sky, sun, mountains, islands and the world border.
// Heavy, switched off automatically on a phone that struggles (or with ?lowfx=1 in the address).
const FORCE_LOW = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("lowfx");

export function Atmosphere() {
  const [low, setLow] = useState(FORCE_LOW);

  const onLow = useCallback(() => {
    setLow((was) => {
      if (!was) pushAlert("Graphics lowered to keep the game smooth.", "warn");
      return true;
    });
  }, []);

  return (
    <>
      <PerfOverlay />
      <AdaptiveQuality onLow={onLow} />

      <SkyDome />
      <Sun />
      <Wasteland />
      <Mountains />
      <CloudBanks />
      <SkyIslands />
      <Border />
      <KingdomEntry />

      {!low && (
        <>
          <Clouds />
          <Mist />
          <Particles />
          <Smoke />
          <CloudShadows />
          <Birds />
          <KingdomClouds />
        </>
      )}
    </>
  );
}