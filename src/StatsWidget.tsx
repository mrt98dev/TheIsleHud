import type { ReactNode } from "react";
import { tr, type AppLanguage } from "./i18n";
import type { OverlayTheme, PlayerMe } from "./preload";

const STAT_ICONS: Record<string, ReactNode> = {
  health: <path d="M12 20.5s-7-4.2-9.2-8.3C1.3 9 2.7 5.6 6 5.6c2 0 3.2 1.2 4 2.6.8-1.4 2-2.6 4-2.6 3.3 0 4.7 3.4 3.2 6.6C19 16.3 12 20.5 12 20.5Z" />,
  stamina: <path d="M13 2 4 13.5h6L9 22l9-11.5h-6L13 2Z" />,
  hunger: (
    <>
      <path d="M15.5 6.5a4 4 0 0 0-7 2.5c0 1.2-.7 1.8-1.5 2.6a3 3 0 1 0 4.2 4.2c.8-.8 1.4-1.5 2.6-1.5a4 4 0 0 0 1.7-7.8Z" />
    </>
  ),
  thirst: <path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3Z" />,
  growth: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-2.8 2.2-5 5-5 0 2.8-2.2 5-5 5Z" />
      <path d="M12 14c0-2.2-1.8-4-4-4 0 2.2 1.8 4 4 4Z" />
    </>
  ),
};

export function StatGlyph({ name }: { name: string }) {
  const fill = name === "health" || name === "thirst";
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={fill ? 0 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {STAT_ICONS[name]}
    </svg>
  );
}

function MiniStat({
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
    <div className="miniStat" style={{ ["--c" as string]: color }}>
      <div className="hudTop">
        <span className="hudIcon">
          <StatGlyph name={icon} />
        </span>
        <span className="hudLabel">{label}</span>
        <span className="hudVal">{shown != null ? `${shown}${suffix}` : "—"}</span>
      </div>
      <div className="vitalTrack">
        <div className="vitalFill" style={{ width: pct != null ? `${pct}%` : "0%" }} />
      </div>
    </div>
  );
}

function CircularStat({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value?: number | null;
  max?: number | null;
  color: string;
}) {
  const v = typeof value === "number" ? value : null;
  const m = typeof max === "number" && max > 0 ? max : null;
  const pct = v != null && m != null ? Math.max(0, Math.min(100, (v / m) * 100)) : null;
  const shown = pct != null ? Math.round(pct) : v != null ? Math.round(v) : null;
  return (
    <div className="circleStat" style={{ ["--c" as string]: color }} aria-label={`${label} ${shown ?? 0}%`}>
      <div className="circleGauge">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <circle className="circleTrack" cx="30" cy="30" r="25" pathLength="100" />
          <circle className="circleFill" cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${pct ?? 0} 100`} />
        </svg>
        <span>{shown != null ? `${shown}%` : "—"}</span>
      </div>
      <div className="circleLabel">{label}</div>
    </div>
  );
}

export function StatsWidget({
  me,
  theme,
  styleMode = "bars",
  language = "en",
}: {
  me: PlayerMe | null;
  theme: OverlayTheme;
  styleMode?: "bars" | "circles";
  language?: AppLanguage;
}) {
  const t = (text: string) => tr(language, text);
  if (styleMode === "circles") {
    return (
      <div className="hud circularStats dragHandle">
        {me?.hasData ? (
          <>
            <CircularStat label={t("Growth")} value={me.growth != null ? me.growth * 100 : null} max={100} color="#4ade80" />
            <CircularStat label={t("Health")} value={me.health} max={me.maxHealth} color={theme.stat.health} />
            <CircularStat label={t("Hunger")} value={me.hunger} max={me.maxHunger} color={theme.stat.food} />
            <CircularStat label={t("Thirst")} value={me.thirst} max={me.maxThirst} color={theme.stat.water} />
            <CircularStat label={t("Stamina")} value={me.stamina} max={me.maxStamina} color={theme.stat.stamina} />
          </>
        ) : (
          <div className="hudEmpty">{t("No live dino")}</div>
        )}
      </div>
    );
  }
  return (
    <div className="hud statsWidget dragHandle">
      <div className="hudTitle">
        <span className="hudTitleName">{me?.hasData && me.species ? me.species : t("Stats")}</span>
        {me?.growth != null ? (
          <span className="hudTitleBadge">{Math.round(me.growth * 100)}%</span>
        ) : null}
      </div>
      {me?.hasData ? (
        <>
          <MiniStat icon="health" label={t("Health")} value={me.health} max={me.maxHealth} color={theme.stat.health} />
          <MiniStat icon="stamina" label={t("Stamina")} value={me.stamina} max={me.maxStamina} color={theme.stat.stamina} />
          <MiniStat icon="hunger" label={t("Hunger")} value={me.hunger} max={me.maxHunger} color={theme.stat.food} />
          <MiniStat icon="thirst" label={t("Thirst")} value={me.thirst} max={me.maxThirst} color={theme.stat.water} />
          <MiniStat icon="growth" label={t("Growth")} value={me.growth != null ? me.growth * 100 : null} max={100} color="#4ade80" />
        </>
      ) : (
        <div className="hudEmpty">{t("No live dino")}</div>
      )}
    </div>
  );
}
