'use client';

import { useRef, useState } from 'react';
import type { Question } from '@/lib/assessment/data/questions';

interface QuizQuestionProps {
  question: Question;
  index: number;
  total: number;
  onAnswer: (answer: string) => void;
  answered: string | null;
  onFreetextNext?: (answer: string) => void;
}

function FreeTextAnswer({
  answered,
  onAnswer,
  onFreetextNext,
}: {
  answered: string | null;
  onAnswer: (a: string) => void;
  onFreetextNext?: (a: string) => void;
}) {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  if (answered) {
    return (
      <div
        className="w-full px-5 py-4 rounded-xl text-sm"
        style={{
          background: 'rgba(215,255,0,0.06)',
          border: '1px solid rgba(215,255,0,0.25)',
          color: 'var(--tgl-lime)',
          fontFamily: 'var(--font-montserrat)',
        }}
      >
        {answered}
      </div>
    );
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (onFreetextNext) {
      onFreetextNext(trimmed);
    } else {
      onAnswer(trimmed);
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
      setValue(prev => prev ? prev + ' ' + transcript : transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="اكتب إجابتك هنا…"
          dir="rtl"
          rows={3}
          className="w-full px-5 rounded-xl text-sm outline-none resize-none"
          style={{
            background: '#0d0d0d',
            border: isListening ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
            color: 'var(--tgl-white)',
            fontFamily: 'var(--font-montserrat)',
            textAlign: 'right',
            paddingTop: 16,
            paddingBottom: 44,
            boxShadow: isListening ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
          onFocus={(e) => {
            if (!isListening) {
              e.target.style.border = '1px solid rgba(215,255,0,0.5)';
              e.target.style.boxShadow = '0 0 0 3px rgba(215,255,0,0.08)';
            }
          }}
          onBlur={(e) => {
            if (!isListening) {
              e.target.style.border = '1px solid rgba(255,255,255,0.1)';
              e.target.style.boxShadow = 'none';
            }
          }}
        />
        <button
          type="button"
          onClick={toggleMic}
          style={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            borderRadius: 20,
            border: isListening ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(215,255,0,0.2)',
            background: isListening ? 'rgba(239,68,68,0.1)' : 'rgba(215,255,0,0.05)',
            color: isListening ? '#f87171' : 'rgba(215,255,0,0.55)',
            fontSize: 11,
            fontFamily: 'var(--font-space)',
            cursor: 'pointer',
            transition: 'all 200ms',
          }}
          title={isListening ? 'إيقاف التسجيل' : 'تحدث بدل الكتابة'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
          {isListening ? 'جاري التسجيل...' : 'تحدث'}
        </button>
      </div>
      <button
        disabled={!value.trim()}
        onClick={submit}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95"
        style={{
          background: value.trim() ? 'var(--tgl-lime)' : 'rgba(215,255,0,0.06)',
          color: value.trim() ? '#000' : 'rgba(215,255,0,0.3)',
          border: value.trim() ? 'none' : '1px solid rgba(215,255,0,0.15)',
          boxShadow: value.trim() ? 'var(--glow-lime)' : 'none',
          fontFamily: 'var(--font-space)',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        التالي →
      </button>
    </div>
  );
}

export default function QuizQuestion({ question, index, total, onAnswer, answered, onFreetextNext }: QuizQuestionProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question counter + type badge */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)' }}
        >
          Question {index + 1} of {total}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
          style={{
            background: 'rgba(215,255,0,0.08)',
            color: 'rgba(215,255,0,0.7)',
            border: '1px solid rgba(215,255,0,0.2)',
            fontFamily: 'var(--font-space)',
          }}
        >
          {question.type === 'mcq' ? 'Multiple Choice' : question.type === 'truefalse' ? 'صح / غلط' : 'Open Answer'}
        </span>
      </div>

      {/* Question text */}
      <h2
        dir="rtl"
        className="text-2xl font-bold mb-8 leading-snug"
        style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)', letterSpacing: '-0.02em', textAlign: 'right' }}
      >
        {question.question}
      </h2>

      {/* MCQ options */}
      {question.type === 'mcq' && question.options && (
        <div className="flex flex-col gap-3">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onAnswer(opt)}
              dir="rtl"
              className="w-full px-5 py-4 rounded-xl font-medium transition-all duration-150"
              style={{
                background: answered === opt ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: answered === opt ? '1px solid rgba(215,255,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: answered === opt ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.8)',
                fontFamily: 'var(--font-montserrat)',
                cursor: 'pointer',
                boxShadow: answered === opt ? '0 0 12px rgba(215,255,0,0.1)' : 'none',
                fontSize: 15,
                textAlign: 'right',
                direction: 'rtl',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* True / False */}
      {question.type === 'truefalse' && (
        <div className="flex gap-4">
          {['true', 'false'].map((opt) => (
            <button
              key={opt}
              onClick={() => onAnswer(opt)}
              className="flex-1 py-5 rounded-xl font-black text-lg uppercase tracking-widest transition-all duration-150 active:scale-95"
              style={{
                background: answered === opt ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: answered === opt ? '1px solid rgba(215,255,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: answered === opt ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.7)',
                fontFamily: 'var(--font-space)',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                boxShadow: answered === opt ? '0 0 12px rgba(215,255,0,0.1)' : 'none',
              }}
            >
              {opt === 'true' ? 'صح' : 'غلط'}
            </button>
          ))}
        </div>
      )}

      {/* Free text */}
      {question.type === 'freetext' && (
        <FreeTextAnswer
          key={question.id}
          answered={answered}
          onAnswer={onAnswer}
          onFreetextNext={onFreetextNext}
        />
      )}
    </div>
  );
}
