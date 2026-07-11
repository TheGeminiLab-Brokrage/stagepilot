'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CapitalMap, { CAPITAL_NO_PIN_IDS } from '@/app/dashboard/assessment/components/CapitalMap';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import Part2Modal from '@/app/dashboard/assessment/components/Part2Modal';
import { CAPITAL_ZONES } from '@/lib/assessment/data/landmarks-capital';
import { saveAnswers, markSessionComplete } from '@/lib/assessment/data-client';
import { gradeZoneForm, UNIQUE_DEVELOPERS, UNIQUE_PROJECTS } from '@/lib/assessment/data/zone-answers-capital';
import CapitalIntroModal from '@/app/dashboard/assessment/components/CapitalIntroModal';

const TOTAL = CAPITAL_ZONES.filter(z => !CAPITAL_NO_PIN_IDS.has(z.id)).length;

function Dropdown({ value, onChange, options, placeholder, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleTriggerClick() {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleTriggerClick}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 8,
          padding: '9px 12px',
          fontSize: 13,
          fontFamily: 'var(--font-space)',
          direction: 'rtl',
          cursor: open ? 'text' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
          transition: 'border-color 150ms',
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'var(--font-space)',
              textAlign: 'right',
              direction: 'rtl',
              width: '100%',
            }}
          />
        ) : (
          <span style={{ flex: 1, color: value ? '#fff' : 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
            {value || placeholder}
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 6 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#111',
          border: '1px solid rgba(255,215,0,0.25)',
          borderRadius: 8,
          maxHeight: 180,
          overflowY: 'auto',
          zIndex: 200,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>
              لا توجد نتائج
            </div>
          ) : filtered.map(opt => (
            <div
              key={opt}
              onMouseDown={() => { onChange(opt); setOpen(false); setSearch(''); }}
              style={{
                padding: '8px 12px',
                color: opt === value ? '#FFD700' : '#fff',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'right',
                direction: 'rtl',
                background: opt === value ? 'rgba(255,215,0,0.08)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 100ms',
              }}
              onMouseEnter={e => { if (opt !== value) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = opt === value ? 'rgba(255,215,0,0.08)' : 'transparent'; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CapitalGamePage() {
  const router = useRouter();

  const [answeredIds,      setAnsweredIds]      = useState<Set<string>>(new Set());
  const [zoneResults,      setZoneResults]      = useState<Record<string, boolean>>({});
  const [activeZoneId,     setActiveZoneId]     = useState<string | null>(null);
  const [formState,        setFormState]        = useState({ developer: '', project: '', acres: '', pricePerMeter: '' });
  const [saving,           setSaving]           = useState(false);
  const [mapReady,         setMapReady]         = useState(false);
  const [showLeaveModal,   setShowLeaveModal]   = useState(false);
  const [showIntro,        setShowIntro]        = useState(false);
  const [introForceOpen,   setIntroForceOpen]   = useState(false);

  // Part 2 state
  const [part2Results,     setPart2Results]     = useState<Record<string, boolean>>({});
  const [part2ActiveZoneId, setPart2ActiveZoneId] = useState<string | null>(null);
  const [part2Saving,      setPart2Saving]      = useState(false);

  useEffect(() => {
    const sessionId = localStorage.getItem('va_session_id');
    const isCapital = localStorage.getItem('va_capital');
    if (!sessionId || !isCapital) { router.replace('/dashboard/assessment'); return; }
    if (!localStorage.getItem('va_capital_intro_seen')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time gate reading a browser-only API (localStorage), not a render loop
      setShowIntro(true);
    }
  }, [router]);

  const answeredCount   = answeredIds.size;
  const progress        = (answeredCount / TOTAL) * 100;
  const unansweredZones = CAPITAL_ZONES.filter(z => !answeredIds.has(z.id) && !CAPITAL_NO_PIN_IDS.has(z.id));
  const activeZone      = activeZoneId ? CAPITAL_ZONES.find(z => z.id === activeZoneId) : null;

  const allPart1Done = answeredIds.size === TOTAL;
  const allGreensDonePart2 = Object.entries(zoneResults)
    .filter(([, correct]) => correct === true)
    .every(([id]) => part2Results[id] !== undefined);
  const canSubmit = allPart1Done && allGreensDonePart2;

  const handleStarClick = useCallback((zoneId: string) => {
    const isGreen = zoneResults[zoneId] === true;
    const part2Done = part2Results[zoneId] !== undefined;

    if (isGreen && !part2Done) {
      // Open Part 2 for this zone
      setPart2ActiveZoneId(zoneId);
      return;
    }

    if (zoneResults[zoneId] !== undefined) return; // red or Part 2 done → locked

    // Normal Part 1 flow
    setFormState({ developer: '', project: '', acres: '', pricePerMeter: '' });
    setActiveZoneId(zoneId);
  }, [zoneResults, part2Results]);

  const handleZoneSubmit = useCallback(async () => {
    if (!activeZoneId) return;
    setSaving(true);
    const sessionId = localStorage.getItem('va_session_id');
    const { allOk } = gradeZoneForm(formState, activeZoneId);
    if (sessionId) {
      await saveAnswers(sessionId, [{
        phase: 'capital_map',
        question_id: activeZoneId,
        answer_given: JSON.stringify(formState),
        correct: allOk,
      }]);
    }
    setZoneResults(prev => ({ ...prev, [activeZoneId]: allOk }));
    setAnsweredIds(prev => new Set([...prev, activeZoneId]));
    setActiveZoneId(null);
    setSaving(false);
  }, [activeZoneId, formState]);

  const handlePart2Submit = useCallback(async (answers: Record<string, string>) => {
    if (!part2ActiveZoneId) return;
    setPart2Saving(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      await saveAnswers(sessionId, Object.entries(answers).map(([questionId, answerGiven]) => ({
        phase: 'capital_part2',
        question_id: `${part2ActiveZoneId}__${questionId}`,
        answer_given: answerGiven,
        correct: true, // Part 2 is recorded, not graded right/wrong
      })));
    }
    setPart2Results(prev => ({ ...prev, [part2ActiveZoneId]: true }));
    setPart2ActiveZoneId(null);
    setPart2Saving(false);
  }, [part2ActiveZoneId]);

  const handleNext = useCallback(async () => {
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId && unansweredZones.length > 0) {
      await saveAnswers(sessionId, unansweredZones.map(z => ({
        phase: 'capital_map',
        question_id: z.id,
        answer_given: null,
        correct: false,
      })));
    }
    if (sessionId) {
      await markSessionComplete(sessionId);
    }
    localStorage.removeItem('va_capital');
    router.push(`/dashboard/assessment/results/${sessionId}`);
  }, [unansweredZones, router]);

  const handleCloseIntro = useCallback(() => {
    if (!introForceOpen) {
      localStorage.setItem('va_capital_intro_seen', '1');
    }
    setShowIntro(false);
    setIntroForceOpen(false);
  }, [introForceOpen]);

  const handleHelpClick = useCallback(() => {
    setIntroForceOpen(true);
    setShowIntro(true);
  }, []);

  return (
    <main
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--tgl-black)', fontFamily: 'var(--font-space)' }}
    >
      {/* ── Header ── */}
      <header
        className="px-5 py-3 flex items-center justify-between shrink-0"
        style={{
          background: 'rgba(0,0,0,0.95)',
          borderBottom: '1px solid rgba(215,255,0,0.1)',
          boxShadow: '0 1px 0 rgba(215,255,0,0.04), 0 4px 20px rgba(0,0,0,0.4)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.01em' }}>
              New Capital Assessment
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)', fontSize: 10 }}>
              انقر على النجمة لتقييم كل منطقة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div style={{ width: 120 }}>
            <div style={{
              height: 3,
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'rgba(215,255,0,0.6)',
                borderRadius: 4,
                transition: 'width 400ms ease',
                boxShadow: '0 0 6px rgba(215,255,0,0.3)',
              }} />
            </div>
            <p className="text-center mt-1" style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-montserrat)',
              letterSpacing: '0.05em',
            }}>
              {answeredCount}/{TOTAL} answered
            </p>
          </div>

          <button
            onClick={() => setShowLeaveModal(true)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              fontFamily: 'var(--font-space)',
            }}
          >
            ✕ Exit
          </button>
        </div>
      </header>

      {/* ── Map area ── */}
      <div className="flex-1 overflow-hidden p-3" style={{ position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid rgba(215,255,0,0.1)',
              borderTopColor: 'var(--tgl-lime)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}
        <div style={{ opacity: mapReady ? 1 : 0, transition: 'opacity 300ms', width: '100%' }}>
          <CapitalMap
            zones={CAPITAL_ZONES}
            zoneResults={zoneResults}
            part2Results={part2Results}
            onStarClick={handleStarClick}
            onReady={() => setMapReady(true)}
          />
        </div>
      </div>

      {/* ── Arabic Zone Modal ── */}
      {activeZone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) setActiveZoneId(null); }}
        >
          <div
            dir="rtl"
            style={{
              background: 'rgba(10,10,10,0.97)',
              border: '1px solid rgba(255,215,0,0.35)',
              borderRadius: 16,
              padding: 28,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 0 40px rgba(255,215,0,0.1), 0 20px 60px rgba(0,0,0,0.6)',
              fontFamily: 'var(--font-space)',
            }}
          >
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <span style={{ fontSize: 20, color: '#FFD700', filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8))' }}>★</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFD700', letterSpacing: '-0.01em' }}>
                منطقة {activeZone.code}
              </h2>
            </div>

            {/* Q1: Developer */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 7 }}>
                ما هو اسم المطور؟
              </label>
              <Dropdown
                value={formState.developer}
                onChange={v => setFormState(p => ({ ...p, developer: v }))}
                options={UNIQUE_DEVELOPERS}
                placeholder="اختر المطور..."
                autoFocus
              />
            </div>

            {/* Q2: Project name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 7 }}>
                ما هو اسم المشروع؟
              </label>
              <Dropdown
                value={formState.project}
                onChange={v => setFormState(p => ({ ...p, project: v }))}
                options={UNIQUE_PROJECTS}
                placeholder="اختر المشروع..."
              />
            </div>

            {/* Q3: Price per meter */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 7 }}>
                بداية سعر المتر
              </label>
              <input
                type="text"
                value={formState.pricePerMeter}
                onChange={e => setFormState(p => ({ ...p, pricePerMeter: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  fontFamily: 'var(--font-space)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
                placeholder="اكتب هنا..."
              />
            </div>

            {/* Q4: Acres */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 7 }}>
                كم فدان مساحة هذا المشروع؟
              </label>
              <input
                type="text"
                value={formState.acres}
                onChange={e => setFormState(p => ({ ...p, acres: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  fontFamily: 'var(--font-space)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  direction: 'rtl',
                }}
                placeholder="اكتب هنا..."
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleZoneSubmit}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 10,
                  background: saving ? 'rgba(255,215,0,0.15)' : '#FFD700',
                  color: saving ? 'rgba(0,0,0,0.35)' : '#000',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'var(--font-space)',
                  letterSpacing: '-0.01em',
                  boxShadow: saving ? 'none' : '0 0 18px rgba(255,215,0,0.3)',
                  transition: 'all 150ms',
                }}
              >
                {saving ? 'جاري الحفظ...' : 'إرسال'}
              </button>
              <button
                onClick={() => setActiveZoneId(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-space)',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Part 2 Modal ── */}
      {part2ActiveZoneId && (() => {
        const zone = CAPITAL_ZONES.find(z => z.id === part2ActiveZoneId);
        if (!zone) return null;
        return (
          <Part2Modal
            zoneCode={zone.code}
            zoneLabel={zone.label}
            onSubmit={handlePart2Submit}
            onClose={() => setPart2ActiveZoneId(null)}
            saving={part2Saving}
          />
        );
      })()}

      {/* ── Leave modal ── */}
      {showLeaveModal && (
        <ConfirmModal
          title="Leave assessment?"
          body="Your progress will be lost."
          confirmLabel="Leave"
          onConfirm={() => { localStorage.removeItem('va_capital'); router.replace('/dashboard/assessment'); }}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {/* ── Intro modal ── */}
      {showIntro && <CapitalIntroModal onClose={handleCloseIntro} />}

      {/* ── Fixed submit button ── */}
      <button
        onClick={canSubmit ? handleNext : undefined}
        disabled={!canSubmit}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 40,
          padding: '13px 28px',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 800,
          fontFamily: 'var(--font-space)',
          letterSpacing: '-0.01em',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 250ms ease, color 250ms ease, box-shadow 250ms ease',
          background: canSubmit ? 'var(--tgl-lime)' : 'rgba(215,255,0,0.08)',
          color: canSubmit ? '#000' : 'rgba(215,255,0,0.2)',
          boxShadow: canSubmit
            ? '0 0 24px rgba(215,255,0,0.45), 0 4px 16px rgba(0,0,0,0.4)'
            : 'none',
        }}
      >
        التالي ←
      </button>

      {/* ── Help button ── */}
      <button
        onClick={handleHelpClick}
        aria-label="كيف يعمل التقييم"
        style={{
          position: 'fixed',
          bottom: 32,
          left: 32,
          zIndex: 40,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(234,179,8,0.15)',
          border: '1.5px solid rgba(234,179,8,0.9)',
          color: 'rgba(234,179,8,0.9)',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'var(--font-space)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 12px rgba(234,179,8,0.15)',
          transition: 'background 150ms',
        }}
      >
        🤖
      </button>
    </main>
  );
}
