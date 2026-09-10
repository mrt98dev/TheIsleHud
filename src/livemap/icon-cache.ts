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

function loadIcon(url: string): Promise<string | null> {
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = window.isleOverlay
    .iconGet(url)
    .then((r) => r.dataUrl ?? null)
    .catch(() => null)
    .then((src) => {
      resolved.set(url, src);
      inflight.delete(url);
      return src;
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
