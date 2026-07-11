'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import QuizQuestion from '@/app/dashboard/assessment/components/QuizQuestion';
import ConfirmModal from '@/app/dashboard/assessment/components/ConfirmModal';
import type { Question } from '@/lib/assessment/data/questions';
import { QUESTIONS_BY_SECTION } from '@/lib/assessment/data/questions';
import { saveAnswers, markSessionComplete } from '@/lib/assessment/data-client';

const QUIZ_SECTIONS = ['marina', 'new_alamein', 'sidi_abdel_rahman', 'el_dabaa', 'ras_al_hekma'];
const QUESTIONS_PER_SECTION = 5;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizQuestions] = useState<Question[]>(() => {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('va_session_id') : null;
    const usedRaw = sessionId ? localStorage.getItem(`va_mini_used_${sessionId}`) : null;
    const usedIds = new Set<string>(usedRaw ? JSON.parse(usedRaw) : []);
    return QUIZ_SECTIONS.flatMap((sec) => {
      const available = (QUESTIONS_BY_SECTION[sec] ?? []).filter((q) => !usedIds.has(q.id));
      if (available.length < QUESTIONS_PER_SECTION) return [];
      return shuffleArray(available).slice(0, QUESTIONS_PER_SECTION);
    });
  });
  const [answers, setAnswers] = useState<(string | null)[]>(() => Array(quizQuestions.length).fill(null));
  const [finishing, setFinishing] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  const question = quizQuestions[currentIndex];
  const answered = answers[currentIndex];
  const progress = ((currentIndex) / quizQuestions.length) * 100;
  const isLast = currentIndex === quizQuestions.length - 1;
  const currentSection = Math.floor(currentIndex / QUESTIONS_PER_SECTION);
  const activeSectionCount = quizQuestions.length / QUESTIONS_PER_SECTION;
  const isLastSection = currentSection === activeSectionCount - 1;

  function handleAnswer(answer: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = answer;
      return next;
    });
  }

  async function handleSkip() {
    setFinishing(true);
    const sessionId = localStorage.getItem('va_session_id');
    if (sessionId) {
      await saveAnswers(
        sessionId,
        quizQuestions.map((q, i) => ({
          phase: 'phase2',
          question_id: q.id,
          answer_given: answers[i] ?? null,
          correct: answers[i]
            ? (q.type === 'freetext' ? true : answers[i]?.toLowerCase() === (q.answer as string).toLowerCase())
            : false,
        }))
      );
      await markSessionComplete(sessionId);
      router.push(`/dashboard/assessment/results/${sessionId}`);
    }
  }

  async function handleSkipSection() {
    setShowSkipModal(false);
    const nextSectionStart = (currentSection + 1) * QUESTIONS_PER_SECTION;
    if (nextSectionStart >= quizQuestions.length) {
      await handleSkip();
    } else {
      setCurrentIndex(nextSectionStart);
    }
  }

  async function handleNext() {
    if (!answered) return;
    if (isLast) {
      setFinishing(true);
      const sessionId = localStorage.getItem('va_session_id');
      if (sessionId) {
        await saveAnswers(
          sessionId,
          quizQuestions.map((q, i) => ({
            phase: 'phase2',
            question_id: q.id,
            answer_given: answers[i],
            correct: q.type === 'freetext' ? true : answers[i]?.toLowerCase() === (q.answer as string).toLowerCase(),
          }))
        );
        await markSessionComplete(sessionId);
        router.push(`/dashboard/assessment/results/${sessionId}`);
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleFreetextNext(answer: string) {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);
    if (isLast) {
      setFinishing(true);
      const sessionId = localStorage.getItem('va_session_id');
      if (sessionId) {
        await saveAnswers(
          sessionId,
          quizQuestions.map((q, i) => ({
            phase: 'phase2',
            question_id: q.id,
            answer_given: newAnswers[i] ?? null,
            correct: q.type === 'freetext' ? true : newAnswers[i]?.toLowerCase() === (q.answer as string).toLowerCase(),
          }))
        );
        await markSessionComplete(sessionId);
        router.push(`/dashboard/assessment/results/${sessionId}`);
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  if (quizQuestions.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--tgl-black)' }}>
        <div className="text-center max-w-md">
          <div style={{ fontSize: 40, marginBottom: 16 }}>📝</div>
          <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)' }}>
            Quiz Coming Soon
          </h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)', lineHeight: 1.7 }}>
            Questions are being prepared. Check back soon.
          </p>
          <button
            onClick={async () => {
              const sessionId = localStorage.getItem('va_session_id');
              if (sessionId) {
                await markSessionComplete(sessionId);
                router.push(`/dashboard/assessment/results/${sessionId}`);
              }
            }}
            className="px-8 py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95"
            style={{ background: 'var(--tgl-lime)', color: '#000', boxShadow: 'var(--glow-lime-sm)', fontFamily: 'var(--font-space)' }}
          >
            See My Results →
          </button>
        </div>
      </main>
    );
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
              Knowledge Quiz
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
              Phase 2 — North Coast Assessment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/assessment')}
            className="px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'var(--font-space)',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >
            ← Home
          </button>
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ border: '1px solid rgba(215,255,0,0.3)', fontFamily: 'var(--font-space)', color: 'var(--tgl-lime)', background: 'rgba(215,255,0,0.06)' }}
          >
            {currentIndex + 1} <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span> {quizQuestions.length}
          </div>
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

        {/* Next / Finish button — appears after answering */}
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
              {finishing ? 'Saving results…' : isLast ? 'Finish & See Results →' : 'Next Question →'}
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
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.22)'; }}
            >
              {isLastSection ? 'Skip & Finish →' : 'Skip Section →'}
            </button>
          </div>
        )}
        {!answered && (
          <div className="mt-10 w-full max-w-2xl flex flex-col gap-3">
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
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.22)'; }}
            >
              {isLastSection ? 'Skip & Finish →' : 'Skip Section →'}
            </button>
          </div>
        )}
      </div>

      {showSkipModal && (
        <ConfirmModal
          title="Skip this section?"
          body="All remaining questions in this section will be marked as unanswered (0 pts). Answered questions keep their score. This cannot be undone."
          confirmLabel="Skip Anyway"
          cancelLabel="Go Back"
          variant="red"
          onConfirm={handleSkipSection}
          onCancel={() => setShowSkipModal(false)}
        />
      )}
    </main>
  );
}
