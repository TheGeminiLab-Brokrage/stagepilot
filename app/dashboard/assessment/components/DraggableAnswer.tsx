'use client';

import { useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DraggableAnswerProps {
  id: string;
  label: string;
  isPlaced: boolean;
  isDragOverlay?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export default function DraggableAnswer({
  id,
  label,
  isPlaced,
  isDragOverlay,
  isSelected,
  onSelect,
}: DraggableAnswerProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: isDragOverlay || isPlaced,
  });

  const wasDragging = useRef(false);
  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  const baseTransform = isDragOverlay ? undefined : CSS.Translate.toString(transform);

  // ── Placed (strikethrough ghost) ─────────────────────────────────────────────
  if (isPlaced) {
    return (
      <div
        style={{
          transform: baseTransform,
          fontFamily: 'var(--font-space)',
          background: 'rgba(215,255,0,0.02)',
          border: '1px solid rgba(215,255,0,0.08)',
          padding: '9px 14px 9px 18px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          textDecoration: 'line-through',
          opacity: 0.3,
          color: 'rgba(215,255,0,0.7)',
          userSelect: 'none',
          boxShadow: 'inset 3px 0 0 rgba(215,255,0,0.1)',
        }}
      >
        {label}
      </div>
    );
  }

  // ── Drag ghost placeholder ────────────────────────────────────────────────────
  if (isDragging && !isDragOverlay) {
    return (
      <div
        style={{
          transform: baseTransform,
          background: 'transparent',
          border: '1px dashed rgba(215,255,0,0.18)',
          padding: '9px 14px 9px 18px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          opacity: 0.2,
          color: 'transparent',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
    );
  }

  // ── Drag overlay (floating copy) ──────────────────────────────────────────────
  if (isDragOverlay) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-space)',
          background: '#D7FF00',
          border: '1px solid #D7FF00',
          padding: '9px 16px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: '#000',
          userSelect: 'none',
          cursor: 'grabbing',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(215,255,0,0.4)',
          transform: 'scale(1.04)',
        }}
      >
        {label}
      </div>
    );
  }

  // ── Active / default ──────────────────────────────────────────────────────────
  return (
    <div
      ref={setNodeRef}
      className={`draggable-token${isSelected ? ' token-selected' : ''}`}
      style={{
        transform: baseTransform,
        fontFamily: 'var(--font-space)',
        background: isSelected
          ? 'linear-gradient(135deg, rgba(215,255,0,0.14) 0%, rgba(215,255,0,0.06) 100%)'
          : 'linear-gradient(135deg, rgba(215,255,0,0.06) 0%, rgba(215,255,0,0.01) 100%), #111111',
        border: isSelected
          ? '1px solid rgba(215,255,0,0.65)'
          : '1px solid rgba(215,255,0,0.2)',
        boxShadow: isSelected
          ? '0 0 0 2px rgba(215,255,0,0.18), 0 4px 20px rgba(215,255,0,0.15), inset 3px 0 0 rgba(215,255,0,0.85), inset 0 1px 0 rgba(215,255,0,0.1)'
          : '0 2px 8px rgba(0,0,0,0.5), inset 3px 0 0 rgba(215,255,0,0.3), inset 0 1px 0 rgba(215,255,0,0.05)',
        padding: '9px 14px 9px 18px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: isSelected ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.9)',
        userSelect: 'none',
        cursor: isSelected ? 'crosshair' : 'grab',
        display: 'block',
      }}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (wasDragging.current) { wasDragging.current = false; return; }
        onSelect?.(id);
      }}
    >
      {label}
    </div>
  );
}
