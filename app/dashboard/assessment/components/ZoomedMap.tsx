'use client';

import { useEffect, useState, useCallback, useRef, MutableRefObject } from 'react';
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet';
import { useDroppable } from '@dnd-kit/core';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DropZone } from './Map';
import { KM_MARKER_LABELS } from '@/lib/assessment/data/km-markers';
import type { KmRange } from '@/lib/assessment/data/km-ranges';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LANDMARK_COLORS = [
  '#ff3cac', '#a855f7', '#f59e0b', '#ef4444',
  '#3b82f6', '#10b981', '#f97316', '#06b6d4',
  '#8b5cf6', '#ec4899',
];

export type QuizPhase = 'idle' | 'zooming' | 'transitioning' | 'active';

// ─── MapRefCapture ────────────────────────────────────────────────────────────

function MapRefCapture({ mapRef }: { mapRef: MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// ─── FlyController ────────────────────────────────────────────────────────────

function FlyController({
  bounds,
  target,
}: {
  bounds: L.LatLngBoundsExpression;
  target?: { lat: number; lng: number; zoom: number };
}) {
  const map = useMap();
  const prevKey = useRef('');

  useEffect(() => {
    const key = target
      ? `pt:${target.lat},${target.lng},${target.zoom}`
      : JSON.stringify(bounds);
    if (key === prevKey.current) return;
    prevKey.current = key;
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.8, easeLinearity: 0.25 });
    } else {
      map.flyToBounds(bounds, { duration: 1.5, padding: [40, 40], maxZoom: 14 });
    }
  }, [map, bounds, target]);

  return null;
}

// ─── KmFlyController ─────────────────────────────────────────────────────────

function KmFlyController({ range }: { range: KmRange | null | undefined }) {
  const map = useMap();
  const prevLabel = useRef('');

  useEffect(() => {
    if (!range) {
      prevLabel.current = '';
      return;
    }
    if (range.label === prevLabel.current) return;
    prevLabel.current = range.label;
    map.flyTo([range.centerLat, range.centerLng], range.zoom, { duration: 1.5, easeLinearity: 0.2 });
  }, [map, range]);

  return null;
}

// ─── MapLocker ────────────────────────────────────────────────────────────────

function MapLocker({ locked }: { locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    const handlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.touchZoom,
      map.keyboard,
    ] as Array<{ enable(): void; disable(): void }>;
    if (locked) {
      handlers.forEach((h) => h.disable());
    } else {
      handlers.forEach((h) => h.enable());
    }
  }, [map, locked]);
  return null;
}

// ─── MapClickHandler ──────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on('click', onMapClick);
    return () => { map.off('click', onMapClick); };
  }, [map, onMapClick]);
  return null;
}

// ─── MapTracker ───────────────────────────────────────────────────────────────

function MapTracker({
  dropZones,
  onPositionsUpdate,
}: {
  dropZones: DropZone[];
  onPositionsUpdate: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const map = useMap();

  const update = useCallback(() => {
    const next: Record<string, { x: number; y: number }> = {};
    dropZones.forEach((zone) => {
      const pt = map.latLngToContainerPoint([zone.lat, zone.lng]);
      next[zone.id] = { x: pt.x, y: pt.y };
    });
    onPositionsUpdate(next);
  }, [map, dropZones, onPositionsUpdate]);

  useEffect(() => {
    map.on('move zoom viewreset resize', update);
    update();
    return () => { map.off('move zoom viewreset resize', update); };
  }, [map, update]);

  return null;
}

// ─── DroppablePin ─────────────────────────────────────────────────────────────

function DroppablePin({
  zone,
  index,
  pos,
  submitted,
  hasQuiz,
  hiddenPinId,
  completedQuizPinIds,
  blinkingPinId,
  selectedLabelId,
  masterPlanImage,
  masterPlanGallery,
  onRemove,
  onPinClick,
  onLabelPlace,
}: {
  zone: DropZone;
  index: number;
  pos: { x: number; y: number } | undefined;
  submitted: boolean;
  hasQuiz: boolean;
  hiddenPinId?: string | null;
  completedQuizPinIds: Set<string>;
  blinkingPinId?: string | null;
  selectedLabelId?: string | null;
  masterPlanImage?: string;
  masterPlanGallery?: { src: string; label: string }[];
  onRemove?: (zoneId: string) => void;
  onPinClick?: (zoneId: string) => void;
  onLabelPlace?: (zoneId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone.id });
  const [isStarHovered, setIsStarHovered] = useState(false);
  const baseColor = LANDMARK_COLORS[index % LANDMARK_COLORS.length];

  const answered = !!zone.accepted;
  const isCorrect = submitted && zone.accepted === zone.label;
  const isWrong = submitted && answered && zone.accepted !== zone.label;
  const pinColor = isCorrect ? '#D7FF00' : isWrong ? '#ef4444' : baseColor;
  const quizDone = completedQuizPinIds.has(zone.id);
  const canClick = hasQuiz && !submitted && !quizDone;
  const isBlinking = blinkingPinId === zone.id && canClick;
  const placementMode = !!selectedLabelId && !submitted;

  if (!pos || zone.id === hiddenPinId) return null;

  const isRoad = zone.type === 'road';
  const roadColor = isCorrect ? '#D7FF00' : isWrong ? '#ef4444' : '#f59e0b';

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setIsStarHovered(true)}
      onMouseLeave={() => setIsStarHovered(false)}
      onClick={(e) => {
        if (placementMode) {
          e.stopPropagation();
          onLabelPlace?.(zone.id);
        } else if (canClick) {
          onPinClick?.(zone.id);
        }
      }}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: 120,
        height: 120,
        transform: 'translate(-50%, -50%)',
        zIndex: isStarHovered ? 2000 : 1001,
        pointerEvents: 'all',
        cursor: placementMode ? 'crosshair' : canClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isRoad ? (
        /* Road sign badge — rectangular highway-sign style */
        <div style={{
          background: 'rgba(6,8,18,0.92)',
          border: `2px solid ${roadColor}`,
          borderRadius: 6,
          padding: '5px 11px 5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          boxShadow: isOver
            ? `0 0 16px ${roadColor}88, 0 0 0 1px ${roadColor}55`
            : `0 2px 10px rgba(0,0,0,0.6), 0 0 0 1px ${roadColor}33`,
          transform: isOver || placementMode ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.18s ease, box-shadow 0.18s, border-color 0.25s',
          animation: !answered && !submitted ? 'pin-pulse-ring 2.5s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, color: roadColor, lineHeight: 1, transition: 'color 0.25s' }}>⇒</span>
          <span style={{ color: roadColor, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space)', letterSpacing: '0.04em', transition: 'color 0.25s' }}>
            {submitted ? (isCorrect ? '✓' : '✗') : answered ? '●' : String(index + 1)}
          </span>
        </div>
      ) : (
        <>
          {/* Outer glow ring */}
          <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', background: `radial-gradient(circle, ${pinColor}33 0%, transparent 70%)`, opacity: isOver || placementMode ? 1 : answered ? 0.3 : 0.7, transition: 'opacity 0.2s', pointerEvents: 'none', animation: answered || submitted ? 'none' : 'pin-pulse-ring 2.5s ease-in-out infinite' }} />
          {/* Border ring */}
          <div style={{ position: 'absolute', width: 62, height: 62, borderRadius: '50%', left: '50%', top: '50%', transform: isOver ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%)', border: `2px solid ${pinColor}`, opacity: isOver ? 1 : answered ? 0.5 : 0.65, boxShadow: isOver ? `0 0 16px ${pinColor}88` : answered ? `0 0 10px ${pinColor}44` : 'none', transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.2s', pointerEvents: 'none' }} />
          {/* Center circle */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: canClick ? 'var(--tgl-lime)' : answered ? pinColor : baseColor,
              border: '2.5px solid rgba(0,0,0,0.5)',
              boxShadow: canClick
                ? '0 0 14px rgba(215,255,0,0.8), 0 0 28px rgba(215,255,0,0.4)'
                : `0 2px 12px ${pinColor}88, 0 0 0 1px ${pinColor}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'background 0.25s, transform 0.15s, box-shadow 0.25s',
              transform: isOver ? 'scale(1.15)' : 'scale(1)',
              animation: isBlinking ? 'star-blink 0.8s ease-in-out infinite' : answered || submitted ? 'none' : 'pin-pulse 2.5s ease-in-out infinite',
            }}
          >
            {submitted ? (
              <span style={{ color: isCorrect ? '#000' : '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-space)' }}>{isCorrect ? '✓' : '✗'}</span>
            ) : canClick ? (
              <span style={{ color: '#000', fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-space)' }}>✦</span>
            ) : answered ? (
              <span style={{ color: '#000', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space)' }}>●</span>
            ) : (
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space)' }}>{index + 1}</span>
            )}
          </div>
        </>
      )}

      {/* Masterplan hover preview — single image */}
      {canClick && masterPlanImage && !masterPlanGallery && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: '50%',
            transform: isStarHovered
              ? 'translateX(-50%) translateY(0px) scale(1)'
              : 'translateX(-50%) translateY(8px) scale(0.91)',
            width: 188,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(215,255,0,0.35), 0 0 20px rgba(215,255,0,0.08)',
            zIndex: 3000,
            pointerEvents: 'none',
            opacity: isStarHovered ? 1 : 0,
            transition: 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={masterPlanImage} alt="" style={{ width: '100%', display: 'block' }} />
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
      )}

      {/* Masterplan hover preview — zone gallery */}
      {canClick && masterPlanGallery && masterPlanGallery.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: '50%',
            transform: isStarHovered
              ? 'translateX(-50%) translateY(0px) scale(1)'
              : 'translateX(-50%) translateY(8px) scale(0.91)',
            width: 260,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(215,255,0,0.35), 0 0 20px rgba(215,255,0,0.08)',
            zIndex: 3000,
            pointerEvents: 'none',
            opacity: isStarHovered ? 1 : 0,
            transition: 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            background: 'rgba(6,8,18,0.97)',
          }}
        >
          <div
            style={{
              padding: '7px 10px 5px',
              fontSize: 9,
              fontWeight: 700,
              color: 'rgba(215,255,0,0.75)',
              fontFamily: 'var(--font-space)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderBottom: '1px solid rgba(215,255,0,0.12)',
            }}
          >
            Masterplan — Zones
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 4,
              padding: 8,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {masterPlanGallery.map((img) => (
              <div key={img.src} style={{ position: 'relative', borderRadius: 5, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.label} style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover' }} />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '2px 4px',
                    background: 'rgba(0,0,0,0.72)',
                    fontSize: 8,
                    fontWeight: 800,
                    color: '#D7FF00',
                    fontFamily: 'var(--font-space)',
                    textAlign: 'center',
                    letterSpacing: '0.06em',
                  }}
                >
                  {img.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {answered && (
        <div
          onClick={!submitted && onRemove ? (e) => { e.stopPropagation(); onRemove(zone.id); } : undefined}
          style={{ position: 'absolute', top: isRoad ? 80 : 64, left: '50%', transform: 'translateX(-50%)', background: submitted ? (isCorrect ? '#D7FF00' : '#ef4444') : 'rgba(8, 10, 20, 0.88)', color: submitted ? (isCorrect ? '#000' : '#fff') : '#fff', fontSize: 9, fontWeight: 700, padding: submitted ? '2px 8px' : '2px 6px 2px 8px', borderRadius: 4, whiteSpace: 'nowrap', boxShadow: submitted ? (isCorrect ? '0 0 10px rgba(215,255,0,0.5)' : '0 0 10px rgba(239,68,68,0.5)') : '0 2px 10px rgba(0,0,0,0.5)', border: submitted ? 'none' : '1px solid rgba(215,255,0,0.3)', pointerEvents: submitted ? 'none' : 'all', cursor: submitted ? 'default' : 'pointer', fontFamily: 'var(--font-space, "Space Grotesk", sans-serif)', letterSpacing: '0.02em', transition: 'background 0.3s, color 0.3s', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {submitted && isWrong ? zone.label : zone.accepted}
          {!submitted && <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.85, fontWeight: 900, marginTop: -1 }}>×</span>}
        </div>
      )}
    </div>
  );
}

// ─── ZoomedMap ────────────────────────────────────────────────────────────────

interface ZoomedMapProps {
  bounds: [[number, number], [number, number]];
  dropZones: DropZone[];
  submitted: boolean;
  onRemove?: (zoneId: string) => void;
  onPinClick?: (zoneId: string) => void;
  quizPinIds?: Set<string>;
  quizPhase: QuizPhase;
  activePinTarget?: { lat: number; lng: number; zoom: number };
  hiddenPinId?: string | null;
  completedQuizPinIds?: Set<string>;
  blinkingPinId?: string | null;
  selectedLabelId?: string | null;
  onLabelPlace?: (zoneId: string) => void;
  onDeselectLabel?: () => void;
  masterPlanImages?: Record<string, string>;
  masterPlanGalleries?: Record<string, { src: string; label: string }[]>;
  selectedKmRange?: KmRange | null;
}

export default function ZoomedMap({
  bounds,
  dropZones,
  submitted,
  onRemove,
  onPinClick,
  quizPinIds,
  quizPhase,
  activePinTarget,
  hiddenPinId,
  completedQuizPinIds = new Set(),
  blinkingPinId,
  selectedLabelId,
  onLabelPlace,
  onDeselectLabel,
  masterPlanImages,
  masterPlanGalleries,
  selectedKmRange,
}: ZoomedMapProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [kmPulseVisible, setKmPulseVisible] = useState(false);
  const kmPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const handlePositions = useCallback((pos: Record<string, { x: number; y: number }>) => setPositions(pos), []);

  useEffect(() => {
    if (!selectedKmRange) return;
    setKmPulseVisible(true);
    if (kmPulseTimer.current) clearTimeout(kmPulseTimer.current);
    kmPulseTimer.current = setTimeout(() => setKmPulseVisible(false), 5000);
    return () => { if (kmPulseTimer.current) clearTimeout(kmPulseTimer.current); };
  }, [selectedKmRange]);

  const forwardWheel = useCallback((e: React.WheelEvent) => {
    if (!mapRef.current) return;
    mapRef.current.getContainer().dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: e.deltaY,
        deltaX: e.deltaX,
        deltaMode: e.deltaMode,
        ctrlKey: e.ctrlKey,
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: true,
        cancelable: true,
      })
    );
  }, []);

  const mapFaded = quizPhase === 'transitioning' || quizPhase === 'active';

  // Filter km labels to those within (or near) the current section bounds
  const [minLat, minLng] = bounds[0];
  const [maxLat, maxLng] = bounds[1];
  const visibleKmLabels = KM_MARKER_LABELS.filter(
    (m) =>
      m.lat >= minLat - 0.08 && m.lat <= maxLat + 0.08 &&
      m.lng >= minLng - 0.08 && m.lng <= maxLng + 0.08
  );

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Leaflet map layer — fades out when quiz activates */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: mapFaded ? 0 : 1,
          transition: 'opacity 0.8s ease',
          pointerEvents: mapFaded ? 'none' : 'auto',
        }}
      >
        <MapContainer
          center={[31.05, 28.2]}
          zoom={9}
          minZoom={4}
          maxZoom={17}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            maxZoom={19}
            maxNativeZoom={19}
          />
          <MapRefCapture mapRef={mapRef} />
          <FlyController
            bounds={bounds as L.LatLngBoundsExpression}
            target={quizPhase === 'zooming' ? activePinTarget : undefined}
          />
          <KmFlyController range={selectedKmRange} />
          <MapLocker locked={quizPhase !== 'idle'} />
          <MapTracker dropZones={dropZones} onPositionsUpdate={handlePositions} />
          {selectedLabelId && onDeselectLabel && (
            <MapClickHandler onMapClick={onDeselectLabel} />
          )}

          {/* Km boundary labels */}
          {visibleKmLabels.map((m) => (
            <Marker
              key={m.label}
              position={[m.lat, m.lng]}
              icon={L.divIcon({
                html: `<div style="display:inline-block;background:#D7FF00;color:#000;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;font-family:monospace;box-shadow:0 2px 8px rgba(0,0,0,0.55);pointer-events:none;">${m.label}</div>`,
                className: '',
                iconSize: [0, 0] as unknown as L.PointExpression,
                iconAnchor: [0, 8] as unknown as L.PointExpression,
              })}
            />
          ))}

          {/* Km range pulsing rings — Uber-style, auto-hides after 5s */}
          {selectedKmRange && kmPulseVisible && (
            <Marker
              position={[selectedKmRange.centerLat, selectedKmRange.centerLng]}
              icon={L.divIcon({
                html: `<div class="km-pulse-ring"></div><div class="km-pulse-ring km-pulse-ring-2"></div><div class="km-pulse-ring km-pulse-ring-3"></div>`,
                className: '',
                iconSize: [0, 0] as unknown as L.PointExpression,
                iconAnchor: [0, 0] as unknown as L.PointExpression,
              })}
            />
          )}
        </MapContainer>

        {/* Pin overlay — sits above the Leaflet canvas */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} onWheel={forwardWheel}>
          {dropZones.map((zone, i) => (
            <DroppablePin
              key={zone.id}
              zone={zone}
              index={i}
              pos={positions[zone.id]}
              submitted={submitted}
              hasQuiz={quizPinIds?.has(zone.id) ?? false}
              hiddenPinId={hiddenPinId}
              completedQuizPinIds={completedQuizPinIds}
              blinkingPinId={blinkingPinId}
              selectedLabelId={selectedLabelId}
              masterPlanImage={masterPlanImages?.[zone.id]}
              masterPlanGallery={masterPlanGalleries?.[zone.id]}
              onRemove={onRemove}
              onPinClick={onPinClick}
              onLabelPlace={onLabelPlace}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
