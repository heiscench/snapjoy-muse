import { useCallback, useState } from "react";
import { Particles } from "./fx/Particles";
import { CloudShadows, Birds } from "./fx/Life";
import { SkyIslands } from "./SkyIslands";
import { AdaptiveQuality, PerfOverlay } from "./PerfTools";
import { pushAlert } from "./alertState";
import { lowerQuality } from "./quality";

// The sky itself (blue gradient, clouds, sun) now lives in medieval/SkyDome, mounted by the City.
// The old purple mountains, the wasteland beyond the map, the cloud banks, the world border and the
// kingdom clouds are gone: they belonged to the old world and did not match the new landscape.
// Heavy extras are switched off automatically on a phone that struggles (or with ?lowfx=1).
const FORCE_LOW = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("lowfx");

export function Atmosphere() {
  const [low, setLow] = useState(FORCE_LOW);

  const onLow = useCallback(() => {
    // Sun shadows are the first thing to go when the frame rate drops.
    lowerQuality();
    setLow((was) => {
      if (!was) pushAlert("Graphics lowered to keep the game smooth.", "warn");
      return true;
    });
  }, []);

  return (
    <>
      <PerfOverlay />
      <AdaptiveQuality onLow={onLow} />

      <SkyIslands />

      {!low && (
        <>
          <Particles />
          <CloudShadows />
          <Birds />
        </>
      )}
    </>
  );
}
