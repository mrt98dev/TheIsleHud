import type { PlayerMe } from "./preload";

const HEX_D = "M26 3 L74 3 L98 44 L74 85 L26 85 L2 44 Z";
const HEART_D =
  "M50 68 C 30 52 22 43 22 33 C 22 25 28 20 35 20 C 41 20 46 24 50 30 C 54 24 59 20 65 20 C 72 20 78 25 78 33 C 78 43 70 52 50 68 Z";
const HEART_TOP = 20;
const HEART_BOTTOM = 68;

export function HeartHud({ me }: { me: PlayerMe | null }) {
  const v = typeof me?.health === "number" ? me.health : null;
  const m = typeof me?.maxHealth === "number" && me.maxHealth > 0 ? me.maxHealth : null;
  const pct = v != null && m != null ? Math.max(0, Math.min(1, v / m)) : 0;
  const fillY = HEART_BOTTOM - pct * (HEART_BOTTOM - HEART_TOP);
  return (
    <div className="heartHud dragHandle" title={`Health ${Math.round(pct * 100)}%`}>
      <svg viewBox="0 0 100 88" aria-hidden="true">
        <defs>
          <clipPath id="heartClip">
            <path d={HEART_D} />
          </clipPath>
        </defs>
        <path className="hexOuter" d={HEX_D} transform="rotate(30 50 44)" />
        <path className="heartBase" d={HEART_D} />
        <g clipPath="url(#heartClip)">
          <rect className="heartFill" x="0" y={fillY} width="100" height="88" />
        </g>
        <path className="heartLine" d={HEART_D} />
      </svg>
    </div>
  );
}
