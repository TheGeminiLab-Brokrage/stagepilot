'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  rectIntersection,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { cursorCollision } from '@/lib/assessment/utils/collision';
import DraggableAnswer from '@/app/dashboard/assessment/components/DraggableAnswer';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import PinQuizPanel from '@/app/dashboard/assessment/components/PinQuizPanel';
import type { DropZone } from '@/app/dashboard/assessment/components/Map';
import type { QuizPhase } from '@/app/dashboard/assessment/components/ZoomedMap';
import { SECTIONS } from '@/lib/assessment/data/landmarks';
import { PIN_QUIZZES } from '@/lib/assessment/data/pin-quizzes';
import { KM_RANGES } from '@/lib/assessment/data/km-ranges';
import type { KmRange } from '@/lib/assessment/data/km-ranges';
import { saveAnswers } from '@/lib/assessment/data-client';
import { QUESTIONS_BY_SECTION } from '@/lib/assessment/data/questions';

const masterPlanImageMap: Record<string, string> = Object.fromEntries(
  PIN_QUIZZES.filter((q) => q.masterPlanImage).map((q) => [q.landmarkId, q.masterPlanImage!])
);

const masterPlanGalleriesMap: Record<string, { src: string; label: string }[]> = Object.fromEntries(
  PIN_QUIZZES.filter((q) => q.masterPlanGallery).map((q) => [q.landmarkId, q.masterPlanGallery!])
);

const ZoomedMap = dynamic(() => import('@/app/dashboard/assessment/components/ZoomedMap'), { ssr: false });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildZones(sectionIdx: number): DropZone[] {
  return SECTIONS[sectionIdx].landmarks.map((lm) => ({
    id: lm.id,
    label: lm.label,
    lat: lm.lat,
    lng: lm.lng,
    accepted: null,
    type: lm.type,
  }));
}

function buildDisplayAnswers(zones: DropZone[]) {
  return shuffle(zones.map((z, i) => ({ id: `ans-${i}`, label: z.label })));
}

export default function Phase1Page() {
  const router = useRouter();

  const [initialSectionIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem('va_next_section_index');
    if (raw !== null) {
      localStorage.removeItem('va_next_section_index');
      const idx = Number(raw);
      return idx < SECTIONS.length ? idx : 0;
    }
    return 0;
  });

  const [sectionIndex, setSectionIndex]       = useState(initialSectionIndex);
  const [activeBoundsIndex, setActiveBoundsIndex] = useState(initialSectionIndex);
  const [transitioning, setTransitioning]     = useState(true);
  const [dropZones, setDropZones]             = useState<DropZone[]>([]);
  const [displayAnswers, setDisplayAnswers]   = useState<{ id: string; label: string }[]>([]);
  const [activeId, setActiveId]               = useState<string | null>(null);
  const [submitted, setSubmitted]             = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal]   = useState(false);
  const [showSkipModal, setShowSkipModal]     = useState(false);

  // Quiz mode state machine
  const [quizPhase, setQuizPhase]             = useState<QuizPhase>('idle');
  const [activePinQuizId, setActivePinQuizId] = useState<string | null>(null);
  const [activePinTarget, setActivePinTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [quizSubmitting, setQuizSubmitting]   = useState(false);
  const [completedQuizPinIds, setCompletedQuizPinIds] = useState<Set<string>>(new Set());
  const [starBlinking, setStarBlinking]       = useState(false);
  const [showQuizPrompt, setShowQuizPrompt]   = useState(false);
  const [selectedKmRange, setSelectedKmRange] = useState<KmRange | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const zones = buildZones(initialSectionIndex);
      setDropZones(zones);
      setDisplayAnswers(buildDisplayAnswers(zones));
      setTransitioning(false);
    }, 1800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quizPinIds     = new Set(PIN_QUIZZES.map((q) => q.landmarkId));
  const activePinQuiz  = PIN_QUIZZES.find((q) => q.landmarkId === activePinQuizId) ?? null;
  const section        = SECTIONS[sectionIndex];
  const activeBounds   = SECTIONS[activeBoundsIndex].bounds;
  const placedLabels   = dropZones.map((z) => z.accepted).filter(Boolean) as string[];
  const allPlaced      = dropZones.length === 0 || placedLabels.length === dropZones.length;
  const remaining      = dropZones.length - placedLabels.length;

  const sectionQuizPinIds = section.landmarks
    .filter((lm) => quizPinIds.has(lm.id))
    .map((lm) => lm.id);
  const allSectionQuizDone =
    sectionQuizPinIds.length === 0 ||
    sectionQuizPinIds.every((id) => completedQuizPinIds.has(id));

  const correctCount  = dropZones.filter((z) => z.accepted === z.label).length;
  const activeAnswer  = dropZones
    .map((z, i) => ({ id: `ans-${i}`, label: z.label }))
    .find((a) => a.id === activeId);
  const progress      = (sectionIndex / SECTIONS.length) * 100;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Drive layout widths from quiz phase
  const quizActive         = quizPhase === 'transitioning' || quizPhase === 'active';
  const MAP_NORMAL_WIDTH   = 'calc(100% - 228px)';
  const MAP_QUIZ_WIDTH     = '40%';
  const SIDEBAR_NORMAL_WIDTH = '208px';
  const SIDEBAR_QUIZ_WIDTH = '60%';

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (submitted) return;
    const { active, over } = event;
    if (!over) return;
    const idx        = parseInt((active.id as string).replace('ans-', ''), 10);
    const answer     = dropZones[idx];
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
    if (submitted || transitioning || quizPhase !== 'idle') return;
    setSelectedLabelId((prev) => prev === labelId ? null : labelId);
  }

  function handleLabelPlace(zoneId: string) {
    if (!selectedLabelId || submitted) return;
    const idx       = parseInt(selectedLabelId.replace('ans-', ''), 10);
    const labelText = dropZones[idx]?.label;
    if (!labelText) return;
    setDropZones((prev) => prev.map((z) => z.id === zoneId ? { ...z, accepted: labelText } : z));
    setSelectedLabelId(null);
  }

  function handleDeselectLabel() {
    setSelectedLabelId(null);
  }

  function handlePinClick(zoneId: string) {
    if (submitted || transitioning || quizPhase !== 'idle') return;
    const quiz = PIN_QUIZZES.find((q) => q.landmarkId === zoneId);
    if (!quiz) return;

    setStarBlinking(false);
    setShowQuizPrompt(false);
    setSelectedLabelId(null);
    setActivePinQuizId(zoneId);
    setActivePinTarget(quiz.focusPoint);
    setQuizPhase('zooming');

    setTimeout(() => {
      setQuizPhase('transitioning');
      setTimeout(() => { setQuizPhase('active'); }, 800);
    }, 2000);
  }

  const handleQuizSubmit = useCallback(async (ans: Record<string, string>) => {
    setQuizSubmitting(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId && activePinQuiz) {
      await saveAnswers(sessionId, activePinQuiz.questions.map((q) => {
        const given = ans[q.id] ?? null;
        let correct = false;
        if (q.type === 'mcq' || q.type === 'truefalse') {
          correct = given !== null && given.toLowerCase() === String(q.answer).toLowerCase();
        } else if (q.type === 'multiselect') {
          const givenArr: string[] = given ? JSON.parse(given) : [];
          const correctArr = Array.isArray(q.answer) ? (q.answer as string[]) : [];
          correct = givenArr.length === correctArr.length && givenArr.every((a) => correctArr.includes(a));
        }
        return { phase: `phase1_pin_${activePinQuizId}`, question_id: q.id, answer_given: given, correct };
      }));
    }
    setQuizSubmitting(false);
    setCompletedQuizPinIds((prev) => new Set([...prev, activePinQuizId!]));
    setStarBlinking(false);
    setShowQuizPrompt(false);
    setQuizPhase('idle');
    setActivePinQuizId(null);
    setActivePinTarget(null);
  }, [activePinQuiz, activePinQuizId]);

  function handleQuizExit() {
    setQuizPhase('idle');
    setActivePinQuizId(null);
    setActivePinTarget(null);
  }

  function advanceSection(nextIdx: number, zones: DropZone[]) {
    setTransitioning(true);
    setActiveBoundsIndex(nextIdx);
    setTimeout(() => {
      setSectionIndex(nextIdx);
      setDropZones(zones);
      setDisplayAnswers(buildDisplayAnswers(zones));
      setSubmitted(false);
      setTransitioning(false);
      setStarBlinking(false);
      setShowQuizPrompt(false);
      setSelectedLabelId(null);
      setCompletedQuizPinIds(new Set());
    }, 1800);
  }

  const handleSkipConfirm = useCallback(async () => {
    if (saving) return;
    setShowSkipModal(false);
    setSaving(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      for (const quizPinId of sectionQuizPinIds) {
        if (!completedQuizPinIds.has(quizPinId)) {
          const quiz = PIN_QUIZZES.find((q) => q.landmarkId === quizPinId);
          if (quiz) {
            await saveAnswers(sessionId, quiz.questions.map((q) => ({
              phase: `phase1_pin_${quizPinId}`,
              question_id: q.id,
              answer_given: null,
              correct: false,
            })));
          }
        }
      }
      if (dropZones.length > 0) {
        await saveAnswers(sessionId, dropZones.map((z) => ({
          phase: `phase1_${section.id}`,
          question_id: z.id,
          answer_given: z.accepted,
          correct: z.accepted === z.label,
        })));
      }
    }
    setSaving(false);
    const hasQuestions = (QUESTIONS_BY_SECTION[section.id]?.length ?? 0) > 0;
    if (hasQuestions) {
      localStorage.setItem('va_next_section_index', String(sectionIndex + 1));
      router.push(`/dashboard/assessment/section-quiz/${section.id}`);
    } else if (sectionIndex < SECTIONS.length - 1) {
      const nextIdx   = sectionIndex + 1;
      const nextZones = buildZones(nextIdx);
      advanceSection(nextIdx, nextZones);
    } else {
      router.push('/dashboard/assessment/quiz');
    }
  }, [saving, sectionQuizPinIds, completedQuizPinIds, dropZones, section.id, sectionIndex, router]);

  const handleContinue = useCallback(async () => {
    setSaving(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId && dropZones.length > 0) {
      await saveAnswers(sessionId, dropZones.map((z) => ({
        phase: `phase1_${section.id}`,
        question_id: z.id,
        answer_given: z.accepted,
        correct: z.accepted === z.label,
      })));
    }
    setSaving(false);
    const hasQuestions = (QUESTIONS_BY_SECTION[section.id]?.length ?? 0) > 0;
    if (hasQuestions) {
      localStorage.setItem('va_next_section_index', String(sectionIndex + 1));
      router.push(`/dashboard/assessment/section-quiz/${section.id}`);
    } else if (sectionIndex < SECTIONS.length - 1) {
      const nextIdx   = sectionIndex + 1;
      const nextZones = buildZones(nextIdx);
      advanceSection(nextIdx, nextZones);
    } else {
      router.push('/dashboard/assessment/quiz');
    }
  }, [dropZones, sectionIndex, section.id, router]);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>

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
                  className="font-bold leading-none truncate"
                  style={{
                    fontFamily: 'var(--font-space)',
                    fontSize: 15,
                    color: 'var(--tgl-white)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 0 20px rgba(215,255,0,0.15)',
                  }}
                >
                  {section.label}
                </h1>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-montserrat)' }}
                >
                  {submitted
                    ? 'Section Complete'
                    : `Section ${sectionIndex + 1} of ${SECTIONS.length} — Label the landmarks`}
                </p>
              </div>
            </div>

            {/* Section counter + progress dots */}
            <div className="flex items-center gap-2 shrink-0">
              {SECTIONS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === sectionIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 99,
                    background: i < sectionIndex
                      ? 'rgba(215,255,0,0.5)'
                      : i === sectionIndex
                        ? 'var(--tgl-lime)'
                        : 'rgba(255,255,255,0.12)',
                    boxShadow: i === sectionIndex ? '0 0 8px rgba(215,255,0,0.6)' : 'none',
                    transition: 'width 0.3s ease, background 0.3s ease',
                    animation: i === sectionIndex ? 'pin-pulse-ring 2s ease-in-out infinite' : 'none',
                  }}
                />
              ))}
            </div>
          </header>

          {/* ── Progress bar ── */}
          <div className="shrink-0 px-6 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}
              >
                Overall Progress
              </span>
              <span
                className="text-xs font-bold"
                style={{
                  color: 'var(--tgl-lime)',
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
                  background: 'var(--tgl-lime)',
                  boxShadow: progress > 0 ? '0 0 10px rgba(215,255,0,0.8), 0 0 24px rgba(215,255,0,0.3)' : 'none',
                  transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
          </div>

          {/* ── Main content ── */}
          <div className="flex flex-1 min-h-0" style={{ padding: 20, gap: 20 }}>

            {/* Map container */}
            <div
              style={{
                width: quizActive ? MAP_QUIZ_WIDTH : MAP_NORMAL_WIDTH,
                flexShrink: 0,
                transition: 'width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                borderRadius: 16,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(215,255,0,0.1)',
                boxShadow: '0 0 60px rgba(215,255,0,0.05), 0 0 120px rgba(215,255,0,0.03), inset 0 0 0 1px rgba(215,255,0,0.04)',
                minHeight: 460,
              }}
            >
              <ZoomedMap
                bounds={activeBounds}
                dropZones={dropZones}
                submitted={submitted}
                onRemove={handleRemove}
                onPinClick={handlePinClick}
                quizPinIds={quizPinIds}
                quizPhase={quizPhase}
                activePinTarget={activePinTarget ?? undefined}
                hiddenPinId={activePinQuizId}
                completedQuizPinIds={completedQuizPinIds}
                blinkingPinId={starBlinking ? (sectionQuizPinIds.find((id) => !completedQuizPinIds.has(id)) ?? null) : null}
                selectedLabelId={selectedLabelId}
                onLabelPlace={handleLabelPlace}
                onDeselectLabel={handleDeselectLabel}
                masterPlanImages={masterPlanImageMap}
                masterPlanGalleries={masterPlanGalleriesMap}
                selectedKmRange={selectedKmRange}
              />

              {/* Km range dropdown — top-right overlay on map */}
              {quizPhase === 'idle' && !transitioning && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 1100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {selectedKmRange && (
                    <button
                      onClick={() => setSelectedKmRange(null)}
                      title="Clear km range"
                      style={{
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid rgba(215,255,0,0.25)',
                        borderRadius: 8,
                        color: 'rgba(215,255,0,0.7)',
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 14,
                        backdropFilter: 'blur(8px)',
                        flexShrink: 0,
                        fontFamily: 'var(--font-space)',
                      }}
                    >
                      ×
                    </button>
                  )}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <select
                      value={selectedKmRange?.label ?? ''}
                      onChange={(e) => {
                        const range = KM_RANGES.find((r) => r.label === e.target.value) ?? null;
                        setSelectedKmRange(range);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.85)',
                        border: `1px solid ${selectedKmRange ? 'rgba(215,255,0,0.5)' : 'rgba(215,255,0,0.2)'}`,
                        borderRadius: 8,
                        color: selectedKmRange ? '#D7FF00' : 'rgba(255,255,255,0.45)',
                        fontSize: 11,
                        fontFamily: 'var(--font-space)',
                        fontWeight: 700,
                        padding: '5px 28px 5px 10px',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                        outline: 'none',
                        appearance: 'none' as const,
                        boxShadow: selectedKmRange ? '0 0 12px rgba(215,255,0,0.15)' : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s, color 0.2s',
                      }}
                    >
                      <option value="">⊞ Km range…</option>
                      {KM_RANGES.map((r) => (
                        <option key={r.label} value={r.label}>{r.label}</option>
                      ))}
                    </select>
                    <span
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(215,255,0,0.5)',
                        fontSize: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      ▾
                    </span>
                  </div>
                </div>
              )}

              {/* Masterplan PNG */}
              {activePinQuiz && (quizPhase === 'transitioning' || quizPhase === 'active') && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#000',
                    zIndex: 1500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: quizPhase === 'active' ? 1 : 0,
                    transition: 'opacity 0.8s ease',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePinQuiz.masterPlanImage}
                    alt="Compound masterplan"
                    style={{
                      maxWidth: '90%',
                      maxHeight: '90%',
                      objectFit: 'contain',
                      animation: quizPhase === 'active'
                        ? 'masterplan-entrance 1s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                        : 'none',
                    }}
                  />
                </div>
              )}

              {/* Section transition overlay */}
              {transitioning && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '2px solid rgba(215,255,0,0.15)',
                        borderTopColor: 'var(--tgl-lime)',
                        animation: 'spin 0.9s linear infinite',
                        margin: '0 auto 10px',
                        boxShadow: '0 0 14px rgba(215,255,0,0.2)',
                      }}
                    />
                    <div
                      style={{
                        color: 'var(--tgl-lime)',
                        fontFamily: 'var(--font-space)',
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        textShadow: '0 0 16px rgba(215,255,0,0.4)',
                      }}
                    >
                      Flying to {SECTIONS[activeBoundsIndex].label}…
                    </div>
                    <div
                      style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'var(--font-montserrat)', marginTop: 3 }}
                    >
                      Zooming in
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside
              style={{
                width: quizActive ? SIDEBAR_QUIZ_WIDTH : SIDEBAR_NORMAL_WIDTH,
                flexShrink: 0,
                transition: 'width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflow: 'hidden',
                ...(quizActive ? {} : {
                  background: 'linear-gradient(180deg, #0d0d0d 0%, #090909 100%)',
                  border: '1px solid rgba(215,255,0,0.1)',
                  borderTop: '2px solid rgba(215,255,0,0.45)',
                  borderRadius: 14,
                  padding: '14px 12px 12px',
                  boxShadow: '0 0 40px rgba(215,255,0,0.04), inset 0 1px 0 rgba(215,255,0,0.06)',
                }),
              }}
            >
              {quizPhase === 'active' && activePinQuiz ? (
                /* Active quiz */
                <PinQuizPanel
                  quiz={activePinQuiz}
                  onSubmit={handleQuizSubmit}
                  submitting={quizSubmitting}
                  onExit={handleQuizExit}
                />
              ) : quizPhase === 'zooming' || quizPhase === 'transitioning' ? (
                /* Entering compound placeholder */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: '2px solid rgba(215,255,0,0.15)',
                      borderTopColor: 'var(--tgl-lime)',
                      animation: 'spin 1s linear infinite',
                      boxShadow: '0 0 14px rgba(215,255,0,0.2)',
                    }}
                  />
                  <p
                    style={{
                      fontSize: 12,
                      color: 'rgba(215,255,0,0.5)',
                      fontFamily: 'var(--font-space)',
                      textAlign: 'center',
                      lineHeight: 1.6,
                    }}
                  >
                    Entering project…
                  </p>
                </div>
              ) : dropZones.length === 0 ? (
                /* No landmarks */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  <div style={{ fontSize: 28 }}>📍</div>
                  <p
                    className="text-xs"
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontFamily: 'var(--font-montserrat)',
                      lineHeight: 1.6,
                    }}
                  >
                    Landmark content for {section.label} coming soon.
                  </p>
                  <button
                    onClick={handleContinue}
                    disabled={saving || transitioning}
                    className="w-full py-2.5 rounded-xl text-sm font-bold active:scale-95"
                    style={{
                      background: saving || transitioning ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                      color: saving || transitioning ? 'rgba(215,255,0,0.4)' : '#000',
                      boxShadow: saving || transitioning ? 'none' : '0 0 18px rgba(215,255,0,0.4)',
                      fontFamily: 'var(--font-space)',
                      cursor: saving || transitioning ? 'not-allowed' : 'pointer',
                      border: 'none',
                      transition: 'box-shadow 150ms ease',
                    }}
                  >
                    {saving ? 'Saving…' : sectionIndex < SECTIONS.length - 1 ? 'Next Section →' : 'To Quiz →'}
                  </button>
                </div>
              ) : submitted ? (
                /* Results */
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                  <div
                    style={{
                      fontSize: 52,
                      fontWeight: 900,
                      fontFamily: 'var(--font-space)',
                      color: correctCount === dropZones.length ? 'var(--tgl-lime)' : '#ef4444',
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      textShadow: correctCount === dropZones.length
                        ? '0 0 30px rgba(215,255,0,0.55), 0 0 70px rgba(215,255,0,0.2)'
                        : '0 0 24px rgba(239,68,68,0.45)',
                      animation: 'score-entrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    }}
                  >
                    {correctCount}/{dropZones.length}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: 'var(--font-montserrat)',
                    }}
                  >
                    {correctCount === dropZones.length ? 'Perfect!' : `${dropZones.length - correctCount} wrong`}
                  </p>
                  <button
                    onClick={handleContinue}
                    disabled={saving || transitioning}
                    className="w-full py-2.5 rounded-xl text-sm font-bold active:scale-95"
                    style={{
                      background: saving || transitioning ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                      color: saving || transitioning ? 'rgba(215,255,0,0.4)' : '#000',
                      boxShadow: saving || transitioning ? 'none' : '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)',
                      fontFamily: 'var(--font-space)',
                      cursor: saving || transitioning ? 'not-allowed' : 'pointer',
                      border: 'none',
                      transition: 'box-shadow 150ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!saving && !transitioning)
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(215,255,0,0.6), 0 0 70px rgba(215,255,0,0.18)';
                    }}
                    onMouseLeave={e => {
                      if (!saving && !transitioning)
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(215,255,0,0.4), 0 0 50px rgba(215,255,0,0.12)';
                    }}
                  >
                    {saving ? 'Saving…' : sectionIndex < SECTIONS.length - 1 ? 'Next Section →' : 'To Quiz →'}
                  </button>
                </div>
              ) : (
                /* ── Drag labels + submit ── */
                <>
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
                      Landmarks
                    </p>
                    {remaining > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'var(--font-space)',
                          color: 'rgba(255,255,255,0.35)',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 99,
                          padding: '2px 8px',
                        }}
                      >
                        {remaining} left
                      </span>
                    )}
                  </div>

                  {/* Shuffled answer tokens */}
                  <div className="flex flex-col gap-2 flex-1 landmark-scroll" style={{ overflowY: 'auto', minHeight: 0 }}>
                    {displayAnswers.map((ans, i) => (
                      <div
                        key={`${sectionIndex}-${ans.id}`}
                        style={{
                          animation: 'token-appear 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                          animationDelay: `${i * 50}ms`,
                        }}
                      >
                        <DraggableAnswer
                          id={ans.id}
                          label={ans.label}
                          isPlaced={placedLabels.includes(ans.label)}
                          isSelected={selectedLabelId === ans.id}
                          onSelect={handleLabelSelect}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Submit */}
                  <button
                    onClick={() => {
                      if (!allPlaced) return;
                      if (!allSectionQuizDone) {
                        setStarBlinking(true);
                        setShowQuizPrompt(true);
                        return;
                      }
                      setSubmitted(true);
                    }}
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
                  >
                    {allPlaced ? '✓ Submit' : `${placedLabels.length} / ${dropZones.length} Placed`}
                  </button>

                  {/* Skip — visible to all users */}
                  <button
                    onClick={() => setShowSkipModal(true)}
                    disabled={saving || transitioning}
                    className="w-full py-2 rounded-xl text-xs font-bold shrink-0"
                    style={{
                      fontFamily: 'var(--font-space)',
                      background: 'transparent',
                      color: 'rgba(239,68,68,0.65)',
                      border: '1px dashed rgba(239,68,68,0.22)',
                      cursor: saving || transitioning ? 'not-allowed' : 'pointer',
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

                  {/* Quiz prompt */}
                  {showQuizPrompt && !allSectionQuizDone && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(215,255,0,0.05)',
                        border: '1px solid rgba(215,255,0,0.18)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--tgl-lime)',
                          fontSize: 14,
                          flexShrink: 0,
                          animation: 'star-blink 0.8s ease-in-out infinite',
                        }}
                      >
                        ✦
                      </span>
                      <p
                        style={{
                          color: 'rgba(215,255,0,0.65)',
                          fontSize: 11,
                          fontFamily: 'var(--font-space)',
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        Click the ✦ star on the map to complete the project quiz first
                      </p>
                    </div>
                  )}
                </>
              )}
            </aside>
          </div>
        </div>

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
