'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import DraggableAnswer from '@/app/dashboard/assessment/components/DraggableAnswer';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import type { DropZone } from '@/app/dashboard/assessment/components/Map';
import { saveAnswers } from '@/lib/assessment/data-client';
import { cursorCollision } from '@/lib/assessment/utils/collision';

const Map = dynamic(() => import('@/app/dashboard/assessment/components/Map'), { ssr: false });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const INITIAL_DROP_ZONES: DropZone[] = [
  { id: 'zone-1', label: 'Sidi Heneish',      lat: 31.1630,    lng: 27.6270,    accepted: null },
  { id: 'zone-2', label: 'Ras Al Hekma',      lat: 31.1944,    lng: 27.7881,    accepted: null },
  { id: 'zone-3', label: 'El Dabaa',          lat: 31.0322,    lng: 28.4444,    accepted: null },
  { id: 'zone-4', label: 'Sidi Abdel Rahman', lat: 30.9619,    lng: 28.7369,    accepted: null },
  { id: 'zone-5', label: 'Marina',            lat: 30.826013,  lng: 28.993615,  accepted: null },
  { id: 'zone-6', label: 'New Alamein',       lat: 30.8572,    lng: 28.8547,    accepted: null },
];

const TOTAL = INITIAL_DROP_ZONES.length;

export default function GamePage() {
  const router = useRouter();

  // Answers are shuffled once on mount so order never matches pin order
  const [answers] = useState(() =>
    shuffle(INITIAL_DROP_ZONES.map((z, i) => ({ id: `ans-${i}`, label: z.label })))
  );

  const [dropZones, setDropZones]           = useState<DropZone[]>(INITIAL_DROP_ZONES);
  const [activeId, setActiveId]             = useState<string | null>(null);
  const [submitted, setSubmitted]           = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [mapReady, setMapReady]             = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSkipModal, setShowSkipModal]   = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const placedLabels  = dropZones.map((z) => z.accepted).filter(Boolean) as string[];
  const placedCount   = placedLabels.length;
  const correctCount  = dropZones.filter((z) => z.accepted === z.label).length;
  const allPlaced     = placedCount === TOTAL;
  const remaining     = TOTAL - placedCount;
  const activeAnswer  = answers.find((a) => a.id === activeId);
  const displayScore  = submitted ? correctCount : placedCount;
  const progress      = (displayScore / TOTAL) * 100;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (submitted) return;
    const { active, over } = event;
    if (!over) return;
    const answer     = answers.find((a) => a.id === (active.id as string));
    const targetZone = dropZones.find((z) => z.id === (over.id as string));
    if (!answer || !targetZone) return;
    setDropZones((prev) =>
      prev.map((z) => z.id === targetZone.id ? { ...z, accepted: answer.label } : z)
    );
  }

  function handleRemove(zoneId: string) {
    if (submitted) return;
    setDropZones((prev) => prev.map((z) => z.id === zoneId ? { ...z, accepted: null } : z));
  }

  function handleLabelSelect(labelId: string) {
    if (submitted) return;
    setSelectedLabelId((prev) => prev === labelId ? null : labelId);
  }

  function handleLabelPlace(zoneId: string) {
    if (!selectedLabelId || submitted) return;
    const answer = answers.find((a) => a.id === selectedLabelId);
    if (!answer) return;
    setDropZones((prev) => prev.map((z) => z.id === zoneId ? { ...z, accepted: answer.label } : z));
    setSelectedLabelId(null);
  }

  function handleDeselectLabel() {
    setSelectedLabelId(null);
  }

  const handleSkipConfirm = useCallback(async () => {
    setShowSkipModal(false);
    setSaving(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      await saveAnswers(sessionId, dropZones.map((z) => ({
        phase: 'phase0',
        question_id: z.id,
        answer_given: z.accepted,
        correct: z.accepted === z.label,
      })));
    }
    router.push('/dashboard/assessment/phase1');
  }, [dropZones, router]);

  const handleContinue = useCallback(async () => {
    setSaving(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      await saveAnswers(sessionId, dropZones.map((z) => ({
        phase: 'phase0',
        question_id: z.id,
        answer_given: z.accepted,
        correct: z.accepted === z.label,
      })));
    }
    router.push('/dashboard/assessment/phase1');
  }, [dropZones, router]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={cursorCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>

          {/* ── Header ── */}
          <header
            className="px-5 py-3.5 flex items-center gap-3 shrink-0"
            style={{
              borderBottom: '1px solid rgba(215,255,0,0.1)',
              boxShadow: '0 1px 0 rgba(215,255,0,0.05), 0 4px 24px rgba(0,0,0,0.4)',
              background: 'rgba(0,0,0,0.96)',
              backdropFilter: 'blur(20px)',
              position: 'sticky',
              top: 0,
              zIndex: 30,
            }}
          >
            {/* Back / leave button */}
            <button
              onClick={() => setShowLeaveModal(true)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.45)',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 17,
                fontFamily: 'var(--font-space)',
                flexShrink: 0,
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
              }}
              title="Leave assessment"
            >
              ←
            </button>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Image src="/assessment/tgl-logo.png" alt="TGL" width={34} height={34} className="object-contain shrink-0" />
              <div className="min-w-0">
                <h1
                  className="text-base font-bold leading-none truncate"
                  style={{
                    fontFamily: 'var(--font-space)',
                    color: 'var(--tgl-white)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  North Coast Assessment
                </h1>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-montserrat)' }}
                >
                  {submitted ? 'Results — Phase 1 of 3' : 'Phase 1 of 3 — Drag locations to pins'}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shrink-0"
              style={{
                border: `1px solid ${submitted
                  ? correctCount === TOTAL ? 'rgba(215,255,0,0.3)' : 'rgba(239,68,68,0.3)'
                  : 'rgba(215,255,0,0.22)'}`,
                fontFamily: 'var(--font-space)',
                color: submitted
                  ? correctCount === TOTAL ? 'var(--tgl-lime)' : '#ef4444'
                  : 'var(--tgl-lime)',
                background: submitted
                  ? correctCount === TOTAL ? 'rgba(215,255,0,0.07)' : 'rgba(239,68,68,0.07)'
                  : 'rgba(215,255,0,0.07)',
                boxShadow: submitted && correctCount === TOTAL
                  ? '0 0 14px rgba(215,255,0,0.22)'
                  : 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {displayScore}
              <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>/</span>
              {TOTAL}
            </div>
          </header>

          {/* ── Progress bar ── */}
          <div className="shrink-0 px-6 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}
              >
                {submitted ? 'Score' : 'Progress'}
              </span>
              <span
                className="text-xs font-bold"
                style={{
                  color: submitted
                    ? correctCount === TOTAL ? 'var(--tgl-lime)' : '#ef4444'
                    : 'var(--tgl-lime)',
                  fontFamily: 'var(--font-space)',
                  textShadow: progress > 0 ? '0 0 10px rgba(215,255,0,0.45)' : 'none',
                }}
              >
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(215,255,0,0.07)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: submitted
                    ? correctCount === TOTAL ? 'var(--tgl-lime)' : '#ef4444'
                    : 'var(--tgl-lime)',
                  boxShadow: progress > 0
                    ? submitted
                      ? correctCount === TOTAL
                        ? '0 0 10px rgba(215,255,0,0.8), 0 0 24px rgba(215,255,0,0.3)'
                        : '0 0 10px rgba(239,68,68,0.8)'
                      : '0 0 10px rgba(215,255,0,0.8), 0 0 24px rgba(215,255,0,0.3)'
                    : 'none',
                  transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s',
                }}
              />
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="flex flex-1 gap-5 p-5 min-h-0">

            {/* Map */}
            <div
              className="flex-1 rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(215,255,0,0.1)',
                boxShadow: '0 0 60px rgba(215,255,0,0.05), 0 0 120px rgba(215,255,0,0.03), inset 0 0 0 1px rgba(215,255,0,0.04)',
                minHeight: 460,
                position: 'relative',
              }}
            >
              {!mapReady && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    background: '#0d0d0d',
                    borderRadius: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      border: '2px solid rgba(215,255,0,0.1)',
                      borderTopColor: 'var(--tgl-lime)',
                      animation: 'spin 0.8s linear infinite',
                      boxShadow: '0 0 14px rgba(215,255,0,0.2)',
                    }}
                  />
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.28)',
                      fontSize: 12,
                      fontFamily: 'var(--font-montserrat)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Loading map…
                  </span>
                </div>
              )}
              <Map
                center={[31.05, 28.2]}
                zoom={9}
                dropZones={dropZones}
                submitted={submitted}
                selectedLabelId={selectedLabelId}
                onRemove={handleRemove}
                onLabelPlace={handleLabelPlace}
                onDeselectLabel={handleDeselectLabel}
                onReady={() => setMapReady(true)}
              />
            </div>

            {/* ── Answer sidebar ── */}
            <aside
              className="w-52 flex flex-col shrink-0"
              style={{
                background: 'linear-gradient(180deg, #0d0d0d 0%, #090909 100%)',
                border: '1px solid rgba(215,255,0,0.1)',
                borderTop: '2px solid rgba(215,255,0,0.45)',
                borderRadius: 14,
                padding: '14px 12px 12px',
                gap: 8,
                boxShadow: '0 0 40px rgba(215,255,0,0.04), inset 0 1px 0 rgba(215,255,0,0.06)',
              }}
            >
              {/* Panel label + count badge */}
              <div className="flex items-center justify-between shrink-0 mb-0.5">
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-space)',
                    color: 'rgba(215,255,0,0.5)',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  Drag to map
                </p>
                {!submitted && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-space)',
                      color: remaining === 0 ? 'rgba(215,255,0,0.55)' : 'rgba(255,255,255,0.35)',
                      background: remaining === 0 ? 'rgba(215,255,0,0.1)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${remaining === 0 ? 'rgba(215,255,0,0.2)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 99,
                      padding: '2px 8px',
                    }}
                  >
                    {remaining === 0 ? '✓ All placed' : `${remaining} left`}
                  </span>
                )}
              </div>

              {submitted ? (
                /* ── Results state ── */
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                  <div
                    style={{
                      fontSize: 52,
                      fontWeight: 900,
                      fontFamily: 'var(--font-space)',
                      color: correctCount === TOTAL ? 'var(--tgl-lime)' : '#ef4444',
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      textShadow: correctCount === TOTAL
                        ? '0 0 30px rgba(215,255,0,0.55), 0 0 70px rgba(215,255,0,0.2)'
                        : '0 0 24px rgba(239,68,68,0.45)',
                      animation: 'score-entrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    }}
                  >
                    {correctCount}/{TOTAL}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: 'var(--font-montserrat)',
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {correctCount === TOTAL ? 'Perfect score!' : `${TOTAL - correctCount} incorrect`}
                  </p>
                  <button
                    onClick={handleContinue}
                    disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-bold active:scale-95"
                    style={{
                      background: saving ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                      color: saving ? 'rgba(215,255,0,0.4)' : '#000',
                      boxShadow: saving ? 'none' : '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)',
                      fontFamily: 'var(--font-space)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      border: 'none',
                      transition: 'box-shadow 150ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!saving) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(215,255,0,0.6), 0 0 70px rgba(215,255,0,0.18)';
                    }}
                    onMouseLeave={e => {
                      if (!saving) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)';
                    }}
                  >
                    {saving ? 'Saving…' : 'Continue →'}
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Answer tokens (shuffled) ── */}
                  <div className="flex flex-col gap-2 flex-1">
                    {answers.map((answer, i) => (
                      <div
                        key={answer.id}
                        style={{
                          animation: 'token-appear 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                          animationDelay: `${i * 50}ms`,
                        }}
                      >
                        <DraggableAnswer
                          id={answer.id}
                          label={answer.label}
                          isPlaced={placedLabels.includes(answer.label)}
                          isSelected={selectedLabelId === answer.id}
                          onSelect={handleLabelSelect}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Submit */}
                  <button
                    disabled={!allPlaced}
                    onClick={() => allPlaced && setSubmitted(true)}
                    className="mt-3 w-full py-3 rounded-xl text-sm font-bold active:scale-95 shrink-0"
                    style={{
                      fontFamily: 'var(--font-space)',
                      background: allPlaced ? 'var(--tgl-lime)' : 'rgba(215,255,0,0.05)',
                      color: allPlaced ? '#000' : 'rgba(215,255,0,0.22)',
                      border: allPlaced ? 'none' : '1px solid rgba(215,255,0,0.1)',
                      boxShadow: allPlaced ? '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)' : 'none',
                      cursor: allPlaced ? 'pointer' : 'not-allowed',
                      transition: 'box-shadow 150ms ease, transform 150ms ease',
                    }}
                    onMouseEnter={e => {
                      if (allPlaced) {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(215,255,0,0.6), 0 0 70px rgba(215,255,0,0.18)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (allPlaced) {
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)';
                        (e.currentTarget as HTMLElement).style.transform = '';
                      }
                    }}
                    data-testid="done-button"
                  >
                    {allPlaced ? '✓ Submit' : `${placedCount} / ${TOTAL} Placed`}
                  </button>

                  {/* Skip — low opacity red, visible to all users */}
                  <button
                    onClick={() => setShowSkipModal(true)}
                    disabled={saving}
                    className="w-full py-2 rounded-xl text-xs font-bold shrink-0"
                    style={{
                      fontFamily: 'var(--font-space)',
                      background: 'transparent',
                      color: 'rgba(239,68,68,0.65)',
                      border: '1px dashed rgba(239,68,68,0.22)',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: 0.5,
                      marginTop: 4,
                      transition: 'opacity 150ms ease, border-color 150ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.5';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.22)';
                    }}
                  >
                    Skip Section →
                  </button>
                </>
              )}
            </aside>
          </div>
        </div>

        {/* DragOverlay — floats above Leaflet */}
        <DragOverlay dropAnimation={null}>
          {activeAnswer ? (
            <DraggableAnswer
              id={activeAnswer.id}
              label={activeAnswer.label}
              isPlaced={false}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Leave modal ── */}
      {showLeaveModal && (
        <ConfirmModal
          title="Leave Assessment?"
          body="Your progress will not be saved. Any answers you've placed will be lost permanently."
          confirmLabel="Leave"
          cancelLabel="Stay"
          variant="red"
          onConfirm={() => router.push('/dashboard/assessment')}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {/* ── Skip modal ── */}
      {showSkipModal && (
        <ConfirmModal
          title="Skip this section?"
          body="Any pins you haven't placed will be marked as incorrect (0 pts). Placed pins keep their answer. This cannot be undone."
          confirmLabel="Skip Anyway"
          cancelLabel="Go Back"
          variant="red"
          onConfirm={handleSkipConfirm}
          onCancel={() => setShowSkipModal(false)}
        />
      )}
    </>
  );
}
