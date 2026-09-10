import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isInteractLocked, lockInteract, unlockInteract } from "./interaction";
import { FullMapOverlay } from "./FullMapOverlay";
import { TileWarmer } from "./livemap/TileWarmer";
import { mapInteractingNow } from "./livemap/MapCanvas";
import { HeartHud } from "./HeartHud";
import { StatsWidget } from "./StatsWidget";
import { RadarPanel } from "./RadarPanel";
import { TrollLayer } from "./TrollLayer";
import { CompassWidget } from "./CompassWidget";
import { clampToViewport } from "./drag";
import { tr, translatePrimeQuest, type AppLanguage } from "./i18n";
import { DEFAULT_MAP_TRACKING } from "./map-tracking";
import type {
  AuthInfo,
  LiveFrame,
  OverlaySettings,
  OverlayState,
  OverlayTheme,
  PlayerMe,
  ServerStatus,
} from "./preload";

const DEFAULT_THEME: OverlayTheme = {
  accent: "#7cf2a6",
  stat: { health: "#ff5a5a", stamina: "#35d6a4", food: "#ffb454", water: "#5ab6ff" },
  heart: "#e2fbff",
};

function applyTheme(t: OverlayTheme) {
  const r = document.documentElement.style;
  r.setProperty("--phos", t.accent);
  r.setProperty("--edge", t.accent + "2e");
  r.setProperty("--phos-dim", t.accent + "77");
}

let cursorLatched = false;

function useAutoInteract() {
  useEffect(() => {
    let ignore = true;
    const set = (next: boolean) => {
      if (next === ignore) return;
      ignore = next;
      void window.isleOverlay.setMouseIgnore(next);
    };
    const onMove = () => {
      set(!(cursorLatched || isInteractLocked()));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
}

type Pos = { x: number; y: number };
type WidgetLayout = Pos & { scale?: number };
type WidgetSize = { width: number; height: number };

const clampScale = (value: number, min = 0.5, max = 2.5) =>
  Math.max(min, Math.min(max, value));

function DraggablePanel({
  id,
  defaultPos,
  settings,
  resizeLabel,
  children,
}: {
  id: string;
  defaultPos: Pos;
  settings: OverlaySettings | null;
  resizeLabel: string;
  children: React.ReactNode;
}) {
  const saved = (settings?.layout as Record<string, WidgetLayout> | null | undefined)?.[id];
  const [pos, setPos] = useState<Pos>(saved && typeof saved.x === "number" ? saved : defaultPos);
  const [scale, setScale] = useState(
    typeof saved?.scale === "number" ? clampScale(saved.scale) : 1,
  );
  const [baseSize, setBaseSize] = useState<WidgetSize | null>(null);
  const off = useRef<Pos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  const scaleRef = useRef(scale);

  const saveLayout = (next: WidgetLayout) => {
    void window.isleOverlay.getSettings().then((s) => {
      void window.isleOverlay.setSettings({
        layout: { ...(s.layout || {}), [id]: next },
      });
    });
  };

  useEffect(() => {
    if (saved && typeof saved.x === "number") setPos(saved);
    if (typeof saved?.scale === "number") {
      const nextScale = clampScale(saved.scale);
      scaleRef.current = nextScale;
      setScale(nextScale);
    }
  }, [saved?.x, saved?.y, saved?.scale]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      const width = content.offsetWidth;
      const height = content.offsetHeight;
      if (width > 0 && height > 0) {
        setBaseSize((current) =>
          current?.width === width && current.height === height ? current : { width, height },
        );
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;
    const keepVisible = () => {
      const box = element.getBoundingClientRect();
      setPos((current) => {
        const next = clampToViewport(current, box.width, box.height);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    const observer = new ResizeObserver(keepVisible);
    observer.observe(element);
    window.addEventListener("resize", keepVisible);
    keepVisible();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepVisible);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hovered.current) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      setPos((p) => {
        const box = panelRef.current?.getBoundingClientRect();
        const np = clampToViewport(
          { x: p.x + dx, y: p.y + dy },
          box?.width ?? 0,
          box?.height ?? 0,
        );
        saveLayout({ ...np, scale: scaleRef.current });
        return np;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  const onDown = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest(".dragHandle")) return;
    e.preventDefault();
    off.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    lockInteract();
    const move = (ev: MouseEvent) => {
      if (!off.current) return;
      const box = panelRef.current?.getBoundingClientRect();
      setPos(clampToViewport(
        { x: ev.clientX - off.current.x, y: ev.clientY - off.current.y },
        box?.width ?? 0,
        box?.height ?? 0,
      ));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      off.current = null;
      unlockInteract();
      setPos((p) => {
        saveLayout({ ...p, scale: scaleRef.current });
        return p;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onResizeDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!baseSize) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, scale: scaleRef.current };
    lockInteract();
    const move = (ev: MouseEvent) => {
      const denominator = baseSize.width ** 2 + baseSize.height ** 2;
      const projected = denominator > 0
        ? ((ev.clientX - start.x) * baseSize.width + (ev.clientY - start.y) * baseSize.height) / denominator
        : 0;
      const viewportMax = Math.min(
        (window.innerWidth - pos.x) / baseSize.width,
        (window.innerHeight - pos.y) / baseSize.height,
        2.5,
      );
      const nextScale = Math.max(0.35, Math.min(clampScale(start.scale + projected), viewportMax));
      scaleRef.current = nextScale;
      setScale(nextScale);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      unlockInteract();
      saveLayout({ ...pos, scale: scaleRef.current });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const scaledWidth = baseSize ? baseSize.width * scale : undefined;
  const scaledHeight = baseSize ? baseSize.height * scale : undefined;

  return (
    <div
      ref={panelRef}
      className="panel resizablePanel hudWidgetPanel interactive-region"
      style={{ left: pos.x, top: pos.y, width: scaledWidth, height: scaledHeight }}
      onMouseDown={onDown}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div
        ref={contentRef}
        className="resizablePanelContent"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
      <button
        type="button"
        className="panelResizeHandle"
        aria-label={resizeLabel}
        title={resizeLabel}
        onMouseDown={onResizeDown}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 14 14 6M10 14l4-4M2 14 14 2" />
        </svg>
      </button>
    </div>
  );
}


function PrimePanel({ me, language }: { me: PlayerMe | null; language: AppLanguage }) {
  const p = me?.prime;
  const t = (text: string) => tr(language, text);
  return (
    <div className="frame primeFrame">
      <div className="frameBar dragHandle">
        <span className="dot" />
        <span className="ttl">PRIME</span>
        {p ? <span className="badge">{p.done}/{p.required}</span> : null}
        <span className="grip">⠿</span>
      </div>
      <div className="frameBody">
        {!p ? (
          <div className="muted">{t("No Prime data")}</div>
        ) : p.elder ? (
          <div className="ok">✔ {t("Prime Elder reached")}</div>
        ) : (
          <>
            <div className={p.eligible ? "ok" : "muted"}>
              {p.eligible
                ? `✔ ${t("Eligible for Prime Elder")}`
                : language === "vi"
                  ? `Cần ${p.required} điều kiện`
                  : `Need ${p.required} conditions`}
            </div>
            <ul className="primeList">
              {p.quests.map((q, i) => (
                <li key={i} className={q.done ? "q-done" : "q-open"}>
                  <span className="qbox">{q.done ? "▣" : "▢"}</span> {translatePrimeQuest(language, q.name)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function validPlayerCount(...values: Array<number | null | undefined>): number | null {
  const value = values.find((candidate) =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0,
  );
  return typeof value === "number" ? Math.floor(value) : null;
}

function formatServerDataAge(language: AppLanguage, lastUpdate?: number | null): string | null {
  if (typeof lastUpdate !== "number" || !Number.isFinite(lastUpdate) || lastUpdate <= 0) return null;
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000 - lastUpdate));
  if (ageSeconds < 60) return language === "vi" ? "Dữ liệu vừa cập nhật" : "Data updated just now";
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return language === "vi" ? `Dữ liệu ${minutes} phút trước` : `Data from ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return language === "vi" ? `Dữ liệu ${hours} giờ trước` : `Data from ${hours} hr ago`;
}

function ServerInfoWidget({
  me,
  status,
  language,
}: {
  me: PlayerMe;
  status: ServerStatus | null;
  language: AppLanguage;
}) {
  const t = (text: string) => tr(language, text);
  const playerCount = validPlayerCount(
    status?.playersOnline,
    me.playersOnline,
    me.playerCount,
    me.onlinePlayers,
  );
  const maxPlayers = validPlayerCount(status?.maxPlayers, me.maxPlayers);
  const hasMonitoringStatus = typeof status?.online === "boolean";
  const isOnline = hasMonitoringStatus ? status.online === true : me.online === true;
  const serverName = status?.name?.trim() || me.server || t("Unknown server");
  const statusText = hasMonitoringStatus
    ? t(isOnline ? "Server online" : "Server offline")
    : t(isOnline ? "Player online" : "Player offline");
  const dataAge = formatServerDataAge(language, status?.lastUpdate);
  const staleData =
    typeof status?.lastUpdate === "number" && Date.now() / 1000 - status.lastUpdate >= 120;

  return (
    <div
      className="serverInfoHud dragHandle"
      role="status"
      aria-live="polite"
      aria-label={`${t("Current server")}: ${serverName}. ${statusText}${playerCount !== null ? `, ${playerCount}/${maxPlayers ?? "?"} ${t("Players online")}` : ""}`}
    >
      <div className="serverInfoHeader">
        <svg className="serverInfoIcon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="3" width="16" height="7" rx="2" />
          <rect x="4" y="14" width="16" height="7" rx="2" />
          <path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5" />
        </svg>
        <span>{t("Current server")}</span>
      </div>
      <div className="serverInfoName" title={serverName}>{serverName}</div>
      <div className="serverInfoMeta">
        <span className={`serverInfoDot ${isOnline ? "online" : "offline"}`} aria-hidden="true" />
        <span>{statusText}</span>
        {playerCount !== null ? (
          <span className="serverInfoCount" title={t("Players online")}>
            {playerCount}{maxPlayers !== null ? `/${maxPlayers}` : ""}
          </span>
        ) : null}
      </div>
      {dataAge ? (
        <div className={`serverInfoFreshness ${staleData ? "stale" : ""}`}>
          GameMonitoring · {dataAge}
        </div>
      ) : null}
    </div>
  );
}

function useMe(authed: boolean): PlayerMe | null {
  const [me, setMe] = useState<PlayerMe | null>(null);
  useEffect(() => {
    if (!authed) {
      setMe(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const r = await window.isleOverlay.apiGet<PlayerMe>("/api/overlay/me");
      if (alive && !r.error) setMe(r as PlayerMe);
    };
    void tick();
    const id = window.setInterval(tick, 10000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [authed]);
  return me;
}

const LIVE_RENDER_INTERVAL_MS = 50;

function useLive(authed: boolean): LiveFrame | null {
  const [live, setLive] = useState<LiveFrame | null>(null);
  useEffect(() => {
    if (!authed) {
      setLive(null);
      return;
    }
    let pending: LiveFrame | null = null;
    let flushTimer: number | null = null;
    const flush = () => {
      flushTimer = null;
      if (!pending) return;
      const next = pending;
      pending = null;
      setLive(next);
    };
    // No stale-clears-to-null timeout here on purpose: a brief gap between
    // live frames (a network hiccup, or this process itself getting starved
    // of CPU for a moment by a demanding game) used to flash "NO SIGNAL" /
    // blank stats and drop the last known position, even though the data
    // was still perfectly good. Keep showing the last known frame until a
    // genuinely new one arrives to replace it, instead of clearing on a
    // timer.
    const off = window.isleOverlay.onLive((d) => {
      pending = d;
      if (flushTimer == null) flushTimer = window.setTimeout(flush, LIVE_RENDER_INTERVAL_MS);
    });
    return () => {
      off();
      if (flushTimer != null) window.clearTimeout(flushTimer);
    };
  }, [authed]);
  return live;
}

function useServerStatus(enabled: boolean): ServerStatus | null {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const next = await window.isleOverlay.getServerStatus();
      if (alive) setStatus(next);
    };
    void tick();
    const id = window.setInterval(tick, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled]);
  return status;
}

function mergeLive(me: PlayerMe | null, live: LiveFrame | null): PlayerMe | null {
  if (!live || !live.hasDino) return me;
  const base: PlayerMe = me ?? { hasData: true, steamId: live.steamId, name: "" };
  return {
    ...base,
    hasData: true,
    online: true,
    growth: live.growth ?? base.growth,
    health: live.health ?? base.health,
    maxHealth: live.maxHealth ?? base.maxHealth,
    hunger: live.hunger ?? base.hunger,
    maxHunger: live.maxHunger ?? base.maxHunger,
    thirst: live.thirst ?? base.thirst,
    maxThirst: live.maxThirst ?? base.maxThirst,
    stamina: live.stamina ?? base.stamina,
    maxStamina: live.maxStamina ?? base.maxStamina,
    nutrition: live.nutrition ?? base.nutrition,
  };
}

export function App() {
  const [auth, setAuth] = useState<AuthInfo>({ steamId: null, authed: false });
  const [state, setState] = useState<OverlayState>({ gameDetected: false, active: false });
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [panels, setPanels] = useState<Record<string, boolean>>({ heart: true, compass: true, server: true });
  const [theme, setThemeState] = useState<OverlayTheme>(DEFAULT_THEME);
  const [blocked, setBlocked] = useState(false);
  const [hudEditMode, setHudEditMode] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const fullMapOpenRef = useRef(false);
  useEffect(() => {
    fullMapOpenRef.current = fullMapOpen;
  }, [fullMapOpen]);
  const mounted = useRef(false);
  const language = settings?.language ?? "en";
  const t = (text: string) => tr(language, text);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // TEMP DIAGNOSTIC: repeated rounds of map-specific optimization (memoizing
  // POI arrays, deferring labels/icons, viewport culling) haven't actually
  // changed how laggy this feels, which means the working assumption — that
  // the map's own rendering is what these long tasks are — was never
  // actually verified, just inferred from two separate log lines landing
  // close together in time. Logging whether the map is even open (and
  // whether cursor/click-through mode is active) at the exact moment each
  // long task fires settles that directly instead of continuing to guess.
  // Remove alongside the other TEMP DIAGNOSTIC code once found.
  useEffect(() => {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 150) {
            void window.isleOverlay.debugLog(
              `[longtask] +${Math.round(entry.duration)}ms name=${entry.name} mapOpen=${fullMapOpenRef.current} mapInteracting=${mapInteractingNow} hidden=${document.hidden}`,
            );
          }
        }
      });
      po.observe({ entryTypes: ["longtask"] });
      return () => po.disconnect();
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    const off = window.isleOverlay.onBlocked((b) => setBlocked(b));
    return off;
  }, []);

  useEffect(() => {
    const off = window.isleOverlay.onHudEdit(setHudEditMode);
    return off;
  }, []);

  useEffect(() => {
    // TEMP DIAGNOSTIC: report back to the main process once this state
    // change has actually been painted (two rAFs = after the browser's next
    // compositor frame), so the full main-process-to-pixels time shows up in
    // the `npm run dev` terminal. Remove alongside main.cjs's mapTimingLog.
    const off = window.isleOverlay.onFullMap((open, t0) => {
      setFullMapOpen(open);
      if (typeof t0 === "number") {
        requestAnimationFrame(() => requestAnimationFrame(() => void window.isleOverlay.debugMapPainted(t0)));
      }
    });
    return off;
  }, []);

  useEffect(() => {
    const off = window.isleOverlay.onCursor((on) => {
      cursorLatched = on;
      if (on) void window.isleOverlay.setMouseIgnore(false);
    });
    return off;
  }, []);

  useAutoInteract();
  const me = useMe(auth.authed);
  const live = useLive(auth.authed);
  const serverStatus = useServerStatus(
    auth.authed && panels.server !== false && settings?.serverInfoEnabled === true,
  );
  const view = useMemo(() => mergeLive(me, live), [me, live]);
  const dinoPresent = live ? live.hasDino : Boolean(me?.online && me?.species);
  const isDino = dinoPresent && !(typeof view?.health === "number" && view.health <= 0);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void window.isleOverlay.getSettings().then((s) => {
      setSettings(s);
      if (s.panels) setPanels((prev) => ({ ...prev, ...s.panels }));
      if (s.theme) {
        setThemeState(s.theme);
        applyTheme(s.theme);
      }
    });
    void window.isleOverlay.getAuth().then(setAuth);
    void window.isleOverlay.getState().then(setState);
    const offState = window.isleOverlay.onState(setState);
    const offAuth = window.isleOverlay.onAuthChanged(() => window.isleOverlay.getAuth().then(setAuth));
    const offSettings = window.isleOverlay.onSettingsChanged((s) => {
      setSettings(s);
      if (s.panels) setPanels((prev) => ({ ...prev, ...s.panels }));
    });
    return () => {
      offState();
      offAuth();
      offSettings();
    };
  }, []);

  const login = useCallback(() => void window.isleOverlay.steamLogin(), []);

  if (blocked) return null;

  if ((settings?.streamerMode ?? false) && state.focused === false) {
    return (
      <div className="overlay">
        <div className="streamerBox">
          <div className="streamerBoxTitle">{t("Streaming")}</div>
          <div className="streamerBoxHint">
            {[settings?.serverName ?? "TheIsleHud", settings?.overlayLabel].filter(Boolean).join(" ")} · {t("Makes the overlay a normal capturable window for OBS Window Capture.")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`overlay ${settings?.hudTransparent ? "hudTransparent" : ""} ${hudEditMode ? "hudEditMode" : ""}`}>
      <TrollLayer />

      {auth.authed && settings?.serverInfoEnabled && panels.server !== false && view ? (
        <DraggablePanel
          id="w_server"
          defaultPos={{ x: Math.max(12, window.innerWidth - 292), y: 72 }}
          settings={settings}
          resizeLabel={t("Resize HUD")}
        >
          <ServerInfoWidget me={view} status={serverStatus} language={language} />
        </DraggablePanel>
      ) : null}

      {auth.authed && panels.compass && isDino ? (
        <DraggablePanel
          id="w_compass"
          defaultPos={{ x: Math.max(0, window.innerWidth / 2 - 360), y: 18 }}
          settings={settings}
          resizeLabel={t("Resize HUD")}
        >
          <CompassWidget
            live={live}
            language={language}
            tracking={settings?.mapTracking ?? DEFAULT_MAP_TRACKING}
          />
        </DraggablePanel>
      ) : null}

      {auth.authed && panels.stats && isDino ? (
        <DraggablePanel id="w_stats" defaultPos={{ x: 18, y: 240 }} settings={settings} resizeLabel={t("Resize HUD")}>
          <StatsWidget
            me={view}
            theme={theme}
            styleMode={settings?.statsStyle ?? "bars"}
            language={language}
          />
        </DraggablePanel>
      ) : null}

      {auth.authed && panels.prime && isDino ? (
        <DraggablePanel id="w_prime" defaultPos={{ x: 18, y: 470 }} settings={settings} resizeLabel={t("Resize HUD")}>
          <PrimePanel me={view} language={language} />
        </DraggablePanel>
      ) : null}

      {auth.authed && panels.heart && isDino ? (
        <DraggablePanel
          id="w_heart"
          defaultPos={{
            x: Math.max(0, window.innerWidth - window.innerHeight * 0.2),
            y: Math.max(0, window.innerHeight - window.innerHeight * 0.3),
          }}
          settings={settings}
          resizeLabel={t("Resize HUD")}
        >
          <HeartHud me={view} color={theme.heart} />
        </DraggablePanel>
      ) : null}

      {auth.authed && panels.radar ? (
        <DraggablePanel id="w_radar" defaultPos={{ x: 18, y: 60 }} settings={settings} resizeLabel={t("Resize HUD")}>
          <RadarPanel
            live={live}
            base={(settings?.apiBaseUrl ?? "https://islepilot.eu").replace(/\/+$/, "")}
            rangeIdx={Math.max(0, Math.min(3, settings?.radarRange ?? 1))}
            showLabels={settings?.radarLabels ?? false}
            tracking={settings?.mapTracking ?? DEFAULT_MAP_TRACKING}
            shape={settings?.radarShape ?? "circle"}
            diameter={Math.max(140, Math.min(560, settings?.radarSize ?? 320))}
          />
        </DraggablePanel>
      ) : null}

      <TileWarmer />
      <FullMapOverlay
        open={fullMapOpen}
        onClose={() => void window.isleOverlay.fullMap.toggle()}
        authed={auth.authed}
        onLogin={login}
      />
    </div>
  );
}
