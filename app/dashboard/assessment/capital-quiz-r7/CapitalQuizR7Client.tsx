'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuizQuestion from '@/app/dashboard/assessment/components/QuizQuestion';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import { CAPITAL_R7_QUESTIONS } from '@/lib/assessment/data/questions-capital-r7-quiz';
import { saveAnswers, markSessionComplete } from '@/lib/assessment/data-client';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CapitalQuizR7Page() {
  const router = useRouter();

  const [questions] = useState(() => shuffle(CAPITAL_R7_QUESTIONS));
  const [answers,   setAnswers]   = useState<(string | null)[]>(() => Array(questions.length).fill(null));
  const [index,     setIndex]     = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [showSkip,  setShowSkip]  = useState(false);

  const question  = questions[index];
  const answered  = answers[index];
  const isLast    = index === questions.length - 1;
  const progress  = (index / Math.max(questions.length, 1)) * 100;

  function handleAnswer(answer: string) {
    setAnswers(prev => { const next = [...prev]; next[index] = answer; return next; });
  }

  async function finish(submittedAnswers: (string | null)[]) {
    setFinishing(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      await saveAnswers(sessionId, questions.map((q, i) => {
        const given = submittedAnswers[i] ?? null;
        let correct = false;
        if (q.type === 'mcq' || q.type === 'truefalse') {
          correct = given !== null && given.toLowerCase() === String(q.answer).toLowerCase();
        } else if (q.type === 'multiselect') {
          const givenArr: string[] = given ? JSON.parse(given) : [];
          const correctArr = Array.isArray(q.answer) ? q.answer as string[] : [];
          correct = givenArr.length === correctArr.length && givenArr.every(a => correctArr.includes(a));
        }
        return { phase: 'capital_r7_quiz', question_id: q.id, answer_given: given, correct };
      }));
      await markSessionComplete(sessionId);
    }
    localStorage.removeItem('va_capital');
    router.push(`/dashboard/assessment/results/${sessionId}`);
  }

  async function handleNext() {
    if (!answered && !isLast) { setIndex(i => i + 1); return; }
    if (isLast) {
      await finish(answers);
      return;
    }
    setIndex(i => i + 1);
  }

  if (!question) {
    finish(answers);
    return null;
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-start py-8 px-4"
      style={{ background: 'var(--tgl-black)' }}
    >
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)', letterSpacing: '-0.02em' }}>
              New Capital R7 — Knowledge Quiz
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}>
              Question {index + 1} of {questions.length}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSkip(true)}
          style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-space)' }}
        >
          Skip →
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-6">
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--tgl-lime)', transition: 'width 400ms ease', boxShadow: '0 0 6px rgba(215,255,0,0.3)' }} />
        </div>
      </div>

      {/* Question card */}
      <div
        className="w-full max-w-2xl rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(215,255,0,0.12)',
          boxShadow: '0 0 40px rgba(215,255,0,0.04)',
        }}
      >
        <QuizQuestion
          question={question}
          index={index}
          total={questions.length}
          answered={answered}
          onAnswer={handleAnswer}
        />
      </div>

      {/* Next / Finish */}
      <div className="w-full max-w-2xl mt-5">
        <button
          onClick={handleNext}
          disabled={finishing}
          className="w-full py-4 rounded-2xl font-black text-sm"
          style={{
            fontFamily: 'var(--font-space)',
            background: finishing ? 'rgba(215,255,0,0.06)' : 'var(--tgl-lime)',
            color: finishing ? 'rgba(215,255,0,0.3)' : '#000',
            border: 'none',
            cursor: finishing ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
            boxShadow: finishing ? 'none' : '0 0 24px rgba(215,255,0,0.4)',
          }}
        >
          {finishing ? 'Saving…' : isLast ? 'Finish →' : answered ? 'Next →' : 'Skip question →'}
        </button>
      </div>

      {showSkip && (
        <ConfirmModal
          title="Skip quiz?"
          body="Remaining questions will be marked as unanswered."
          confirmLabel="Skip"
          onConfirm={() => finish(answers)}
          onCancel={() => setShowSkip(false)}
        />
      )}
    </main>
  );
}
