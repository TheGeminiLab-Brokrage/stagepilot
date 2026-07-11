'use client';

import { useState, useCallback, CSSProperties } from 'react';
import type { PinQuizData } from '@/lib/assessment/data/pin-quizzes';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';

interface PinQuizPanelProps {
  quiz: PinQuizData;
  onSubmit: (answers: Record<string, string>) => void;
  submitting: boolean;
  onExit?: () => void;
}

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export default function PinQuizPanel({ quiz, onSubmit, submitting, onExit }: PinQuizPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cardStyle, setCardStyle] = useState<CSSProperties>({
    transform: 'translateX(0)',
    opacity: 1,
  });
  const [advancing, setAdvancing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const q = quiz.questions[currentIndex];
  const isLast = currentIndex === quiz.questions.length - 1;
  const currentAnswer = answers[q?.id ?? ''] ?? '';

  // ── answer helpers ──────────────────────────────────────────────────────────

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMultiselect(id: string, opt: string) {
    const current = parseJson<string[]>(answers[id] ?? '[]', []);
    const next = current.includes(opt)
      ? current.filter((v) => v !== opt)
      : [...current, opt];
    setAnswer(id, JSON.stringify(next));
  }

  function setPricegroupItem(id: string, label: string, value: string) {
    const current = parseJson<Record<string, string>>(answers[id] ?? '{}', {});
    setAnswer(id, JSON.stringify({ ...current, [label]: value }));
  }

  function getPricegroupItem(id: string, label: string): string {
    return parseJson<Record<string, string>>(answers[id] ?? '{}', {})[label] ?? '';
  }

  function isCurrentAnswered(): boolean {
    if (!q) return false;
    if (q.type === 'freetext') return currentAnswer.trim().length > 0;
    if (q.type === 'mcq' || q.type === 'truefalse') return currentAnswer !== '';
    if (q.type === 'multiselect') {
      return parseJson<string[]>(currentAnswer || '[]', []).length > 0;
    }
    if (q.type === 'pricegroup') return true; // always continuable
    return false;
  }

  // ── navigation ──────────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    if (advancing) return;
    setAdvancing(true);
    setCardStyle({ transform: 'translateX(-60px)', opacity: 0, transition: 'transform 0.25s ease, opacity 0.2s ease' });
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setCardStyle({ transform: 'translateX(40px)', opacity: 0, transition: 'none' });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setCardStyle({
            transform: 'translateX(0)',
            opacity: 1,
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
          });
          setAdvancing(false);
        })
      );
    }, 260);
  }, [advancing]);

  function handleSelect(id: string, value: string) {
    setAnswer(id, value);
    if (!isLast) setTimeout(advance, 350);
  }

  function handleContinue() {
    if (isLast) {
      onSubmit({ ...answers });
    } else {
      advance();
    }
  }

  if (!q) return null;

  const dotColors = quiz.questions.map((_, i) =>
    i < currentIndex
      ? 'var(--tgl-lime)'
      : i === currentIndex
      ? 'rgba(215,255,0,0.55)'
      : 'rgba(255,255,255,0.15)'
  );

  const showContinueButton =
    q.type === 'freetext' ||
    q.type === 'multiselect' ||
    q.type === 'pricegroup' ||
    isLast;

  const canContinue = isCurrentAnswered() && !submitting && !advancing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 16 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowExitConfirm(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.45)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 15,
              flexShrink: 0,
              transition: 'background 150ms, color 150ms',
              fontFamily: 'var(--font-space)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
            }}
          >
            ←
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(215,255,0,0.6)',
              fontFamily: 'var(--font-space)',
            }}
          >
            Project Quiz
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-space)' }}>
            {currentIndex + 1} / {quiz.questions.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {dotColors.map((color, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Animated question card */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        <div style={{ ...cardStyle, minHeight: '100%' }}>
          <div
            style={{
              borderRadius: 12,
              padding: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(215,255,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxSizing: 'border-box',
              overflowY: 'visible',
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.5,
                color: 'var(--tgl-white)',
                fontFamily: 'var(--font-space)',
                margin: 0,
                flexShrink: 0,
              }}
            >
              {q.question}
            </p>

            {/* ── Freetext ── */}
            {q.type === 'freetext' && (
              <textarea
                rows={4}
                value={currentAnswer}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer…"
                style={{
                  width: '100%',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  resize: 'none',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  border: currentAnswer.trim()
                    ? '1px solid rgba(215,255,0,0.4)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--tgl-white)',
                  fontFamily: 'var(--font-montserrat)',
                  lineHeight: 1.6,
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
              />
            )}

            {/* ── True / False ── */}
            {q.type === 'truefalse' && (
              <div style={{ display: 'flex', gap: 10 }}>
                {['true', 'false'].map((opt) => {
                  const selected = currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(q.id, opt)}
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'var(--font-space)',
                        cursor: 'pointer',
                        transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
                        transform: selected ? 'scale(1.02)' : 'scale(1)',
                        background: selected ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.06)',
                        color: selected ? '#000' : 'rgba(255,255,255,0.6)',
                        border: selected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        boxShadow: selected ? '0 0 12px rgba(215,255,0,0.5)' : 'none',
                      }}
                    >
                      {opt === 'true' ? 'True' : 'False'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── MCQ ── */}
            {q.type === 'mcq' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options?.map((opt) => {
                  const selected = currentAnswer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelect(q.id, opt)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontFamily: 'var(--font-montserrat)',
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s, transform 0.1s',
                        transform: selected ? 'scale(1.01)' : 'scale(1)',
                        background: selected ? 'rgba(215,255,0,0.14)' : 'rgba(255,255,255,0.04)',
                        color: selected ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.65)',
                        border: selected ? '1px solid rgba(215,255,0,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: selected ? '0 0 10px rgba(215,255,0,0.15)' : 'none',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Multiselect ── */}
            {q.type === 'multiselect' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-space)', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Select all that apply
                </p>
                {q.options?.map((opt) => {
                  const selected = parseJson<string[]>(currentAnswer || '[]', []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleMultiselect(q.id, opt)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontFamily: 'var(--font-montserrat)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'background 0.15s, color 0.15s, transform 0.1s',
                        transform: selected ? 'scale(1.01)' : 'scale(1)',
                        background: selected ? 'rgba(215,255,0,0.14)' : 'rgba(255,255,255,0.04)',
                        color: selected ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.65)',
                        border: selected ? '1px solid rgba(215,255,0,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: selected ? '0 0 10px rgba(215,255,0,0.15)' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
                          background: selected ? 'var(--tgl-lime)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 10,
                          color: '#000',
                          fontWeight: 900,
                          transition: 'background 0.15s, border 0.15s',
                        }}
                      >
                        {selected ? '✓' : ''}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Price Group ── */}
            {q.type === 'pricegroup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {q.items?.map((label) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(215,255,0,0.6)',
                        fontFamily: 'var(--font-space)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4.5M EGP"
                      value={getPricegroupItem(q.id, label)}
                      onChange={(e) => setPricegroupItem(q.id, label, e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        padding: '9px 12px',
                        fontSize: 13,
                        outline: 'none',
                        background: 'rgba(255,255,255,0.06)',
                        border: getPricegroupItem(q.id, label).trim()
                          ? '1px solid rgba(215,255,0,0.4)'
                          : '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--tgl-white)',
                        fontFamily: 'var(--font-montserrat)',
                        transition: 'border-color 0.15s',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Continue / Submit button */}
      {showContinueButton && (
        <button
          disabled={!canContinue}
          onClick={handleContinue}
          style={{
            flexShrink: 0,
            width: '100%',
            padding: '13px 0',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-space)',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, box-shadow 0.2s',
            background: canContinue ? 'var(--tgl-lime)' : 'rgba(215,255,0,0.06)',
            color: canContinue ? '#000' : 'rgba(215,255,0,0.3)',
            border: canContinue ? 'none' : '1px solid rgba(215,255,0,0.15)',
            boxShadow: canContinue ? 'var(--glow-lime)' : 'none',
          }}
        >
          {submitting ? 'Saving…' : isLast ? '✓ Submit Quiz' : 'Continue →'}
        </button>
      )}

      {showExitConfirm && (
        <ConfirmModal
          title="Exit Quiz?"
          body="All your answers for this quiz will be erased. Your progress won't be saved."
          confirmLabel="Exit Quiz"
          cancelLabel="Keep Going"
          variant="red"
          onConfirm={() => { setShowExitConfirm(false); onExit?.(); }}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </div>
  );
}
