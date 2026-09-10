import { LiveMapTab } from "./LiveMapTab";

export function FullMapOverlay({
  open,
  onClose,
  authed,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
  onLogin: () => void;
}) {
  // Stay mounted while closed (component state, data, and icon cache all
  // survive), hidden via `display:none`.
  //
  // This has been flip-flopped a couple of times — worth recording why
  // `display:none` wins. Making the marker/POI layer paint continuously
  // (opacity-only hide) was tried twice, hoping the ZoneShapes/PlayerShapes
  // split (MapCanvas.tsx) plus disabling Chromium's native-occlusion-
  // detection misfire (CalculateNativeWinOcclusion, main.cjs) had made it
  // cheap enough. Measured result: WORSE, not better — a continuous run of
  // 9 long tasks (~1-1.8s each, every ~2.5s for 20+ seconds) while the map
  // was open and being used, versus 2 isolated ~2s stalls in 13 minutes of
  // play with `display:none`. So the marker layer is genuinely too
  // expensive to keep live outside of actual use, even split and memoized.
  // `display:none` avoids that ongoing cost; the occasional stall this
  // trades back in (first layout of that layer on open, under real CPU
  // contention from the game) is the smaller cost of the two measured
  // options.
  return (
    <div className="fullMapBackdrop" style={{ display: open ? undefined : "none" }}>
      <div className="fullMapPanel">
        <button type="button" className="fullMapClose" onClick={onClose} aria-label="Close map">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>
        <div className="fullMapBody">
          <LiveMapTab authed={authed} onLogin={onLogin} open={open} />
        </div>
      </div>
    </div>
  );
}
