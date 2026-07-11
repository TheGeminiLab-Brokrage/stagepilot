'use client';

import Image from 'next/image';
import type { CapitalZoneState as CapitalZone } from '@/lib/assessment/data/landmarks-capital';

interface ZonePopupProps {
  zone: CapitalZone;
  masterPlanImage: string;
  projectName: string;
}

export default function ZonePopup({ zone, masterPlanImage, projectName }: ZonePopupProps) {
  // Flip horizontally if zone is in the right half, vertically if in the bottom half.
  const flipX = zone.xPct > 55;
  const flipY = zone.yPct > 58;

  const translateX = flipX ? 'calc(-100% - 8px)' : '8px';
  const translateY = flipY ? 'calc(-100% + 4px)' : '0%';

  return (
    <div
      style={{
        position: 'absolute',
        left:      `${zone.xPct + zone.widthPct / 2}%`,
        top:       `${zone.yPct}%`,
        transform: `translate(${translateX}, ${translateY})`,
        zIndex: 50,
        pointerEvents: 'none',
        animation: 'fadeIn 120ms ease',
      }}
    >
      <div style={{
        background: 'rgba(10,10,10,0.96)',
        border: '1px solid rgba(215,255,0,0.25)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(215,255,0,0.08)',
        overflow: 'hidden',
        width: 220,
      }}>
        <div style={{ position: 'relative', width: 220, height: 140 }}>
          <Image
            src={masterPlanImage}
            alt={projectName}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </div>
        <div style={{
          padding: '8px 10px',
          borderTop: '1px solid rgba(215,255,0,0.1)',
        }}>
          <p style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-space)',
            color: 'var(--tgl-lime)',
            letterSpacing: '-0.01em',
          }}>
            {projectName}
          </p>
        </div>
      </div>
    </div>
  );
}
