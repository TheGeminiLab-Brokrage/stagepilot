'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import type { CapitalZone } from '@/lib/assessment/data/landmarks-capital';
import { CAPITAL_ZONE_ANSWERS, type CapitalZoneAnswer } from '@/lib/assessment/data/zone-answers-capital';

// Compute centroid of one or two polygon point strings, returned as % of image
function polyCenter(pts: string, pts2: string | undefined, imgW: number, imgH: number): { cx: number; cy: number } {
  const parse = (s: string) =>
    s.trim().split(/\s+/).map(p => p.split(',').map(Number) as [number, number]);
  const all = [...parse(pts), ...(pts2 ? parse(pts2) : [])];
  const cx = (all.reduce((s, p) => s + p[0], 0) / all.length / imgW) * 100;
  const cy = (all.reduce((s, p) => s + p[1], 0) / all.length / imgH) * 100;
  return { cx, cy };
}

// ── SVG polygon overlay ────────────────────────────────────────────────────────

function ZonePolygons({
  zones,
  zoneResults,
  onHover,
  imgW,
  imgH,
}: {
  zones: CapitalZone[];
  zoneResults: Record<string, boolean>;
  onHover: (id: string | null) => void;
  imgW: number;
  imgH: number;
}) {
  const polyZones = zones.filter(z => z.pts);
  if (!polyZones.length) return null;
  return (
    <svg
      viewBox={`0 0 ${imgW} ${imgH}`}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {polyZones.map(zone => {
        const resultVal = zoneResults[zone.id];
        const fill = resultVal === undefined
          ? 'rgba(0,0,0,0.55)'
          : resultVal
            ? 'rgba(0,0,0,0.15)'
            : 'rgba(0,0,0,0.88)';
        return (
          <g
            key={zone.id}
            onMouseEnter={zone.masterPlanImage ? () => onHover(zone.id) : undefined}
            onMouseLeave={zone.masterPlanImage ? () => onHover(null) : undefined}
            style={{
              pointerEvents: zone.masterPlanImage ? 'auto' : 'none',
              cursor: 'default',
            }}
          >
            <polygon
              points={zone.pts}
              fill={fill}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />
            {zone.pts2 && (
              <polygon
                points={zone.pts2}
                fill={fill}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Masterplan hover popup ─────────────────────────────────────────────────────

function MasterPlanPopup({
  zone,
  visible,
  imgW,
  imgH,
}: {
  zone: CapitalZone | null;
  visible: boolean;
  imgW: number;
  imgH: number;
}) {
  if (!zone?.masterPlanImage) return null;

  let cx: number, cy: number;
  if (zone.pts) {
    const c = polyCenter(zone.pts, zone.pts2, imgW, imgH);
    cx = c.cx;
    cy = c.cy;
  } else {
    cx = zone.xPct + zone.widthPct / 2;
    cy = zone.yPct + zone.heightPct * 0.55;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${cx}%`,
        top: `${cy}%`,
        transform: visible
          ? 'translate(-50%, calc(-100% - 12px)) scale(1)'
          : 'translate(-50%, calc(-100% - 4px)) scale(0.91)',
        width: 188,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(215,255,0,0.35), 0 0 20px rgba(215,255,0,0.08)',
        zIndex: 3000,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={zone.masterPlanImage} alt="" style={{ width: '100%', display: 'block' }} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '6px 8px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.82))',
          fontSize: 9,
          fontWeight: 700,
          color: 'rgba(215,255,0,0.75)',
          fontFamily: 'var(--font-space)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Masterplan
      </div>
    </div>
  );
}

// ── Fallback rect box for non-poly special zones ───────────────────────────────

function ZoneButton({ zone }: { zone: CapitalZone }) {
  return (
    <div
      style={{
        position: 'absolute',
        left:   `${zone.xPct}%`,
        top:    `${zone.yPct}%`,
        width:  `${zone.widthPct}%`,
        height: `${zone.heightPct}%`,
        background: 'rgba(0,0,0,0.55)',
        border: '1px dashed rgba(255,255,255,0.25)',
        borderRadius: zone.clipPath ? 0 : 4,
        clipPath: zone.clipPath,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8%',
        overflow: 'hidden',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <span style={{
        fontSize: 8,
        fontWeight: 800,
        fontFamily: 'var(--font-space)',
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.04em',
        lineHeight: 1,
        textTransform: 'uppercase',
      }}>
        {zone.code}
      </span>
    </div>
  );
}

// ── ZonePin (clickable circle) ─────────────────────────────────────────────────

const PIN_PULSE_STYLE = `
@keyframes cap-pin-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.85; }
  50%       { transform: translate(-50%, -50%) scale(1.18); opacity: 1;    }
}
@keyframes cap-pin-ring {
  0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.35; }
  50%       { transform: translate(-50%, -50%) scale(1.5); opacity: 0;    }
}
`;

let styleInjected = false;

const PIN_COLORS = {
  yellow:    { core: '#D7FF00',  ring: 'rgba(215,255,0,0.35)',  glow: 'rgba(215,255,0,0.7)',   glowFar: 'rgba(215,255,0,0.25)',  hoverCore: '#eeff44', hoverGlow: 'rgba(215,255,0,0.95)',  hoverGlowFar: 'rgba(215,255,0,0.4)'  },
  green:     { core: '#22c55e',  ring: 'rgba(34,197,94,0.35)',  glow: 'rgba(34,197,94,0.7)',   glowFar: 'rgba(34,197,94,0.25)',  hoverCore: '#4ade80', hoverGlow: 'rgba(34,197,94,0.95)',  hoverGlowFar: 'rgba(34,197,94,0.4)'  },
  red:       { core: '#ef4444',  ring: 'rgba(239,68,68,0.35)',  glow: 'rgba(239,68,68,0.7)',   glowFar: 'rgba(239,68,68,0.25)',  hoverCore: '#ef4444', hoverGlow: 'rgba(239,68,68,0.7)',   hoverGlowFar: 'rgba(239,68,68,0.25)' },
  gold:      { core: '#f59e0b',  ring: 'rgba(245,158,11,0.35)', glow: 'rgba(245,158,11,0.7)',  glowFar: 'rgba(245,158,11,0.25)', hoverCore: '#fbbf24', hoverGlow: 'rgba(245,158,11,0.95)', hoverGlowFar: 'rgba(245,158,11,0.4)' },
};

function ZonePin({
  zone,
  result,
  part2Result,
  onClick,
  onHover,
  imgW,
  imgH,
  zoneAnswers,
}: {
  zone: CapitalZone;
  result?: boolean;
  part2Result?: boolean;
  onClick: (id: string) => void;
  onHover: (id: string | null) => void;
  imgW: number;
  imgH: number;
  zoneAnswers: CapitalZoneAnswer[];
}) {
  useEffect(() => {
    if (styleInjected) return;
    const el = document.createElement('style');
    el.textContent = PIN_PULSE_STYLE;
    document.head.appendChild(el);
    styleInjected = true;
  }, []);

  let cx: number, cy: number;
  if (zone.pts) {
    const c = polyCenter(zone.pts, zone.pts2, imgW, imgH);
    cx = c.cx;
    cy = c.cy;
  } else {
    cx = zone.xPct + zone.widthPct / 2;
    cy = zone.yPct + zone.heightPct * 0.55;
  }

  const answered = result !== undefined;
  const isGreen = answered && result === true;
  const part2Done = part2Result !== undefined;

  // Color hierarchy: gold (Part 2 done) > green (Part 1 correct) > red > yellow
  const colorKey: keyof typeof PIN_COLORS = !answered
    ? 'yellow'
    : !result
      ? 'red'
      : part2Done
        ? 'gold'
        : 'green';
  const colors = PIN_COLORS[colorKey];

  // Green pins are re-clickable for Part 2; red pins are locked
  const isClickable = !answered || isGreen;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${cx}%`,
        top:  `${cy}%`,
        width: 0,
        height: 0,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {/* Outer ring — animated for unanswered, static for answered */}
      <div style={{
        position: 'absolute',
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: `2px solid ${colors.core}`,
        opacity: 0.35,
        transform: 'translate(-50%, -50%)',
        animation: (!answered || (isGreen && !part2Done)) ? 'cap-pin-ring 2.2s ease-in-out infinite' : 'none',
        pointerEvents: 'none',
      }} />

      {/* Core circle */}
      <div
        onClick={isClickable ? () => onClick(zone.id) : undefined}
        onMouseEnter={isClickable ? e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.background = colors.hoverCore;
          el.style.boxShadow = `0 0 14px ${colors.hoverGlow}, 0 0 30px ${colors.hoverGlowFar}`;
          if (!answered && zone.masterPlanImage) onHover(zone.id);
        } : undefined}
        onMouseLeave={isClickable ? e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.background = colors.core;
          el.style.boxShadow = `0 0 8px ${colors.glow}, 0 0 20px ${colors.glowFar}`;
          if (!answered && zone.masterPlanImage) onHover(null);
        } : undefined}
        style={{
          position: 'absolute',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: colors.core,
          border: '2px solid rgba(0,0,0,0.6)',
          boxShadow: `0 0 8px ${colors.glow}, 0 0 20px ${colors.glowFar}`,
          transform: 'translate(-50%, -50%)',
          animation: (!answered || (isGreen && !part2Done)) ? 'cap-pin-pulse 2.2s ease-in-out infinite' : 'none',
          cursor: isClickable ? 'pointer' : 'default',
          pointerEvents: 'all',
          transition: 'box-shadow 150ms, background 150ms',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          fontSize: 6,
          fontWeight: 900,
          fontFamily: 'var(--font-space)',
          color: answered ? '#fff' : '#000',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {zone.code}
        </span>

      </div>

      {/* Project name label — shown below the pin when answered correctly */}
      {isGreen && (() => {
        const ans = zoneAnswers.find(a => a.zoneId === zone.id);
        return ans ? (
          <div style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontSize: 7,
            fontWeight: 700,
            color: '#D7FF00',
            fontFamily: 'var(--font-space)',
            letterSpacing: '0.04em',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
          }}>
            {ans.project}
          </div>
        ) : null;
      })()}
    </div>
  );
}

// Zones that are display-only (no clickable pin) — exported so the page can
// compute the correct answerable-zone count for the submit button condition.
export const CAPITAL_NO_PIN_IDS = new Set([
  'cap-A2', 'cap-elzohar', 'cap-university-top',
  'cap-university-bottom', 'cap-hotel-top', 'cap-hotel-bottom',
  'cap-M3', 'cap-M7', 'cap-M9', 'cap-M10',
  'cap-N3', 'cap-N4', 'cap-F1', 'cap-D5', 'cap-D4', 'cap-P2',
]);

// ── CapitalMap ────────────────────────────────────────────────────────────────

export interface CapitalMapProps {
  zones: CapitalZone[];
  zoneResults?: Record<string, boolean>;
  part2Results?: Record<string, boolean>;
  onStarClick: (zoneId: string) => void;
  onReady: () => void;
  mapSrc?: string;
  mapW?: number;
  mapH?: number;
  zoneAnswers?: CapitalZoneAnswer[];
  noPinIds?: Set<string>;
}

export default function CapitalMap({
  zones,
  zoneResults = {},
  part2Results = {},
  onStarClick,
  onReady,
  mapSrc = '/assessment/new-capital-map.png',
  mapW = 1163,
  mapH = 912,
  zoneAnswers = CAPITAL_ZONE_ANSWERS,
  noPinIds = CAPITAL_NO_PIN_IDS,
}: CapitalMapProps) {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  const NO_PIN_IDS = noPinIds;
  const pinZones = zones.filter(z => !NO_PIN_IDS.has(z.id));

  const hoveredZone = hoveredZoneId
    ? zones.find(z => z.id === hoveredZoneId) ?? null
    : null;

  const aspectRatio = mapW / mapH;

  return (
    <div style={{
      position: 'relative',
      userSelect: 'none',
      width: '100%',
      maxWidth: `min(100%, calc((100vh - 60px) * ${aspectRatio.toFixed(4)}))`,
      margin: '0 auto',
    }}>
      <Image
        src={mapSrc}
        alt="Capital District Map"
        width={mapW}
        height={mapH}
        style={{ width: '100%', height: 'auto', objectFit: 'fill', borderRadius: 8, display: 'block' }}
        onLoad={onReady}
        priority
        draggable={false}
      />
      {/* Cover the watermark star in the lower-right corner of the R8 PNG */}
      {mapSrc === '/assessment/new-capital-map.png' && (
        <div style={{
          position: 'absolute',
          left: '87%',
          top: '82.5%',
          width: '6%',
          height: '9%',
          background: '#0b0e12',
          pointerEvents: 'none',
          zIndex: 5,
        }} />
      )}
      {/* Accurate SVG polygon outlines for all zones */}
      <ZonePolygons zones={zones} zoneResults={zoneResults} onHover={setHoveredZoneId} imgW={mapW} imgH={mapH} />
      {/* Clickable pins */}
      {pinZones.map(zone => (
        <ZonePin
          key={zone.id}
          zone={zone}
          result={zoneResults[zone.id]}
          part2Result={part2Results[zone.id]}
          onClick={onStarClick}
          onHover={setHoveredZoneId}
          imgW={mapW}
          imgH={mapH}
          zoneAnswers={zoneAnswers}
        />
      ))}
      {/* Masterplan hover popup */}
      <MasterPlanPopup
        zone={hoveredZone}
        visible={!!hoveredZoneId && !!hoveredZone?.masterPlanImage}
        imgW={mapW}
        imgH={mapH}
      />
    </div>
  );
}
