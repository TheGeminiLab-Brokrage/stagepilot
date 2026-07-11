'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet';
import { KM_MARKER_LABELS } from '@/lib/assessment/data/km-markers';
import { useDroppable } from '@dnd-kit/core';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface DropZone {
  id: string;
  label: string;
  lat: number;
  lng: number;
  accepted: string | null;
  type?: 'landmark' | 'road';
}

const ZONE_COLORS: Record<string, string> = {
  'zone-1': '#a855f7',
  'zone-2': '#f59e0b',
  'zone-3': '#ef4444',
  'zone-4': '#3b82f6',
  'zone-5': '#ff3cac',
  'zone-6': '#10b981',
};

// ─── MapRefCapture ────────────────────────────────────────────────────────────

function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
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
    return () => {
      map.off('move zoom viewreset resize', update);
    };
  }, [map, update]);

  return null;
}

// ─── DroppablePin ─────────────────────────────────────────────────────────────

function DroppablePin({
  zone,
  index,
  pos,
  submitted,
  selectedLabelId,
  onRemove,
  onLabelPlace,
}: {
  zone: DropZone;
  index: number;
  pos: { x: number; y: number } | undefined;
  submitted: boolean;
  selectedLabelId?: string | null;
  onRemove?: (zoneId: string) => void;
  onLabelPlace?: (zoneId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone.id });
  const baseColor = ZONE_COLORS[zone.id] ?? '#D7FF00';

  const answered = !!zone.accepted;
  const isCorrect = submitted && zone.accepted === zone.label;
  const isWrong = submitted && answered && zone.accepted !== zone.label;
  const pinColor = isCorrect ? '#D7FF00' : isWrong ? '#ef4444' : baseColor;
  const placementMode = !!selectedLabelId && !submitted;

  if (!pos) return null;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (placementMode) {
          e.stopPropagation();
          onLabelPlace?.(zone.id);
        }
      }}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: 80,
        height: 80,
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        pointerEvents: 'all',
        cursor: placementMode ? 'crosshair' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer glow halo */}
      <div
        style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${pinColor}33 0%, transparent 70%)`,
          opacity: isOver || placementMode ? 1 : answered ? 0.3 : 0.7,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
          animation: answered || submitted ? 'none' : 'pin-pulse-ring 2.5s ease-in-out infinite',
        }}
      />

      {/* Colored ring */}
      <div
        style={{
          position: 'absolute',
          width: 62,
          height: 62,
          borderRadius: '50%',
          left: '50%',
          top: '50%',
          transform: isOver ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%)',
          border: `2px solid ${pinColor}`,
          opacity: isOver ? 1 : answered ? 0.5 : 0.65,
          boxShadow: isOver ? `0 0 16px ${pinColor}88` : answered ? `0 0 10px ${pinColor}44` : 'none',
          transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.2s',
          pointerEvents: 'none',
        }}
      />

      {/* Pin circle */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: answered ? pinColor : baseColor,
          border: '2.5px solid rgba(0,0,0,0.5)',
          boxShadow: `0 2px 12px ${pinColor}88, 0 0 0 1px ${pinColor}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'background 0.25s, transform 0.15s',
          transform: isOver ? 'scale(1.15)' : 'scale(1)',
          animation: answered || submitted ? 'none' : 'pin-pulse 2.5s ease-in-out infinite',
        }}
      >
        {submitted ? (
          <span style={{ color: isCorrect ? '#000' : '#fff', fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-space)' }}>
            {isCorrect ? '✓' : '✗'}
          </span>
        ) : answered ? (
          <span style={{ color: '#000', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space)' }}>●</span>
        ) : (
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space)' }}>
            {index + 1}
          </span>
        )}
      </div>

      {/* Answer badge */}
      {answered && (
        <div
          onClick={!submitted && onRemove ? (e) => { e.stopPropagation(); onRemove(zone.id); } : undefined}
          style={{
            position: 'absolute',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            background: submitted ? (isCorrect ? '#D7FF00' : '#ef4444') : 'rgba(8, 10, 20, 0.88)',
            color: submitted ? (isCorrect ? '#000' : '#fff') : '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: submitted ? '2px 8px' : '2px 6px 2px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: submitted
              ? isCorrect ? '0 0 10px rgba(215,255,0,0.5)' : '0 0 10px rgba(239,68,68,0.5)'
              : '0 2px 10px rgba(0,0,0,0.5)',
            border: submitted ? 'none' : '1px solid rgba(215,255,0,0.3)',
            pointerEvents: submitted ? 'none' : 'all',
            cursor: submitted ? 'default' : 'pointer',
            fontFamily: 'var(--font-space, "Space Grotesk", sans-serif)',
            letterSpacing: '0.02em',
            transition: 'background 0.3s, color 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {submitted && isWrong ? zone.label : zone.accepted}
          {!submitted && (
            <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.85, fontWeight: 900, marginTop: -1 }}>×</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────────

interface MapProps {
  center: [number, number];
  zoom: number;
  dropZones: DropZone[];
  submitted: boolean;
  selectedLabelId?: string | null;
  onRemove?: (zoneId: string) => void;
  onLabelPlace?: (zoneId: string) => void;
  onDeselectLabel?: () => void;
  onReady?: () => void;
}

export default function Map({
  center,
  zoom,
  dropZones,
  submitted,
  selectedLabelId,
  onRemove,
  onLabelPlace,
  onDeselectLabel,
  onReady,
}: MapProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const mapRef = useRef<L.Map | null>(null);

  const handlePositions = useCallback((pos: Record<string, { x: number; y: number }>) => {
    setPositions(pos);
  }, []);

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

  useEffect(() => {
    onReady?.();
  // onReady intentionally excluded — we only call it once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={zoom}
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
        <MapTracker dropZones={dropZones} onPositionsUpdate={handlePositions} />
        {selectedLabelId && onDeselectLabel && (
          <MapClickHandler onMapClick={onDeselectLabel} />
        )}

        {/* Km boundary labels along the North Coast road */}
        {KM_MARKER_LABELS.map((m) => (
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
      </MapContainer>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} onWheel={forwardWheel}>
        {dropZones.map((zone, i) => (
          <DroppablePin
            key={zone.id}
            zone={zone}
            index={i}
            pos={positions[zone.id]}
            submitted={submitted}
            selectedLabelId={selectedLabelId}
            onRemove={onRemove}
            onLabelPlace={onLabelPlace}
          />
        ))}
      </div>
    </div>
  );
}
