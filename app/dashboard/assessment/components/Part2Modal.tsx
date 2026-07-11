'use client';

import { useRef, useState } from 'react';
import { PART2_QUESTIONS } from '@/lib/assessment/data/questions-capital-part2';

interface Props {
  zoneCode: string;
  zoneLabel: string;
  onSubmit: (answers: Record<string, string>) => void;
  onClose: () => void;
  saving?: boolean;
  /** When provided, called instead of onSubmit — used by manager data-collection page */
  onManagerSubmit?: (answers: Record<string, string>) => Promise<void>;
  /** Pre-fill answers from existing static data */
  initialAnswers?: Record<string, string>;
}

// ── Input styles shared across question types ─────────────────────────────────

const inputStyle: React.CSSProperties = {
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
};

const optionBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'var(--font-space)',
  textAlign: 'right',
  direction: 'rtl',
  transition: 'background 120ms, border-color 120ms',
};

// ── Part2Modal ────────────────────────────────────────────────────────────────

export default function Part2Modal({ zoneCode, zoneLabel, onSubmit, onClose, saving = false, onManagerSubmit, initialAnswers }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // answers keyed by question id; dynamicpricegroup stores JSON object as string
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const question = PART2_QUESTIONS[currentIndex];
  const isLast = currentIndex === PART2_QUESTIONS.length - 1;

  // ── Get current answer value ──────────────────────────────────────────────

  const currentAnswer = answers[question.id] ?? '';

  // For multiselect, we store as JSON array string
  const currentMultiselect: string[] = (() => {
    try { return JSON.parse(currentAnswer) as string[]; } catch { return []; }
  })();

  // For dynamicpricegroup, items come from Q3 answer
  const q3Selected: string[] = (() => {
    try { return JSON.parse(answers['p2-q3'] ?? '[]') as string[]; } catch { return []; }
  })();

  // For dynamicpricegroup / dualinput, answer is a JSON map { label: value }
  const currentPrices: Record<string, string> = (() => {
    try { return JSON.parse(currentAnswer || '{}') as Record<string, string>; } catch { return {}; }
  })();

  // ── Validation — is the current question answered? ────────────────────────

  const isAnswered = (() => {
    if (question.type === 'multiselect') return currentMultiselect.length > 0;
    if (question.type === 'dynamicpricegroup') {
      if (!q3Selected.length) return true; // no units selected in Q3 → skip
      return q3Selected.every(u => (currentPrices[u] ?? '').trim() !== '');
    }
    if (question.type === 'dualinput') {
      const fields = question.options ?? [];
      return fields.every(f => (currentPrices[f] ?? '').trim() !== '');
    }
    if (!currentAnswer) return false;
    return currentAnswer.trim() !== '';
  })();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setAnswer(value: string) {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  }

  function toggleMultiselect(option: string) {
    const next = currentMultiselect.includes(option)
      ? currentMultiselect.filter(o => o !== option)
      : [...currentMultiselect, option];
    setAnswer(JSON.stringify(next));
  }

  function setPriceForUnit(unit: string, price: string) {
    const next = { ...currentPrices, [unit]: price };
    setAnswer(JSON.stringify(next));
  }

  function handleNext() {
    if (!isAnswered) return;
    recRef.current?.stop();
    setIsListening(false);
    if (isLast) {
      if (onManagerSubmit) {
        onManagerSubmit(answers);
      } else {
        onSubmit(answers);
      }
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  function toggleMic() {
    if (isListening) {
      recRef.current?.stop();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.lang = 'ar-EG';
    rec.continuous = false;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      setAnswers(prev => ({
        ...prev,
        [question.id]: prev[question.id] ? prev[question.id] + ' ' + transcript : transcript,
      }));
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  // ── Question renderers ────────────────────────────────────────────────────

  function renderQuestion() {
    switch (question.type) {

      case 'freetext':
        return (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={currentAnswer}
              onChange={e => setAnswer(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: 90,
                border: isListening
                  ? '1px solid rgba(239,68,68,0.5)'
                  : inputStyle.border,
                boxShadow: isListening ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
                transition: 'border-color 200ms, box-shadow 200ms',
              }}
              placeholder="اكتب هنا..."
              autoFocus
            />
            <button
              type="button"
              onClick={toggleMic}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 20,
                border: isListening ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(215,255,0,0.2)',
                background: isListening ? 'rgba(239,68,68,0.1)' : 'rgba(215,255,0,0.05)',
                color: isListening ? '#f87171' : 'rgba(215,255,0,0.55)',
                fontSize: 10,
                fontFamily: 'var(--font-space)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 200ms',
              }}
              title={isListening ? 'إيقاف التسجيل' : 'تحدث بدل الكتابة'}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
              </svg>
              {isListening ? '...' : 'تحدث'}
            </button>
          </div>
        );

      case 'truefalse':
        return (
          <div style={{ display: 'flex', gap: 10 }}>
            {(['صح', 'خطأ'] as const).map(opt => {
              const selected = currentAnswer === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setAnswer(opt)}
                  style={{
                    ...optionBase,
                    flex: 1,
                    background: selected
                      ? opt === 'صح' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
                      : 'rgba(255,255,255,0.04)',
                    borderColor: selected
                      ? opt === 'صح' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'
                      : 'rgba(255,255,255,0.1)',
                    color: selected
                      ? opt === 'صح' ? '#4ade80' : '#f87171'
                      : 'rgba(255,255,255,0.65)',
                    fontWeight: selected ? 700 : 500,
                    fontSize: 15,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      case 'mcq':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(question.options ?? []).map(opt => {
              const selected = currentAnswer === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setAnswer(opt)}
                  style={{
                    ...optionBase,
                    background: selected ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.04)',
                    borderColor: selected ? 'rgba(215,255,0,0.5)' : 'rgba(255,255,255,0.1)',
                    color: selected ? '#D7FF00' : 'rgba(255,255,255,0.75)',
                    fontWeight: selected ? 700 : 400,
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      case 'multiselect':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(question.options ?? []).map(opt => {
              const selected = currentMultiselect.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleMultiselect(opt)}
                  style={{
                    ...optionBase,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: selected ? 'rgba(215,255,0,0.1)' : 'rgba(255,255,255,0.04)',
                    borderColor: selected ? 'rgba(215,255,0,0.45)' : 'rgba(255,255,255,0.1)',
                    color: selected ? '#D7FF00' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  <span style={{
                    width: 18, height: 18,
                    borderRadius: 4,
                    border: `1.5px solid ${selected ? 'rgba(215,255,0,0.7)' : 'rgba(255,255,255,0.25)'}`,
                    background: selected ? 'rgba(215,255,0,0.2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 10,
                    color: '#D7FF00',
                  }}>
                    {selected ? '✓' : ''}
                  </span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{opt}</span>
                </button>
              );
            })}
          </div>
        );

      case 'dynamicpricegroup': {
        if (!q3Selected.length) {
          return (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'right', direction: 'rtl' }}>
              لم يتم اختيار أنواع وحدات في السؤال السابق.
            </p>
          );
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {q3Selected.map(unit => (
              <div key={unit}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 5,
                  textAlign: 'right',
                  direction: 'rtl',
                }}>
                  {question.labelPrefix ?? 'سعر'} {unit}
                </label>
                <input
                  type="text"
                  value={currentPrices[unit] ?? ''}
                  onChange={e => setPriceForUnit(unit, e.target.value)}
                  style={inputStyle}
                  placeholder="اكتب هنا..."
                />
              </div>
            ))}
          </div>
        );
      }

      case 'dualinput': {
        const fields = question.options ?? [];
        return (
          <div style={{ display: 'flex', gap: 12 }}>
            {fields.map(field => (
              <div key={field} style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 5,
                  textAlign: 'right',
                  direction: 'rtl',
                }}>
                  {field}
                </label>
                <input
                  type="text"
                  value={currentPrices[field] ?? ''}
                  onChange={e => setPriceForUnit(field, e.target.value)}
                  style={inputStyle}
                  placeholder="اكتب هنا..."
                />
              </div>
            ))}
          </div>
        );
      }

      default:
        return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          background: 'rgba(10,10,10,0.97)',
          border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: 16,
          padding: 28,
          width: '100%',
          maxWidth: 440,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(34,197,94,0.08), 0 20px 60px rgba(0,0,0,0.6)',
          fontFamily: 'var(--font-space)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: 'rgba(34,197,94,0.15)',
              color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 5,
              padding: '2px 7px',
              letterSpacing: '0.05em',
            }}>
              الجزء الثاني
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
              منطقة {zoneCode} — {zoneLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 16, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 22, justifyContent: 'flex-end', flexShrink: 0 }}>
          {PART2_QUESTIONS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i < currentIndex
                  ? 'rgba(34,197,94,0.7)'
                  : i === currentIndex
                    ? '#22c55e'
                    : 'rgba(255,255,255,0.15)',
                transition: 'width 200ms ease, background 200ms ease',
              }}
            />
          ))}
        </div>

        {/* Question number + text */}
        <div style={{ marginBottom: 18, flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginBottom: 6 }}>
            السؤال {currentIndex + 1} من {PART2_QUESTIONS.length}
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.55, direction: 'rtl' }}>
            {question.question}
          </p>
        </div>

        {/* Question content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 24 }}>
          {renderQuestion()}
        </div>

        {/* Next / Submit button */}
        <button
          onClick={handleNext}
          disabled={!isAnswered || saving}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 10,
            background: (!isAnswered || saving) ? 'rgba(34,197,94,0.12)' : '#22c55e',
            color: (!isAnswered || saving) ? 'rgba(255,255,255,0.25)' : '#000',
            border: 'none',
            cursor: (!isAnswered || saving) ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 800,
            fontFamily: 'var(--font-space)',
            letterSpacing: '-0.01em',
            boxShadow: (!isAnswered || saving) ? 'none' : '0 0 18px rgba(34,197,94,0.3)',
            transition: 'all 150ms',
          }}
        >
          {saving ? 'جاري الحفظ...' : isLast ? 'إرسال' : 'التالي →'}
        </button>
      </div>
    </div>
  );
}
