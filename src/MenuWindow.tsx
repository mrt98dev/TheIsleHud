import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AdminTab } from "./AdminTab";
import { ColorSwatch } from "./ColorPicker";
import { DinoShopTab } from "./DinoShopTab";
import { GarageTab } from "./GarageTab";
import { LiveMapTab } from "./LiveMapTab";
import { MapEditorTab } from "./MapEditorTab";
import { SkinEditorTab } from "./SkinEditorTab";
import { SkinShopTab } from "./SkinShopTab";
import { StatGlyph } from "./StatsWidget";
import { tr, translatePrimeQuest, type AppLanguage } from "./i18n";
import {
  DEFAULT_MAP_TRACKING,
  type MapTrackingKey,
  type MapTrackingSettings,
} from "./map-tracking";
import type {
  AuthInfo,
  LiveFrame,
  OverlaySettings,
  OverlayState,
  OverlayTheme,
  PlayerMe,
} from "./preload";

const DEFAULT_THEME: OverlayTheme = {
  accent: "#7cf2a6",
  stat: { health: "#ff5a5a", stamina: "#35d6a4", food: "#ffb454", water: "#5ab6ff" },
};

const VN_HUD_THEME: OverlayTheme = {
  accent: "#ff7a3c",
  stat: { health: "#ff5148", stamina: "#ffb638", food: "#8bd44f", water: "#49b6ff" },
};

function applyTheme(t: OverlayTheme) {
  const r = document.documentElement.style;
  r.setProperty("--phos", t.accent);
  r.setProperty("--edge", t.accent + "2e");
  r.setProperty("--phos-dim", t.accent + "77");
}

function BootScreen({ onDone, serverName, overlayLabel }: { onDone: () => void; serverName: string; overlayLabel: string }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1000);
    const t2 = window.setTimeout(() => doneRef.current(), 1400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  return (
    <div className={`boot ${leaving ? "leaving" : ""}`}>
      <div className="bootMark" role="status" aria-live="polite" aria-label={`${serverName} đang khởi động`}>
        <img className="bootBackdropLogo" src="./icon.png" alt="" aria-hidden="true" />
        <div className="bootContent">
          <div className="bootEyebrow">THE ISLE VIETNAM HUD</div>
          <div className="bootLogo">
            {serverName}
          </div>
          <div className="bootSub">{overlayLabel ? `${overlayLabel.toUpperCase()} · ` : ""}v{__APP_VERSION__}</div>
          <div className="bootBar" aria-hidden="true">
            <div className="bootBarFill" />
          </div>
          <div className="bootCredit">Coded by mrt98dev</div>
        </div>
      </div>
    </div>
  );
}

export type TabKey = "profile" | "livemap" | "skin" | "garage" | "mapedit" | "dinoshop" | "skinshop" | "admin";

const TABS: { key: TabKey; label: string; ready?: boolean }[] = [
  { key: "profile", label: "Dashboard", ready: true },
  { key: "livemap", label: "Live Map", ready: true },
  { key: "skin", label: "Skin Editor", ready: true },
  { key: "garage", label: "Garage", ready: true },
  { key: "dinoshop", label: "Dino Shop", ready: true },
  { key: "skinshop", label: "Skin Shop", ready: true },
  { key: "admin", label: "Support", ready: true },
  { key: "mapedit", label: "Map Editor", ready: true },
];

const TAB_ICONS: Record<TabKey, ReactNode> = {
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  livemap: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </>
  ),
  skin: (
    <>
      <circle cx="13.5" cy="6.5" r="1.3" />
      <circle cx="17.5" cy="10.5" r="1.3" />
      <circle cx="8.5" cy="7.5" r="1.3" />
      <circle cx="6.5" cy="12.5" r="1.3" />
      <path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.4a5 5 0 0 0 5-5 8 8 0 0 0-8-8Z" />
    </>
  ),
  garage: (
    <>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 21h18" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  mapedit: (
    <>
      <path d="M12 2 3 7l9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>
  ),
  dinoshop: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  skinshop: (
    <>
      <path d="M20.4 6.5 16 4a2.2 2.2 0 0 1-4 0 2.2 2.2 0 0 1-4 0L3.6 6.5l2 3.6L8 9v11h8V9l2.4 1.1Z" />
    </>
  ),
  admin: (
    <>
      <path d="M12 2 4 5v6c0 4.4 3.1 8.1 8 9 4.9-.9 8-4.6 8-9V5l-8-3Z" />
      <path d="M9 11.5 11 13.5 15 9.5" />
    </>
  ),
};

function TabIcon({ name }: { name: TabKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TAB_ICONS[name]}
    </svg>
  );
}

function VitalBar({
  icon,
  label,
  value,
  max,
  color,
  suffix = "%",
}: {
  icon: string;
  label: string;
  value?: number | null;
  max?: number | null;
  color: string;
  suffix?: string;
}) {
  const v = typeof value === "number" ? value : null;
  const m = typeof max === "number" && max > 0 ? max : null;
  const pct = v != null && m != null ? Math.max(0, Math.min(100, (v / m) * 100)) : null;
  const shown = pct != null ? Math.round(pct) : v != null ? Math.round(v) : null;
  return (
    <div className="vital" style={{ ["--c" as string]: color }}>
      <div className="vitalHead">
        <span className="vitalIcon">
          <StatGlyph name={icon} />
        </span>
        <span className="vitalName">{label}</span>
        <span className="vitalVal">{shown != null ? `${shown}${suffix}` : "—"}</span>
      </div>
      <div className="vitalTrack">
        <div className="vitalFill" style={{ width: pct != null ? `${pct}%` : "0%" }} />
      </div>
    </div>
  );
}

function NutBar({ label, value, color }: { label: string; value?: number | null; color: string }) {
  const v = typeof value === "number" ? value : null;
  const pct = v != null ? Math.max(4, Math.min(100, (v / 5000) * 100)) : null;
  return (
    <div className="vital" style={{ ["--c" as string]: color }}>
      <div className="vitalHead">
        <span className="vitalName">{label}</span>
        <span className="vitalVal mono">{v != null ? v.toFixed(1) : "—"}</span>
      </div>
      <div className="vitalTrack">
        <div className="vitalFill" style={{ width: pct != null ? `${pct}%` : "0%" }} />
      </div>
    </div>
  );
}

function dinoStage(me: PlayerMe, language: AppLanguage): string {
  if (me.prime?.elder) return "Prime Elder";
  const g = me.growth ?? 0;
  if (g >= 0.99) return tr(language, "Adult");
  if (g >= 0.5) return tr(language, "Sub-Adult");
  if (g >= 0.25) return tr(language, "Juvenile");
  return tr(language, "Hatchling");
}

const GROWTH_COLOR = "#4ade80";

function CheckMark({ done }: { done: boolean }) {
  return (
    <span className={`mark ${done ? "ok" : "no"}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {done ? <path d="m5 12 5 5 9-10" /> : <path d="M6 6l12 12M18 6 6 18" />}
      </svg>
    </span>
  );
}

function DashboardTab({
  me,
  theme,
  onGoto,
  supportOn,
  language,
}: {
  me: PlayerMe | null;
  theme: OverlayTheme;
  onGoto: (t: TabKey) => void;
  supportOn: boolean;
  language: AppLanguage;
}) {
  const t = (text: string) => tr(language, text);
  const supportBtn = supportOn ? (
    <button className="supportBtn interactive-region" onClick={() => onGoto("admin")}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
      </svg>
      {t("Support")}
    </button>
  ) : null;
  if (!me?.hasData) {
    return (
      <div className="noData">
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" />
          <path d="M12 12 21 7M12 12v10M12 12 3 7" />
        </svg>
        <div className="noDataTtl">{t("No live dino")}</div>
        <div className="noDataSub">{t("No live dino available.")}</div>
        {supportBtn}
      </div>
    );
  }
  const p = me.prime;
  const primePct = p ? Math.max(0, Math.min(100, (p.done / Math.max(1, p.required)) * 100)) : 0;
  const initial = (me.species ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="dash">
      <div className="idCard">
        <div className="avatar">
          <span className="avatarInitial">{initial}</span>
        </div>
        <div className="idMeta">
          <div className="dinoLine">
            <span className="dinoName">{me.species ?? "Unknown"}</span>
            {me.female != null ? (
              <span className={`gender ${me.female ? "f" : "m"}`}>{me.female ? "♀" : "♂"}</span>
            ) : null}
          </div>
          <div className="idRow">
            <span className="idKey">{t("Stage")}</span>
            <span className="idVal">{dinoStage(me, language)}</span>
          </div>
          <div className="idRow">
            <span className="idKey">{t("Server")}</span>
            <span className="idVal">{me.server ?? "—"}</span>
          </div>
          <div className="idRow">
            <span className="idKey">SteamID</span>
            <span className="idVal mono">{me.steamId}</span>
          </div>
        </div>
      </div>

      {supportBtn}

      <div className="sectionHead">{t("Vitals")}</div>
      <div className="vGrid">
        <VitalBar icon="health" label={t("Health")} value={me.health} max={me.maxHealth} color={theme.stat.health} />
        <VitalBar icon="hunger" label={t("Hunger")} value={me.hunger} max={me.maxHunger} color={theme.stat.food} />
        <VitalBar icon="thirst" label={t("Thirst")} value={me.thirst} max={me.maxThirst} color={theme.stat.water} />
        <VitalBar icon="stamina" label={t("Stamina")} value={me.stamina} max={me.maxStamina} color={theme.stat.stamina} />
        <VitalBar icon="growth" label={t("Growth")} value={me.growth != null ? me.growth * 100 : null} max={100} color={GROWTH_COLOR} />
      </div>

      {me.nutrition ? (
        <>
          <div className="sectionHead">{t("Nutrition")}</div>
          <div className="vGrid nut">
            <NutBar label={t("Carb")} value={me.nutrition.carb} color="#e0a94b" />
            <NutBar label={t("Protein")} value={me.nutrition.protein} color="#66c26a" />
            <NutBar label={t("Lipid")} value={me.nutrition.lipid} color="#d7b35a" />
          </div>
        </>
      ) : null}

      {p ? (
        <>
          <div className="sectionHead">
            {t("Prime Conditions")}
            <span className="sectionCount">
              {p.done}/{p.required}
            </span>
          </div>
          <div className="primeWrap">
            <div className="primeTrack">
              <div className="primeFill" style={{ width: `${primePct}%` }} />
            </div>
            {p.elder ? (
              <div className="primeElder">
                <CheckMark done /> {t("Prime Elder reached")}
              </div>
            ) : (
              <ul className="condList">
                {p.quests.map((q, i) => (
                  <li key={i} className={q.done ? "condDone" : "condOpen"}>
                    <CheckMark done={q.done} />
                    <span>{translatePrimeQuest(language, q.name)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      <div className="sectionHead">{t("Add-ons")}</div>
      <div className="addons">
        <button className="addon" onClick={() => onGoto("livemap")}>
          <TabIcon name="livemap" /> {t("Live Map")}
        </button>
        <button className="addon" onClick={() => onGoto("skin")}>
          <TabIcon name="skin" /> {t("Skin Editor")}
        </button>
      </div>
    </div>
  );
}

const PANELS: { key: string; label: string; soon?: boolean }[] = [
  { key: "server", label: "Server info" },
  { key: "compass", label: "Compass" },
  { key: "stats", label: "Stats" },
  { key: "prime", label: "PRIME" },
  { key: "heart", label: "HP Heart" },
  { key: "radar", label: "Radar" },
];

const TRACKING_OPTIONS: Array<{ key: MapTrackingKey; label: string; color: string }> = [
  { key: "sanctuaries", label: "Sanctuaries", color: "#79f2a6" },
  { key: "migration", label: "Migration zones", color: "#ffce54" },
  { key: "patrol", label: "Patrol zones", color: "#5ab6ff" },
  { key: "places", label: "Other places", color: "#b79cff" },
  { key: "friends", label: "Friends", color: "#7cf2a6" },
];

const CURSOR_KEYS = ["Insert", "Home", "End", "PageUp", "PageDown", "Delete", "CapsLock", "Backquote", "F6", "F7", "F8", "F9", "F10"];
const MAP_KEYS = ["M", "N", "Tab", "Insert", "Home", "End", "PageUp", "PageDown", "F6", "F7"];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="colorRow">
      <span>{label}</span>
      <ColorSwatch value={value} onChange={onChange} size={22} />
      <code>{value}</code>
    </div>
  );
}

function SettingsPanel({
  settings,
  theme,
  panels,
  opacity,
  authed,
  gameDetected,
  onTheme,
  onOpacity,
  onTogglePanel,
  onLogout,
  onQuit,
  onClose,
}: {
  settings: OverlaySettings | null;
  theme: OverlayTheme;
  panels: Record<string, boolean>;
  opacity: number;
  authed: boolean;
  gameDetected: boolean;
  onTheme: (t: OverlayTheme) => void;
  onOpacity: (v: number) => void;
  onTogglePanel: (k: string) => void;
  onLogout: () => void;
  onQuit: () => void;
  onClose: () => void;
}) {
  const setStat = (k: keyof OverlayTheme["stat"], v: string) =>
    onTheme({ ...theme, stat: { ...theme.stat, [k]: v } });
  const radarOpen = Boolean(panels.radar);
  const toggleRadar = () => onTogglePanel("radar");
  const [radarSize, setRadarSize] = useState(settings?.radarSize ?? 320);
  const [radarRange, setRadarRange] = useState(settings?.radarRange ?? 1);
  const [radarLabels, setRadarLabels] = useState(settings?.radarLabels ?? false);
  const [mapTracking, setMapTracking] = useState<MapTrackingSettings>(
    settings?.mapTracking ?? DEFAULT_MAP_TRACKING,
  );
  const [radarShape, setRadarShape] = useState<"circle" | "square">(settings?.radarShape ?? "circle");
  const RANGE_LABELS = ["CLOSE", "MID", "FAR", "MAX"];
  const [cursorEnabled, setCursorEnabled] = useState(settings?.cursorEnabled ?? false);
  const [cursorKey, setCursorKey] = useState(settings?.cursorKey ?? "Insert");
  const [cursorMode, setCursorMode] = useState(settings?.cursorMode ?? "toggle");
  const [recording, setRecording] = useState(false);
  const [mapKey, setMapKey] = useState(settings?.mapKey ?? "M");
  const [recordingMap, setRecordingMap] = useState(false);
  const [hudEditMode, setHudEditMode] = useState(false);
  async function recordCursorKey() {
    setRecording(true);
    const k = await window.isleOverlay.recordCursorKey();
    setRecording(false);
    if (k) setCursorKey(k);
  }
  async function recordMapKey() {
    setRecordingMap(true);
    const k = await window.isleOverlay.map.recordKey();
    setRecordingMap(false);
    if (k) setMapKey(k);
  }
  const SETTINGS_CATS = [
    { key: "widgets", label: "Widgets" },
    { key: "radar", label: "Radar" },
    { key: "controls", label: "Controls" },
    { key: "streaming", label: "Streaming" },
    { key: "appearance", label: "Appearance" },
    { key: "account", label: "Account" },
  ];
  const [cat, setCat] = useState("widgets");
  const [streamerMode, setStreamerMode] = useState(settings?.streamerMode ?? false);
  const [compatMode, setCompatMode] = useState(settings?.compatMode ?? false);
  const [language, setLanguage] = useState<AppLanguage>(settings?.language ?? "en");
  const [statsStyle, setStatsStyle] = useState<"bars" | "circles">(settings?.statsStyle ?? "bars");
  const [hudTransparent, setHudTransparent] = useState(settings?.hudTransparent ?? false);
  const t = (text: string) => tr(language, text);
  useEffect(() => {
    void window.isleOverlay.getSettings().then((s) => {
      setStreamerMode(Boolean(s.streamerMode));
      setCompatMode(Boolean(s.compatMode));
      setLanguage(s.language);
      setStatsStyle(s.statsStyle);
      setHudTransparent(Boolean(s.hudTransparent));
      setMapTracking(s.mapTracking ?? DEFAULT_MAP_TRACKING);
      setMapKey(s.mapKey ?? "M");
    });
  }, []);
  useEffect(() => window.isleOverlay.onHudEdit(setHudEditMode), []);

  return (
    <div className="settingsBackdrop interactive-region" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="frame settingsFrame">
        <div className="frameBar">
          <span className="dot" />
          <span className="ttl">{t("Settings").toUpperCase()}</span>
          <button className="xbtn" onClick={onClose}>✕</button>
        </div>
        <div className="settingsLayout">
          <div className="settingsRail">
            {SETTINGS_CATS.map((c) => (
              <button
                key={c.key}
                className={`settingsRailBtn ${cat === c.key ? "on" : ""}`}
                onClick={() => setCat(c.key)}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <div className="settingsContent">
          {cat === "widgets" && (<>
          <div className="secLabel">{t("Detached widgets")}</div>
          <div className="hint">{t("Enable widgets, drag them anywhere, and resize them from the bottom-right corner.")}</div>

          <div className="secLabel">{t("Edit HUD layout")}</div>
          <div className="hint">{t("Turn this on to drag and resize overlay widgets in-game; turn it off to click through the overlay again.")}</div>
          {!gameDetected ? (
            <div className="hint">{t("Requires The Isle to be running.")}</div>
          ) : null}
          <div className="featRow">
            <button
              className={`chip ${hudEditMode ? "on" : ""}`}
              disabled={!gameDetected}
              onClick={() => void window.isleOverlay.hudEdit.set(!hudEditMode)}
            >
              {hudEditMode ? "ON" : "OFF"}
            </button>
          </div>

          <div className="featRow">
            {PANELS.filter((p) => p.key !== "server" || settings?.serverInfoEnabled).map((p) => (
              <button
                key={p.key}
                className={`chip ${panels[p.key] ? "on" : ""}`}
                onClick={() => onTogglePanel(p.key)}
              >
                {t(p.label).toUpperCase()}
              </button>
            ))}
          </div>

          </>)}
          {cat === "radar" && (<>
          <div className="secLabel">{t("Live radar")}</div>
          <div className="hint">{t("A floating minimap that follows you in-game. Drag it to move it.")}</div>
          <button className={`radarToggle ${radarOpen ? "on" : ""}`} onClick={toggleRadar}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" strokeWidth="1" opacity="0.5" />
              <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
            </svg>
            {t(radarOpen ? "Close radar" : "Open radar")}
          </button>

          <div className="hint" style={{ marginTop: 6 }}>{t("Size")} · {radarSize}px</div>
          <input
            className="range"
            type="range"
            min={180}
            max={520}
            step={10}
            value={radarSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRadarSize(v);
              void window.isleOverlay.setSettings({ radarSize: v });
            }}
          />

          <div className="hint" style={{ marginTop: 6 }}>{t("Range")}</div>
          <div className="featRow">
            {RANGE_LABELS.map((lbl, i) => (
              <button
                key={lbl}
                className={`chip ${radarRange === i ? "on" : ""}`}
                onClick={() => {
                  setRadarRange(i);
                  void window.isleOverlay.setSettings({ radarRange: i });
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="secLabel">{t("Stats layout")}</div>
          <div className="featRow">
            {(["bars", "circles"] as const).map((style) => (
              <button
                key={style}
                className={`chip ${statsStyle === style ? "on" : ""}`}
                aria-pressed={statsStyle === style}
                onClick={() => {
                  setStatsStyle(style);
                  void window.isleOverlay.setSettings({ statsStyle: style });
                }}
              >
                {t(style === "bars" ? "Bars" : "Circles").toUpperCase()}
              </button>
            ))}
          </div>

          <div className="secLabel">{t("HUD background")}</div>
          <div className="hint">{t("Choose a solid panel or remove the background behind floating HUD widgets.")}</div>
          <div className="featRow">
            {([false, true] as const).map((transparent) => (
              <button
                key={String(transparent)}
                className={`chip ${hudTransparent === transparent ? "on" : ""}`}
                aria-pressed={hudTransparent === transparent}
                onClick={() => {
                  setHudTransparent(transparent);
                  void window.isleOverlay.setSettings({ hudTransparent: transparent });
                }}
              >
                {t(transparent ? "Transparent" : "Default").toUpperCase()}
              </button>
            ))}
          </div>

          <div className="hint" style={{ marginTop: 6 }}>{t("Shape")}</div>
          <div className="featRow">
            {(["circle", "square"] as const).map((shape) => (
              <button
                key={shape}
                className={`chip ${radarShape === shape ? "on" : ""}`}
                aria-pressed={radarShape === shape}
                onClick={() => {
                  setRadarShape(shape);
                  void window.isleOverlay.setSettings({ radarShape: shape });
                }}
              >
                {t(shape === "circle" ? "Circle" : "Square").toUpperCase()}
              </button>
            ))}
          </div>

          <div className="featRow" style={{ marginTop: 6 }}>
            <button
              className={`chip ${radarLabels ? "on" : ""}`}
              onClick={() => {
                const v = !radarLabels;
                setRadarLabels(v);
                void window.isleOverlay.setSettings({ radarLabels: v });
              }}
            >
              {t("Labels").toUpperCase()}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>{t("Shows names for places and markers on the minimap.")}</div>

          <div className="secLabel">{t("Tracked map items")}</div>
          <div className="hint">{t("These filters are shared by the radar and compass.")}</div>
          <div className="trackingGrid">
            <button
              type="button"
              className={`trackingChip ${Object.values(mapTracking).every(Boolean) ? "on" : ""}`}
              aria-pressed={Object.values(mapTracking).every(Boolean)}
              onClick={() => {
                const enabled = !Object.values(mapTracking).every(Boolean);
                const next = Object.fromEntries(
                  TRACKING_OPTIONS.map((option) => [option.key, enabled]),
                ) as MapTrackingSettings;
                setMapTracking(next);
                void window.isleOverlay.setSettings({ mapTracking: next });
              }}
            >
              <span className="trackingCheck" aria-hidden="true" />
              <span>{t("All items")}</span>
            </button>
            {TRACKING_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`trackingChip ${mapTracking[option.key] ? "on" : ""}`}
                aria-pressed={mapTracking[option.key]}
                style={{ ["--track-color" as string]: option.color }}
                onClick={() => {
                  const next = { ...mapTracking, [option.key]: !mapTracking[option.key] };
                  setMapTracking(next);
                  void window.isleOverlay.setSettings({ mapTracking: next });
                }}
              >
                <span className="trackingCheck" aria-hidden="true" />
                <span>{t(option.label)}</span>
              </button>
            ))}
          </div>

          </>)}
          {cat === "controls" && (<>
          <div className="secLabel">{t("Cursor")}</div>
          <div className="hint">{t("Press the key to show a mouse cursor and click the overlay.")}</div>
          <div className="featRow">
            <button
              className={`chip ${cursorEnabled ? "on" : ""}`}
              onClick={() => {
                const v = !cursorEnabled;
                setCursorEnabled(v);
                void window.isleOverlay.setSettings({ cursorEnabled: v });
              }}
            >
              {cursorEnabled ? "ON" : "OFF"}
            </button>
            <button
              className={`chip ${cursorMode === "toggle" ? "on" : ""}`}
              onClick={() => {
                setCursorMode("toggle");
                void window.isleOverlay.setSettings({ cursorMode: "toggle" });
              }}
            >
              {t("Toggle").toUpperCase()}
            </button>
            <button
              className={`chip ${cursorMode === "hold" ? "on" : ""}`}
              onClick={() => {
                setCursorMode("hold");
                void window.isleOverlay.setSettings({ cursorMode: "hold" });
              }}
            >
              {t("Hold").toUpperCase()}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>{t("Key")} · {cursorKey}</div>
          <div className="featRow" style={{ flexWrap: "wrap" }}>
            {CURSOR_KEYS.map((k) => (
              <button
                key={k}
                className={`chip ${cursorKey === k ? "on" : ""}`}
                onClick={() => {
                  setCursorKey(k);
                  void window.isleOverlay.setSettings({ cursorKey: k });
                }}
              >
                {k}
              </button>
            ))}
            <button className={`chip ${recording ? "on" : ""}`} onClick={recordCursorKey}>
              {recording ? t("Press key…").toUpperCase() : `+ ${t("Custom").toUpperCase()}`}
            </button>
          </div>

          <div className="secLabel">{t("Map hotkey")}</div>
          <div className="hint">{t("Global shortcut: open the full-screen map while the game has focus.")}</div>
          <div className="hint" style={{ marginTop: 6 }}>{t("Key")} · {mapKey}</div>
          <div className="featRow" style={{ flexWrap: "wrap" }}>
            {MAP_KEYS.map((k) => (
              <button
                key={k}
                className={`chip ${mapKey === k ? "on" : ""}`}
                onClick={() => {
                  setMapKey(k);
                  void window.isleOverlay.setSettings({ mapKey: k });
                }}
              >
                {k}
              </button>
            ))}
            <button className={`chip ${recordingMap ? "on" : ""}`} onClick={recordMapKey}>
              {recordingMap ? t("Press key…").toUpperCase() : `+ ${t("Custom").toUpperCase()}`}
            </button>
          </div>

          </>)}
          {cat === "streaming" && (<>
          <div className="secLabel">{t("OBS / streamer mode")}</div>
          <div className="hint">{t("Makes the overlay a normal capturable window for OBS Window Capture.")}</div>
          <div className="featRow">
            <button
              className={`chip ${streamerMode ? "on" : ""}`}
              onClick={() => {
                const v = !streamerMode;
                setStreamerMode(v);
                void window.isleOverlay.setSettings({ streamerMode: v });
              }}
            >
              {streamerMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {t("Use Windows 10 (1903+) capture. If transparency fails, add a Chroma/Color Key or lower source opacity.")}
          </div>

          </>)}
          {cat === "appearance" && (<>
          <div className="secLabel">{t("Language")}</div>
          <div className="featRow">
            {(["en", "vi"] as const).map((nextLanguage) => (
              <button
                key={nextLanguage}
                className={`chip ${language === nextLanguage ? "on" : ""}`}
                aria-pressed={language === nextLanguage}
                onClick={() => {
                  setLanguage(nextLanguage);
                  void window.isleOverlay.setSettings({ language: nextLanguage, languageExplicit: true });
                }}
              >
                {tr(nextLanguage, nextLanguage === "en" ? "English" : "Vietnamese").toUpperCase()}
              </button>
            ))}
          </div>

          <div className="secLabel">{t("Theme")}</div>
          <div className="presetRow">
            <button className="tbtn ghost" onClick={() => onTheme(DEFAULT_THEME)}>{t("Default")}</button>
            <button className="tbtn ghost" onClick={() => onTheme(VN_HUD_THEME)}>TheIsleHud</button>
          </div>
          <ColorRow label={t("Accent")} value={theme.accent} onChange={(v) => onTheme({ ...theme, accent: v })} />

          <div className="secLabel">{t("Stat colors")}</div>
          <ColorRow label={t("Health")} value={theme.stat.health} onChange={(v) => setStat("health", v)} />
          <ColorRow label={t("Stamina")} value={theme.stat.stamina} onChange={(v) => setStat("stamina", v)} />
          <ColorRow label={t("Hunger")} value={theme.stat.food} onChange={(v) => setStat("food", v)} />
          <ColorRow label={t("Thirst")} value={theme.stat.water} onChange={(v) => setStat("water", v)} />

          <div className="secLabel">{t("Opacity")}</div>
          <input
            className="range"
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
          />

          <div className="secLabel">{t("Compatibility mode")}</div>
          <div className="hint">{t("Use this only when the overlay creates a black background because it has a small performance cost.")}</div>
          <div className="featRow">
            <button
              className={`chip ${compatMode ? "on" : ""}`}
              onClick={() => {
                const v = !compatMode;
                setCompatMode(v);
                void window.isleOverlay.setSettings({ compatMode: v });
              }}
            >
              {compatMode ? "ON" : "OFF"}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 6 }}>
            {t("Restart the overlay for compatibility mode changes to take effect.")}
          </div>

          </>)}
          {cat === "account" && (<>
          <div className="secLabel">{t("Account")}</div>
          <div className="menuFoot">
            {authed ? (
              <button className="tbtn ghost" onClick={onLogout}>
                {t("Logout")}
              </button>
            ) : null}
            <button className="tbtn ghost" onClick={onQuit}>
              {t("Quit overlay")}
            </button>
          </div>
          <div className="secLabel">{t("About")}</div>
          <div className="hint">{[settings?.serverName ?? "TheIsleHud", settings?.overlayLabel].filter(Boolean).join(" ")} · v{__APP_VERSION__}</div>
          <div className="hint">Coded by mrt98dev</div>
          </>)}
          </div>
        </div>
      </div>
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
const LIVE_STALE_MS = 4000;

function useLive(authed: boolean): LiveFrame | null {
  const [live, setLive] = useState<LiveFrame | null>(null);
  useEffect(() => {
    if (!authed) {
      setLive(null);
      return;
    }
    let pending: LiveFrame | null = null;
    let flushTimer: number | null = null;
    let staleTimer: number | null = null;
    const flush = () => {
      flushTimer = null;
      if (!pending) return;
      const next = pending;
      pending = null;
      setLive(next);
      if (staleTimer != null) window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => setLive(null), LIVE_STALE_MS);
    };
    const off = window.isleOverlay.onLive((d) => {
      pending = d;
      if (flushTimer == null) flushTimer = window.setTimeout(flush, LIVE_RENDER_INTERVAL_MS);
    });
    return () => {
      off();
      if (flushTimer != null) window.clearTimeout(flushTimer);
      if (staleTimer != null) window.clearTimeout(staleTimer);
    };
  }, [authed]);
  return live;
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

function MenuShell({
  me,
  theme,
  settings,
  authed,
  ticketUnread,
  ticketUrgent,
  onLogin,
  onSettings,
}: {
  me: PlayerMe | null;
  theme: OverlayTheme;
  settings: OverlaySettings | null;
  authed: boolean;
  ticketUnread: number;
  ticketUrgent: boolean;
  onLogin: () => void;
  onSettings: () => void;
}) {
  const language = settings?.language ?? "en";
  const t = (text: string) => tr(language, text);
  const [tab, setTab] = useState<TabKey>("profile");
  const [mapEditAdmin, setMapEditAdmin] = useState(false);
  const [adminModeOn, setAdminModeOn] = useState(false);

  useEffect(() => {
    if (!authed) {
      setMapEditAdmin(false);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const r = (await window.isleOverlay.apiGet("/api/overlay/mapedit/access")) as
          | { admin?: boolean }
          | null;
        if (alive) setMapEditAdmin(r?.admin === true);
      } catch {
        if (alive) setMapEditAdmin(false);
      }
    };
    void check();
    const iv = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [authed, me?.hasData]);

  useEffect(() => {
    if (!authed) {
      setAdminModeOn(false);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const r = (await window.isleOverlay.apiGet("/api/overlay/admin/access")) as
          | { enabled?: boolean }
          | null;
        if (alive) setAdminModeOn(r?.enabled === true);
      } catch {
        if (alive) setAdminModeOn(false);
      }
    };
    void check();
    const iv = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [authed, me?.hasData]);

  useEffect(() => {
    if (tab === "mapedit" && !mapEditAdmin) setTab("profile");
    if (tab === "admin" && !adminModeOn) setTab("profile");
  }, [tab, mapEditAdmin, adminModeOn]);

  const statusText = me?.hasData
    ? `${me.species ?? "Unknown"}${me.growth != null ? ` · ${Math.round(me.growth * 100)}%` : ""}`
    : authed
    ? t("Not in game")
    : t("Signed out");

  return (
    <div className="mainWin">
      <div className="topbar">
        <span className="brand">
          <svg className="brandMark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 7 16 9.5v5L12 17l-4-2.5v-5L12 7Z" fill="currentColor" />
          </svg>
          <span className="brandName">{settings?.serverName ?? "TheIsleHud"}</span>
          <span className="brandSep">/</span>
          <span className="brandCtx">{t(TABS.find((item) => item.key === tab)?.label ?? "Dashboard")}</span>
        </span>
        <span className="topStatus">
          <span className={`liveDot ${me?.hasData ? "on" : ""}`} />
          {statusText}
        </span>
        {ticketUnread > 0 ? (
          <button
            className={`envelopeBtn interactive-region ${ticketUrgent ? "urgent" : ""}`}
            title={`${ticketUnread} unread ticket ${ticketUnread === 1 ? "message" : "messages"}`}
            onClick={() => setTab("admin")}
          >
            ✉<span className="envelopeCount">{ticketUnread}</span>
          </button>
        ) : null}
        <span className="topVer">v{__APP_VERSION__}</span>
        <button className="iconBtn" onClick={onSettings} title={t("Settings")} aria-label={t("Settings")}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </div>

      {!authed ? (
        <div className="gate">
          <svg className="gateMark" viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M12 7 16 9.5v5L12 17l-4-2.5v-5L12 7Z" fill="currentColor" opacity="0.9" />
          </svg>
          <div className="gateTtl">{t("Sign in to")} {settings?.serverName ?? "TheIsleHud"}</div>
          <div className="gateSub">{t("Log in with Steam to load your dino stats, garage, skins and the live map.")}</div>
          <button className="steamBtn" onClick={onLogin}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-9.9 8.7l5.3 2.2a2.8 2.8 0 0 1 1.6-.5h.1l2.4-3.4v-.1a3.7 3.7 0 1 1 3.7 3.7h-.1l-3.4 2.4v.1a2.8 2.8 0 0 1-5.5.8L2 16.6A10 10 0 1 0 12 2Zm-3.6 15.2-1.2-.5a2.1 2.1 0 0 0 3.9-1 2.1 2.1 0 0 0-2.8-2l1.3.5a1.6 1.6 0 1 1-1.2 3Zm8.8-6.7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {t("Sign in with Steam")}
          </button>
          <div className="gateHint">{t("Opens in your browser")}</div>
        </div>
      ) : (
        <div className="mainBody">
          <div className="tabSidebar">
            {TABS.filter(
              (tabItem) =>
                (tabItem.key !== "mapedit" || mapEditAdmin) && (tabItem.key !== "admin" || adminModeOn),
            ).map((tabItem) => (
              <button
                key={tabItem.key}
                className={`tab ${tab === tabItem.key ? "active" : ""}`}
                onClick={() => setTab(tabItem.key)}
              >
                <TabIcon name={tabItem.key} />
                <span>{tr(language, tabItem.label)}</span>
                {tabItem.key === "admin" && ticketUnread > 0 ? (
                  <span className={`tabBadge ${ticketUrgent ? "urgent" : ""}`}>{ticketUnread}</span>
                ) : null}
                {tabItem.ready ? null : <span className="tabSoon">soon</span>}
              </button>
            ))}
          </div>
          <div className="tabContent">
            {/* Every tab below except Skin Editor (3D, mounted only on demand) stays
                mounted once reached so its data survives switching away and back —
                no refetch, no loading flash on return. */}
            <div style={{ display: tab === "profile" ? "contents" : "none" }}>
              <DashboardTab me={me} theme={theme} onGoto={setTab} supportOn={adminModeOn} language={language} />
            </div>
            <div style={{ display: tab === "livemap" ? "contents" : "none" }}>
              <LiveMapTab authed={authed} onLogin={onLogin} />
            </div>
            {tab === "skin" ? <SkinEditorTab authed={authed} onLogin={onLogin} /> : null}
            <div style={{ display: tab === "garage" ? "contents" : "none" }}>
              <GarageTab authed={authed} onLogin={onLogin} active={tab === "garage"} />
            </div>
            {mapEditAdmin ? (
              <div style={{ display: tab === "mapedit" ? "contents" : "none" }}>
                <MapEditorTab authed={authed} onLogin={onLogin} active={tab === "mapedit"} />
              </div>
            ) : null}
            {adminModeOn ? (
              <div style={{ display: tab === "admin" ? "contents" : "none" }}>
                <AdminTab authed={authed} onLogin={onLogin} />
              </div>
            ) : null}
            <div style={{ display: tab === "dinoshop" ? "contents" : "none" }}>
              <DinoShopTab authed={authed} onLogin={onLogin} active={tab === "dinoshop"} />
            </div>
            <div style={{ display: tab === "skinshop" ? "contents" : "none" }}>
              <SkinShopTab authed={authed} onLogin={onLogin} active={tab === "skinshop"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MenuWindow() {
  const [booted, setBooted] = useState(false);
  const [auth, setAuth] = useState<AuthInfo>({ steamId: null, authed: false });
  const [settings, setSettings] = useState<OverlaySettings | null>(null);
  const [panels, setPanels] = useState<Record<string, boolean>>({ heart: true, compass: true, server: true });
  const [theme, setThemeState] = useState<OverlayTheme>(DEFAULT_THEME);
  const [opacity, setOpacityState] = useState(1);
  const [blocked, setBlocked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketSummary, setTicketSummary] = useState({ unread: 0, urgent: false });
  const [overlayState, setOverlayState] = useState<OverlayState>({ gameDetected: false, active: false });
  const mounted = useRef(false);
  const language = settings?.language ?? "en";
  const t = (text: string) => tr(language, text);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const off = window.isleOverlay.onBlocked((b) => setBlocked(b));
    return off;
  }, []);

  useEffect(() => {
    void window.isleOverlay.getState().then(setOverlayState);
    const off = window.isleOverlay.onState(setOverlayState);
    return off;
  }, []);

  useEffect(() => {
    if (blocked) setSettingsOpen(false);
  }, [blocked]);

  const me = useMe(auth.authed);
  const live = useLive(auth.authed);
  const view = useMemo(() => mergeLive(me, live), [me, live]);

  useEffect(() => {
    if (!auth.authed) {
      setTicketSummary({ unread: 0, urgent: false });
      return;
    }
    let alive = true;
    const tick = async () => {
      const r = (await window.isleOverlay.apiGet("/api/overlay/tickets/summary")) as {
        error?: string;
        unreadTickets?: number;
        hasUrgent?: boolean;
        staff?: { assignedUnread?: number };
      };
      if (!alive || r.error) return;
      const unread = (r.unreadTickets ?? 0) + (r.staff?.assignedUnread ?? 0);
      setTicketSummary({ unread, urgent: r.hasUrgent === true });
    };
    void tick();
    const iv = setInterval(tick, 20000);
    const off = window.isleOverlay.onTicket(() => void tick());
    return () => {
      alive = false;
      clearInterval(iv);
      off();
    };
  }, [auth.authed]);

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
      if (typeof s.opacity === "number") setOpacityState(s.opacity);
    });
    void window.isleOverlay.getAuth().then(setAuth);
    const offAuth = window.isleOverlay.onAuthChanged(() => window.isleOverlay.getAuth().then(setAuth));
    const offSettings = window.isleOverlay.onSettingsChanged((s) => setSettings(s));
    return () => {
      offAuth();
      offSettings();
    };
  }, []);

  const login = useCallback(() => void window.isleOverlay.steamLogin(), []);
  const logout = useCallback(() => void window.isleOverlay.logout(), []);
  const quit = useCallback(() => void window.isleOverlay.quit(), []);
  const togglePanel = useCallback((key: string) => {
    setPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void window.isleOverlay.setSettings({ panels: next });
      return next;
    });
  }, []);
  const setTheme = useCallback((t: OverlayTheme) => {
    setThemeState(t);
    applyTheme(t);
    void window.isleOverlay.setSettings({ theme: t });
  }, []);
  const setOpacity = useCallback((v: number) => {
    setOpacityState(v);
    void window.isleOverlay.setSettings({ opacity: v });
  }, []);

  if (!booted) {
    return (
      <BootScreen
        serverName={settings?.serverName ?? "TheIsleHud"}
        overlayLabel={settings?.overlayLabel ?? ""}
        onDone={() => setBooted(true)}
      />
    );
  }

  return (
    <div className="menuRoot interactive-region">
      <div className="menuTitlebar">
        <span className="menuTitlebarBrand">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M12 7 16 9.5v5L12 17l-4-2.5v-5L12 7Z" fill="currentColor" />
          </svg>
          {settings?.serverName ?? "TheIsleHud"}
        </span>
        <span className="menuTitlebarSpacer" />
        <div className="menuTitlebarBtns">
          <button
            type="button"
            className="menuTitlebarBtn"
            title={t("Minimize")}
            aria-label={t("Minimize")}
            onClick={() => void window.isleOverlay.menu.minimize()}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="menuTitlebarBtn"
            title={t("Maximize")}
            aria-label={t("Maximize")}
            onClick={() => void window.isleOverlay.menu.maximize()}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.3" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="menuTitlebarBtn close"
            title={t("Quit")}
            aria-label={t("Quit")}
            onClick={() => void window.isleOverlay.quit()}
          >
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="menuBody">
        {blocked ? (
          <div className="menuBlocked">☹️</div>
        ) : (
          <MenuShell
            me={view}
            theme={theme}
            settings={settings}
            authed={auth.authed}
            ticketUnread={ticketSummary.unread}
            ticketUrgent={ticketSummary.urgent}
            onLogin={login}
            onSettings={() => setSettingsOpen((v) => !v)}
          />
        )}
      </div>
      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          theme={theme}
          panels={panels}
          opacity={opacity}
          authed={auth.authed}
          gameDetected={overlayState.gameDetected}
          onTheme={setTheme}
          onOpacity={setOpacity}
          onTogglePanel={togglePanel}
          onLogout={logout}
          onQuit={quit}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
