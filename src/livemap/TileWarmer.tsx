import { useEffect, useState } from "react";

export const MAP_LAYER_PATH = "maps/gateway-v0.21";
const TILE_NAMES = ["base", "water", "land"];

// The map's background tiles are the expensive part to decode (full-res
// webp textures), and MapCanvas's own <img> tags for them only exist inside
// FullMapOverlay's subtree, which is `display:none` while the map is closed
// — so those tags never actually get painted, and a browser can defer or
// drop their decoded bitmap while hidden. This renders the SAME tile URLs
// unconditionally, off-screen but genuinely painted (never display:none),
// so there's always a live client keeping them decoded in Chromium's shared
// image cache; MapCanvas's own <img> tags for the same URLs then decode
// instantly from that cache the moment the map opens, instead of the pop-in
// users saw where the modal appeared before the map content did.
export function TileWarmer() {
  const [base, setBase] = useState("https://islepilot.eu");

  useEffect(() => {
    window.isleOverlay.getSettings().then((s) => {
      if (s.apiBaseUrl) setBase(s.apiBaseUrl.replace(/\/+$/, ""));
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -100000,
        top: 0,
        width: 1024,
        height: 1024,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {TILE_NAMES.map((name) => (
        <img
          key={name}
          src={`${base}/${MAP_LAYER_PATH}/${name}.webp`}
          alt=""
          decoding="async"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ))}
    </div>
  );
}
