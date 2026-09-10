import { memo, useEffect, useRef, useState } from "react";
import type React from "react";

import { worldToNormalized, type MapCalibration } from "./calibration";
import { useIconSrc } from "./icon-cache";

// TEMP DIAGNOSTIC: read by App.tsx's longtask logger to tell "map open but
// idle" apart from "actively mid zoom/pan gesture" — `cursorOn` in that log
// is always true whenever the map is open (it's literally set from
// `fullMapOpen`), so it couldn't actually distinguish the two. Remove
// alongside the other TEMP DIAGNOSTIC code once the cause is found.
export let mapInteractingNow = false;

export type MapPoint = { x: number; y: number };

export type MapZoneShape = {
  id: string;
  name: string;
  color: string;
  kind: string;
  shape?: string;
  size?: number;
  icon?: string | null;
  points: MapPoint[];
  enabled?: boolean;
  hideLabel?: boolean;
  categoryId?: string | null;
};

export type MapFocus = { x: number; y: number; nonce: number };

export type MapPlayerShape = {
  steamId: string;
  label: string;
  x: number;
  y: number;
  yaw?: number | null;
  path?: MapPoint[];
  self?: boolean;
};

export type MapFoodLayer = {
  label: string;
  color: string;
  points: { u: number; v: number }[];
};

function svg(cal: MapCalibration, p: MapPoint): { x: number; y: number } {
  const n = worldToNormalized(cal, p.x, p.y);
  return { x: n.u * 1000, y: n.v * 1000 };
}

type CullBounds = { l: number; t: number; r: number; b: number };

function inBounds(cx: number, cy: number, b: CullBounds | null): boolean {
  if (!b) return true;
  return cx >= b.l && cx <= b.r && cy >= b.t && cy <= b.b;
}

// Cap on how large (px) the background tiles are allowed to be laid out at
// when "boosting" their raster resolution on deep zoom — see the imgBoost
// effect below. The source tiles are ~7800px natively (~5MB compressed
// webp each), and re-decoding all 3 of them at a large target size turned
// out to be genuinely expensive CPU work (measured as 0.5-2.4s main-thread
// stalls every time a zoom/pan gesture settled) — not just a cheap GPU
// resize as hoped. Lowered from an earlier 2800 to trade a bit of peak
// sharpness for a much cheaper decode.
const MAX_BOOST_PX = 1700;

// Below this fraction of change from the last applied boost, skip
// re-decoding at a new size entirely. Without this, nudging the zoom by
// even a fraction re-triggers the same expensive 3-image decode on every
// settle — this is what made zooming in small steps and closing/reopening
// (which nudges `view` only slightly, if at all) still feel laggy even
// after labels/icons were already deferred elsewhere.
const BOOST_CHANGE_THRESHOLD = 0.2;

export function MapCanvas({
  layerBase,
  calibration,
  zones,
  players,
  focus,
  food,
  open,
}: {
  layerBase: string;
  calibration: MapCalibration | null;
  zones: MapZoneShape[];
  players: MapPlayerShape[];
  focus?: MapFocus | null;
  food?: MapFoodLayer[];
  open?: boolean;
}) {
  const layers = [`${layerBase}/base.webp`, `${layerBase}/water.webp`, `${layerBase}/land.webp`];
  const viewRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewLatest = useRef(view);
  viewLatest.current = view;
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const dragRaf = useRef<number | null>(null);
  const dragPending = useRef<{ tx: number; ty: number } | null>(null);
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });

  // Even with fixed-geometry + transform-only counter-scaling, re-rendering
  // 60+ place labels (each a <text> — SVG text layout is the expensive part)
  // on every zoom/pan frame was still measured causing a sustained run of
  // 1-2s main-thread stalls while actively interacting, under real CPU
  // contention from the game. Dropping labels (and player name text) for
  // the duration of the gesture, and only rendering them again ~200ms after
  // it settles, removes that cost from exactly the frames where it hurts.
  const [interacting, setInteracting] = useState(false);
  const interactingTimer = useRef<number | null>(null);
  const markInteracting = (ms = 220) => {
    setInteracting(true);
    mapInteractingNow = true;
    if (interactingTimer.current != null) window.clearTimeout(interactingTimer.current);
    interactingTimer.current = window.setTimeout(() => {
      setInteracting(false);
      mapInteractingNow = false;
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (dragRaf.current != null) cancelAnimationFrame(dragRaf.current);
      if (interactingTimer.current != null) window.clearTimeout(interactingTimer.current);
    };
  }, []);

  // `display:none` is what keeps the map cheap while closed (see
  // FullMapOverlay.tsx for why that trade-off won over always-painting), but
  // it means the very first paint after opening still has to lay out all
  // 60+ place labels from scratch in one frame — measured as the map "modal"
  // appearing instantly while its content visibly took a couple more seconds
  // to settle. Suppressing labels for a beat right on open, same mechanism
  // as during zoom/pan, lets the (cheaper) tiles/icons/shapes paint first and
  // the labels fill in a moment later instead of all of it landing at once.
  useEffect(() => {
    if (open) markInteracting(500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Deferring labels/icons only moved the expensive "draw everything" work
  // ~0.2-0.5s later — it was still one big pass over all 60+ places every
  // time it happened, which still showed up as a long task once that delay
  // elapsed. The actual fix is to stop drawing places that are off-screen at
  // all: zoomed in, most of the 60+ places aren't visible anyway. This only
  // recomputes the visible-area bounds once a gesture has settled (guarded
  // by `interacting`), not every pan/zoom frame — recalculating on every
  // frame would reintroduce the very re-render cost this avoids, since a
  // panned view's bounds change every frame while `scale` (what ZoneShapes/
  // PlayerShapes actually key their memo on) does not.
  const [cullBounds, setCullBounds] = useState<CullBounds | null>(null);
  useEffect(() => {
    if (interacting) return;
    const el = viewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const margin = 120; // local units — keeps pills from popping in/out right at the edge
    setCullBounds({
      l: -view.tx / view.scale - margin,
      t: -view.ty / view.scale - margin,
      r: (rect.width - view.tx) / view.scale + margin,
      b: (rect.height - view.ty) / view.scale + margin,
    });
  }, [interacting, view]);

  // The background tiles are laid out at the panel's own size (~800px) and
  // then only CSS-transform-scaled for zoom — cheap and smooth, but the
  // browser rasterizes an <img> based on its *layout* size, not accounting
  // for an ancestor transform that will stretch it further. That's the
  // actual cause of zoom looking blurry despite the source tiles being
  // ~7800px natively: the raster itself is only ever as detailed as an
  // ~800px box, then stretched up to 20x that. Boosting the tiles' own
  // layout size once a gesture settles (below) gives the browser a bigger
  // box to rasterize into — using more of the source's real detail — while
  // an equal-and-opposite inner scale keeps the final on-screen size
  // unchanged. This is a plain resize (no element is destroyed/recreated),
  // so it doesn't have the black-flash problem the earlier remount-based
  // attempt did.
  const [imgBoost, setImgBoost] = useState<{ boostPx: number; boostFactor: number }>({ boostPx: 0, boostFactor: 1 });
  const lastBoostPxRef = useRef(0);
  useEffect(() => {
    if (interacting) return;
    const el = viewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const wanted = rect.width * view.scale;
    const boostPx = Math.min(Math.max(wanted, rect.width), MAX_BOOST_PX);
    const last = lastBoostPxRef.current;
    // Skip re-decoding for a small nudge in zoom level — only worth paying
    // for another 3-image decode when the target size actually moved
    // meaningfully from what's already on screen.
    if (last > 0 && Math.abs(boostPx - last) / last < BOOST_CHANGE_THRESHOLD) return;
    lastBoostPxRef.current = boostPx;
    setImgBoost({ boostPx, boostFactor: boostPx / rect.width });
  }, [interacting, view]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    // Zoning/player markers re-render on every scale change (they counter-scale
    // to stay a constant size), which is heavy with many POIs. A wheel gesture
    // can fire far more events than the display can paint, so coalesce every
    // event received within a frame into a single state update instead of one
    // per event — this is what caused the zoom to feel janky.
    let rafId: number | null = null;
    let pendingFactor = 1;
    let pendingPos: { cx: number; cy: number } | null = null;

    function applyPending() {
      rafId = null;
      if (!pendingPos) return;
      const { cx, cy } = pendingPos;
      const factor = pendingFactor;
      pendingPos = null;
      pendingFactor = 1;
      const { scale, tx, ty } = viewLatest.current;
      const ns = Math.min(25, Math.max(1, scale * factor));
      const wx = (cx - tx) / scale;
      const wy = (cy - ty) / scale;
      setView({ scale: ns, tx: cx - wx * ns, ty: cy - wy * ns });
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      markInteracting();
      const rect = el!.getBoundingClientRect();
      pendingPos = { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
      pendingFactor *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
      if (rafId == null) rafId = requestAnimationFrame(applyPending);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (!focus || !calibration) return;
    const el = viewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const n = worldToNormalized(calibration, focus.x, focus.y);
    const z = 6;
    setView({
      scale: z,
      tx: rect.width / 2 - n.u * rect.width * z,
      ty: rect.height / 2 - n.v * rect.height * z,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      d.moved = true;
      markInteracting();
    }
    // Coalesce to one state update per frame instead of one per pointermove —
    // a high-poll-rate mouse can fire several of these per frame, and each
    // one used to trigger its own React render, which is what made panning
    // feel stuttery instead of a smooth 1:1 drag.
    dragPending.current = { tx: d.tx + dx, ty: d.ty + dy };
    if (dragRaf.current == null) {
      dragRaf.current = requestAnimationFrame(() => {
        dragRaf.current = null;
        const p = dragPending.current;
        dragPending.current = null;
        if (p) setView((v) => ({ ...v, tx: p.tx, ty: p.ty }));
      });
    }
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div
      ref={viewRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="interactive-region"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: 10,
        border: "1px solid var(--line)",
        background: "#070b09",
        touchAction: "none",
        cursor: "grab",
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={resetView}
        style={{
          position: "absolute",
          right: 8,
          top: 8,
          zIndex: 10,
          padding: "4px 10px",
          fontFamily: "var(--mono)",
          fontSize: 11,
          borderRadius: 6,
          border: "1px solid var(--line)",
          background: "rgba(10,15,12,0.9)",
          color: "var(--muted)",
          cursor: "pointer",
        }}
      >
        Reset
      </button>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: imgBoost.boostPx || "100%",
            height: imgBoost.boostPx || "100%",
            transform: imgBoost.boostPx ? `scale(${1 / imgBoost.boostFactor})` : undefined,
            transformOrigin: "0 0",
          }}
        >
          {layers.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              draggable={false}
              decoding="async"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          ))}
        </div>
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
        >
          {food && food.length ? <FoodDots food={food} scale={view.scale} /> : null}
          {calibration ? (
            <>
              <ZoneShapes calibration={calibration} zones={zones} scale={view.scale} simplified={interacting} cullBounds={cullBounds} />
              <PlayerShapes calibration={calibration} players={players} scale={view.scale} simplified={interacting} />
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

const FoodDots = memo(function FoodDots({ food, scale }: { food: MapFoodLayer[]; scale: number }) {
  const k = 1 / scale;
  const [hover, setHover] = useState<{ cx: number; cy: number; label: string; color: string } | null>(null);
  return (
    <g>
      {food.flatMap((grp, gi) =>
        grp.points.map((p, i) => {
          const cx = p.u * 1000;
          const cy = p.v * 1000;
          return (
            <g key={`${gi}-${i}`}>
              <circle cx={cx} cy={cy} r={3.4 * k} fill={grp.color} fillOpacity={0.9} stroke="rgba(0,0,0,0.65)" strokeWidth={0.8 * k} />
              <circle
                cx={cx}
                cy={cy}
                r={9 * k}
                fill="transparent"
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onMouseEnter={() => setHover({ cx, cy, label: grp.label, color: grp.color })}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        }),
      )}
      {hover ? <Pill cx={hover.cx} cy={hover.cy - 12 * k} label={hover.label} color={hover.color} k={k} /> : null}
    </g>
  );
});

function Pill({ cx, cy, label, color, k }: { cx: number; cy: number; label: string; color: string; k: number }) {
  // Fixed reference-scale geometry (as if k were always 1), counter-scaled
  // via a single wrapping <g transform="scale()"> instead of baking `k` into
  // every rect/text attribute. With 60+ labelled places, recomputing width/
  // fontSize/position on every zoom tick forced SVG to redo text layout for
  // all of them every frame — this was the dominant cost behind zoom feeling
  // janky. A transform-only update is compositor-cheap by comparison, and
  // React skips writing the rect/text attributes at all once label/color
  // are unchanged, since their values no longer depend on `k`.
  const fontSize = 16;
  const h = 23;
  const padL = 18;
  const padR = 12;
  const w = label.length * fontSize * 0.56 + padL + padR;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${k})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill="rgba(17,20,27,0.85)" stroke="rgba(255,255,255,0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <circle cx={-w / 2 + 10} cy={0} r={3.5} fill={color} />
      <text x={-w / 2 + padL} y={0} textAnchor="start" dominantBaseline="central" fontSize={fontSize} fill="rgba(255,255,255,0.9)" style={{ fontWeight: 600 }}>
        {label}
      </text>
    </g>
  );
}

function ZoneIcon({
  icon,
  isPolygon,
  shape,
  cx,
  cy,
  r,
  color,
}: {
  icon: string;
  isPolygon: boolean;
  shape: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
}) {
  const src = useIconSrc(icon);
  if (!src) return isPolygon ? null : <MarkerShape shape={shape} cx={cx} cy={cy} r={r} color={color} />;
  return <image href={src} x={cx - r} y={cy - r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid meet" />;
}

function MarkerShape({ shape, cx, cy, r, color }: { shape: string; cx: number; cy: number; r: number; color: string }) {
  const common = {
    fill: color,
    fillOpacity: 0.55,
    stroke: "rgba(0,0,0,0.6)",
    strokeWidth: 1.5,
    vectorEffect: "non-scaling-stroke" as const,
  };
  if (shape === "square") return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} {...common} />;
  if (shape === "rectangle") return <rect x={cx - r * 1.4} y={cy - r * 0.7} width={r * 2.8} height={r * 1.4} {...common} />;
  if (shape === "triangle") return <polygon points={`${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`} {...common} />;
  if (shape === "diamond") return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

// Split from the player layer (below) so a live-position tick — which
// changes only `players`, roughly every 50ms while the map is open — no
// longer forces every place marker in `zones` (up to ~60+ on a populated
// server) to recompute and re-render too. They only share this cost again
// when `scale` itself changes (an actual zoom).
const ZoneShapes = memo(function ZoneShapes({
  calibration,
  zones,
  scale,
  simplified,
  cullBounds,
}: {
  calibration: MapCalibration;
  zones: MapZoneShape[];
  scale: number;
  // While true, render cheap vector shapes instead of icons (each icon is a
  // real base64 image that still has to be decoded on first paint) and skip
  // text labels — see the `interacting` state in MapCanvas for why.
  simplified?: boolean;
  // Icon + label are skipped for places outside this box (see MapCanvas):
  // deferring them to "a moment after this happens" still meant drawing all
  // 60+ of them the moment it did. Not culling the fill/base shape itself so
  // zones don't visibly pop in/out as you pan — only their icon (needs an
  // image decode) and label (needs SVG text layout), the actually expensive
  // parts, are held back for off-screen places.
  cullBounds?: CullBounds | null;
}) {
  const k = 1 / scale;
  return (
    <>
      {zones.map((zone) => {
        const pts = zone.points.map((p) => svg(calibration, p));
        if (pts.length === 0) return null;
        const isPolygon = zone.shape === "polygon";
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const r = (zone.size ?? 0.02) * 1000;
        const visible = inBounds(cx, cy, cullBounds ?? null);
        return (
          <g key={zone.id} opacity={zone.enabled === false ? 0.4 : 1}>
            {isPolygon ? (
              <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={zone.color} fillOpacity={0.3} stroke={zone.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ) : null}
            {zone.icon && !simplified && visible ? (
              <ZoneIcon icon={zone.icon} isPolygon={isPolygon} shape={zone.shape ?? "circle"} cx={cx} cy={cy} r={r} color={zone.color} />
            ) : !isPolygon ? (
              <MarkerShape shape={zone.shape ?? "circle"} cx={cx} cy={cy} r={r} color={zone.color} />
            ) : null}
            {zone.hideLabel || simplified || !visible ? null : <Pill cx={cx} cy={isPolygon && !zone.icon ? cy : cy - r - 10 * k} label={zone.name} color={zone.color} k={k} />}
          </g>
        );
      })}
    </>
  );
});

const PlayerShapes = memo(function PlayerShapes({
  calibration,
  players,
  scale,
  simplified,
}: {
  calibration: MapCalibration;
  players: MapPlayerShape[];
  scale: number;
  simplified?: boolean;
}) {
  const k = 1 / scale;
  return (
    <>
      {players.map((p) => {
        const here = svg(calibration, p);
        const trail =
          p.path && p.path.length > 1
            ? p.path.map((q) => { const s = svg(calibration, q); return `${s.x},${s.y}`; }).join(" ")
            : null;
        let angleDeg: number | null = null;
        if (p.yaw != null) {
          const rad = (p.yaw * Math.PI) / 180;
          const ahead = svg(calibration, { x: p.x + 1000 * Math.cos(rad), y: p.y + 1000 * Math.sin(rad) });
          angleDeg = (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI;
        }
        const fill = p.self ? "#fbbf24" : "#34d399";
        const a = p.self ? 11 : 9;
        return (
          <g key={p.steamId}>
            {trail ? <polyline points={trail} fill="none" stroke={p.self ? "#f59e0b" : "#38bdf8"} strokeWidth={2} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" /> : null}
            {/* Fixed reference-scale geometry counter-scaled via one wrapping
                transform, same reasoning as Pill above. */}
            <g transform={`translate(${here.x} ${here.y}) scale(${k})`}>
              {angleDeg != null ? (
                <polygon points={`${a},0 ${-a * 0.7},${-a * 0.7} ${-a * 0.7},${a * 0.7}`} transform={`rotate(${angleDeg})`} fill={fill} stroke="#000" strokeWidth={1.5} strokeLinejoin="round" />
              ) : (
                <circle cx={0} cy={0} r={p.self ? 7 : 5} fill={fill} stroke="#000" strokeWidth={1.5} />
              )}
              {simplified ? null : (
                <text x={0} y={-13} textAnchor="middle" fontSize={13} fill="#fff" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 4 }}>
                  {p.label}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </>
  );
});
