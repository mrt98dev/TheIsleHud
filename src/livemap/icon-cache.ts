import { useEffect, useState } from "react";

// Map POI/marker icons are arbitrary URLs chosen by server-side admins, so
// any one of them can go stale (deleted upload, expired CDN link, a network
// hiccup) with no way for a plain <img>/<image> to recover. The main process
// (see icon:get in electron/main.cjs) fetches each icon once, persists it to
// disk, and keeps serving that last-known-good copy if a later fetch fails.
// This module just dedupes and caches those IPC round trips per renderer
// session so every consumer showing the same icon (full map + mini radar)
// doesn't re-request it independently.
const inflight = new Map<string, Promise<string | null>>();
const resolved = new Map<string, string | null>();

// Opening the map can ask for 60+ icons at once (one per POI). Each IPC
// reply carries a base64 data URL, and letting every request land — and
// every consuming <image> decode — in the same tick/frame is exactly the
// kind of burst that shows up as a long, janky main-thread task right after
// the map opens. Capping how many are in flight at once spreads that work
// out over several frames instead of one spike.
const MAX_CONCURRENT_ICON_LOADS = 4;
let activeIconLoads = 0;
const iconQueue: (() => void)[] = [];

function runNextIconLoad() {
  if (activeIconLoads >= MAX_CONCURRENT_ICON_LOADS) return;
  const job = iconQueue.shift();
  if (!job) return;
  activeIconLoads++;
  job();
}

function loadIcon(url: string): Promise<string | null> {
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = new Promise<string | null>((resolve) => {
    iconQueue.push(() => {
      window.isleOverlay
        .iconGet(url)
        .then((r) => r.dataUrl ?? null)
        .catch(() => null)
        .then((src) => {
          resolved.set(url, src);
          inflight.delete(url);
          activeIconLoads--;
          runNextIconLoad();
          resolve(src);
        });
    });
    runNextIconLoad();
  });
  inflight.set(url, p);
  return p;
}

export function useIconSrc(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (url ? resolved.get(url) ?? null : null));

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    if (resolved.has(url)) {
      setSrc(resolved.get(url) ?? null);
      return;
    }
    let alive = true;
    void loadIcon(url).then((s) => {
      if (alive) setSrc(s);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return src;
}
