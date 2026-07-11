'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import QuizQuestion from '@/app/dashboard/assessment/components/QuizQuestion';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import type { Question } from '@/lib/assessment/data/questions';
import { QUESTIONS_BY_SECTION } from '@/lib/assessment/data/questions';
import { SECTIONS } from '@/lib/assessment/data/landmarks';
import { saveAnswers } from '@/lib/assessment/data-client';

const MINI_QUIZ_COUNT = 10;
const LAST_SECTION_ID = SECTIONS[SECTIONS.length - 1].id;

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s.label])
);

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SectionQuizPage() {
  const router = useRouter();
  const { sectionId } = useParams<{ sectionId: string }>();

  const sectionLabel = SECTION_LABELS[sectionId] ?? sectionId;

  const [quizQuestions] = useState<Question[]>(() =>
    shuffleArray(QUESTIONS_BY_SECTION[sectionId] ?? []).slice(0, MINI_QUIZ_COUNT)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    Array(quizQuestions.length).fill(null)
  );
  const [finishing, setFinishing] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const question = quizQuestions[currentIndex];
  const answered = answers[currentIndex];
  const progress = (currentIndex / Math.max(quizQuestions.length, 1)) * 100;
  const isLast = currentIndex === quizQuestions.length - 1;

  function handleAnswer(answer: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = answer;
      return next;
    });
  }

  async function finish(finalAnswers: (string | null)[]) {
    setFinishing(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      const usedKey = `va_mini_used_${sessionId}`;
      const existingRaw = localStorage.getItem(usedKey);
      const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem(
        usedKey,
        JSON.stringify([...existing, ...quizQuestions.map((q) => q.id)])
      );
      await saveAnswers(
        sessionId,
        quizQuestions.map((q, i) => ({
          phase: `phase1_mini_${sectionId}`,
          question_id: q.id,
          answer_given: finalAnswers[i] ?? null,
          correct: finalAnswers[i]
            ? q.type === 'freetext'
              ? true
              : finalAnswers[i]!.toLowerCase() === (q.answer as string).toLowerCase()
            : false,
        }))
      );
    }
    if (sectionId === LAST_SECTION_ID) {
      router.push('/dashboard/assessment/quiz');
    } else {
      router.push('/dashboard/assessment/phase1');
    }
  }

  async function handleNext() {
    if (!answered) return;
    if (isLast) {
      await finish(answers);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleFreetextNext(answer: string) {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);
    if (isLast) {
      await finish(newAnswers);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleSkipAll() {
    setShowSkipModal(false);
    await finish(answers);
  }

  if (quizQuestions.length === 0) {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(215,255,0,0.12)' }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={36} height={36} className="object-contain" />
          <div>
            <h1
              className="text-lg font-bold tracking-tight leading-none"
              style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)' }}
            >
              {sectionLabel} Quiz
            </h1>
            <p
              className="text-xs mt-0.5"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}
            >
              Section Knowledge Check
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
          style={{
            border: '1px solid rgba(215,255,0,0.3)',
            fontFamily: 'var(--font-space)',
            color: 'var(--tgl-lime)',
            background: 'rgba(215,255,0,0.06)',
          }}
        >
          {currentIndex + 1}{' '}
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>{' '}
          {quizQuestions.length}
        </div>
      </header>

      {/* Progress bar */}
      <div className="shrink-0 px-6 pt-3 pb-1">
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 4, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(215,255,0,0.1)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'var(--tgl-lime)',
              boxShadow: progress > 0 ? '0 0 8px rgba(215,255,0,0.6)' : 'none',
              transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <QuizQuestion
          question={question}
          index={currentIndex}
          total={quizQuestions.length}
          onAnswer={handleAnswer}
          answered={answered}
          onFreetextNext={handleFreetextNext}
        />

        {answered && (
          <div className="mt-10 w-full max-w-2xl flex flex-col gap-3">
            <button
              onClick={handleNext}
              disabled={finishing}
              className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-150 active:scale-95"
              style={{
                background: finishing ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                color: finishing ? 'rgba(215,255,0,0.4)' : '#000',
                boxShadow: finishing ? 'none' : 'var(--glow-lime)',
                fontFamily: 'var(--font-space)',
                letterSpacing: '0.08em',
                cursor: finishing ? 'not-allowed' : 'pointer',
              }}
            >
              {finishing
                ? 'Saving…'
                : isLast
                ? sectionId === LAST_SECTION_ID
                  ? 'Finish & Continue to Knowledge Quiz →'
                  : 'Finish & Continue →'
                : 'Next Question →'}
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={finishing}
              className="w-full py-2 rounded-xl text-xs font-bold"
              style={{
                background: 'transparent',
                color: 'rgba(239,68,68,0.65)',
                border: '1px dashed rgba(239,68,68,0.22)',
                fontFamily: 'var(--font-space)',
                cursor: finishing ? 'not-allowed' : 'pointer',
                opacity: 0.5,
                transition: 'opacity 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.5';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.22)';
              }}
            >
              Skip Quiz →
            </button>
          </div>
        )}

        {!answered && (
          <div className="mt-10 w-full max-w-2xl">
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={finishing}
              className="w-full py-2 rounded-xl text-xs font-bold"
              style={{
                background: 'transparent',
                color: 'rgba(239,68,68,0.65)',
                border: '1px dashed rgba(239,68,68,0.22)',
                fontFamily: 'var(--font-space)',
                cursor: finishing ? 'not-allowed' : 'pointer',
                opacity: 0.5,
                transition: 'opacity 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.5';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.22)';
              }}
            >
              Skip Quiz →
            </button>
          </div>
        )}
      </div>

      {showSkipModal && (
        <ConfirmModal
          title="Skip this quiz?"
          body="All remaining questions will be marked as unanswered (0 pts). Answered questions keep their score."
          confirmLabel="Skip Anyway"
          cancelLabel="Go Back"
          variant="red"
          onConfirm={handleSkipAll}
          onCancel={() => setShowSkipModal(false)}
        />
      )}
    </main>
  );
}
