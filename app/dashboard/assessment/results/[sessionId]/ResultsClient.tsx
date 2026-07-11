'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getSessionResults } from '@/lib/assessment/data-client';
import type { Session, Answer } from '@/lib/assessment/types';
import { computeScores, computeOverall, PASS_THRESHOLD } from '@/lib/assessment/utils/scores';
import type { SectionScore } from '@/lib/assessment/utils/scores';
import { computeCapitalScores, buildCapitalAnswerReview } from '@/lib/assessment/utils/scores-capital';
import { buildAnswerReview, QUESTION_MAP } from '@/lib/assessment/utils/answer-review';
import type { AnswerRow, SubGroup, PhaseGroup } from '@/lib/assessment/utils/answer-review';

// ─── Types ────────────────────────────────────────────────────────────────────

type AiGrade = { score: number; isCorrect: boolean } | 'loading' | 'error';

function getBestWorst(scores: SectionScore[]) {
  if (scores.length < 2) return { best: null, worst: null };
  const sorted = [...scores].sort((a, b) => b.pct - a.pct);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ pct }: { pct: number }) {
  const passing = pct >= PASS_THRESHOLD;
  const color   = passing ? 'var(--tgl-lime)' : '#ef4444';
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', width: 84, border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        width: `${Math.round(pct * 100)}%`,
        height: '100%',
        background: color,
        borderRadius: 99,
        boxShadow: passing ? '0 0 8px rgba(215,255,0,0.5)' : '0 0 8px rgba(239,68,68,0.4)',
        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }} />
    </div>
  );
}

function ScoreBadge({ score, small }: { score: { correct: number; total: number }; small?: boolean }) {
  if (score.total === 0) return null;
  const pct = Math.round((score.correct / score.total) * 100);
  const passing = score.correct / score.total >= PASS_THRESHOLD;
  return (
    <span style={{
      fontSize: small ? 10 : 11, fontWeight: 700, fontFamily: 'var(--font-space)',
      color: passing ? 'var(--tgl-lime)' : '#f87171',
      background: passing ? 'rgba(215,255,0,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${passing ? 'rgba(215,255,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 99, padding: small ? '1px 7px' : '2px 9px', whiteSpace: 'nowrap',
    }}>
      {score.correct}/{score.total} · {pct}%
    </span>
  );
}

function AnswerRowItem({ row, aiGrade }: { row: AnswerRow; aiGrade?: AiGrade }) {
  const aiResult = aiGrade && aiGrade !== 'loading' && aiGrade !== 'error' ? aiGrade : null;
  const effectiveCorrect = aiResult ? aiResult.isCorrect : row.correct;
  const isGrey = effectiveCorrect === null;

  return (
    <div
      className="px-5 py-3 flex items-start gap-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: effectiveCorrect === false ? 'rgba(239,68,68,0.03)' : 'transparent' }}
    >
      <div
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{
          background: isGrey ? 'rgba(255,255,255,0.08)' : effectiveCorrect ? 'rgba(215,255,0,0.15)' : 'rgba(239,68,68,0.15)',
          color: isGrey ? 'rgba(255,255,255,0.5)' : effectiveCorrect ? 'var(--tgl-lime)' : '#f87171',
          fontFamily: 'var(--font-space)',
        }}
      >
        {aiGrade === 'loading' ? '…' : isGrey ? '—' : effectiveCorrect ? '✓' : '✗'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-montserrat)' }}>
          {row.questionLabel}
        </div>
        <div className="text-xs mt-1" style={{ fontFamily: 'var(--font-montserrat)', color: 'rgba(255,255,255,0.6)' }}>
          You answered:{' '}
          <span className="font-semibold" style={{ color: isGrey ? 'rgba(255,255,255,0.6)' : effectiveCorrect ? 'var(--tgl-lime)' : '#f87171' }}>
            {row.given ?? '—'}
          </span>
        </div>
        {/* AI score badge */}
        {aiResult && (
          <div className="flex items-center gap-2 mt-1.5">
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space)',
              color: aiResult.isCorrect ? 'var(--tgl-lime)' : '#f87171',
              background: aiResult.isCorrect ? 'rgba(215,255,0,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${aiResult.isCorrect ? 'rgba(215,255,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: 99, padding: '1px 8px',
            }}>
              AI: {aiResult.score}/100
            </span>
          </div>
        )}
        {/* AI grading error — score shown is raw, not AI-verified */}
        {aiGrade === 'error' && (
          <div className="mt-1.5">
            <span style={{
              fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-space)',
              color: 'rgba(251,191,36,0.85)',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 99, padding: '1px 8px',
            }}>
              ⚠ AI grading unavailable
            </span>
          </div>
        )}
        {/* Model answer — shown when AI graded or when grading failed so manual review is possible */}
        {(aiResult || aiGrade === 'error') && row.correctAnswer && (
          <div className="text-xs mt-1" dir="rtl" style={{ fontFamily: 'var(--font-montserrat)', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
            الإجابة النموذجية:{' '}
            <span className="font-semibold" style={{ color: 'rgba(215,255,0,0.75)' }}>{row.correctAnswer}</span>
          </div>
        )}
        {/* Correct answer shown when wrong or unanswered (non-AI rows) */}
        {!aiResult && !effectiveCorrect && row.correctAnswer && (
          <div className="text-xs mt-0.5" style={{ fontFamily: 'var(--font-montserrat)', color: 'rgba(255,255,255,0.6)' }}>
            Correct answer:{' '}
            <span className="font-semibold" style={{ color: 'var(--tgl-lime)' }}>{row.correctAnswer}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page-level section components ───────────────────────────────────────────

function SummaryPage({ scores, overall, best, worst }: {
  scores: SectionScore[]; overall: number; best: SectionScore | null; worst: SectionScore | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid rgba(215,255,0,0.12)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)' }}>Overall Score</h2>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>
            {scores.reduce((s, x) => s + x.correct, 0)} / {scores.reduce((s, x) => s + x.total, 0)} correct
          </span>
        </div>
        <div
          className="font-black mb-2"
          style={{
            fontFamily: 'var(--font-space)',
            fontSize: 72,
            color: overall >= PASS_THRESHOLD ? 'var(--tgl-lime)' : '#f87171',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            textShadow: overall >= PASS_THRESHOLD
              ? '0 0 40px rgba(215,255,0,0.5), 0 0 80px rgba(215,255,0,0.2)'
              : '0 0 30px rgba(248,113,113,0.4)',
            animation: 'score-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          {Math.round(overall * 100)}%
        </div>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-montserrat)' }}>
          {overall >= 0.9 ? 'Outstanding! You know the North Coast inside out.' :
           overall >= PASS_THRESHOLD ? 'Good work. A few areas to polish.' :
           'Needs improvement. Review the sections below.'}
        </p>
        {best && (
          <div className="flex gap-4 mt-5">
            <div className={`${worst && worst.pct < 1.0 ? 'flex-1' : 'w-full'} p-3 rounded-xl`} style={{ background: 'rgba(215,255,0,0.06)', border: '1px solid rgba(215,255,0,0.15)' }}>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)' }}>Strongest</div>
              <div className="text-sm font-bold" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)' }}>{best.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(215,255,0,0.8)', fontFamily: 'var(--font-montserrat)' }}>{Math.round(best.pct * 100)}%</div>
            </div>
            {worst && worst.pct < 1.0 && (
              <div className="flex-1 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(239,68,68,0.7)', fontFamily: 'var(--font-space)' }}>Needs Work</div>
                <div className="text-sm font-bold" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)' }}>{worst.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#f87171', fontFamily: 'var(--font-montserrat)' }}>{Math.round(worst.pct * 100)}%</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(215,255,0,0.1)' }}>
        <div className="px-5 py-3" style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)' }}>Section Breakdown</h2>
        </div>
        {scores.map((s, i) => {
          const passing = s.pct >= PASS_THRESHOLD;
          return (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-space)' }}>{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>{s.correct}/{s.total} correct</div>
              </div>
              <ScoreBar pct={s.pct} />
              <div className="text-sm font-bold w-12 text-right" style={{ color: passing ? 'var(--tgl-lime)' : '#f87171', fontFamily: 'var(--font-space)' }}>
                {Math.round(s.pct * 100)}%
              </div>
              <div className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: passing ? 'rgba(215,255,0,0.1)' : 'rgba(239,68,68,0.1)', color: passing ? 'var(--tgl-lime)' : '#f87171', border: `1px solid ${passing ? 'rgba(215,255,0,0.2)' : 'rgba(239,68,68,0.2)'}`, fontFamily: 'var(--font-space)', whiteSpace: 'nowrap' }}>
                {passing ? '✓ Pass' : '⚠ Review'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionPage({ group, aiGrades }: { group: PhaseGroup; aiGrades?: Record<string, AiGrade> }) {
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());
  const passing = group.score.total > 0 && group.score.correct / group.score.total >= PASS_THRESHOLD;

  function toggleSub(key: string) {
    setCollapsedSubs(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="rounded-2xl p-5" style={{ background: '#0d0d0d', border: '1px solid rgba(215,255,0,0.1)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)', letterSpacing: '-0.03em' }}>
            {group.label}
          </h2>
          <div className="flex items-center gap-3">
            <ScoreBadge score={group.score} />
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: passing ? 'rgba(215,255,0,0.1)' : 'rgba(239,68,68,0.1)', color: passing ? 'var(--tgl-lime)' : '#f87171', border: `1px solid ${passing ? 'rgba(215,255,0,0.2)' : 'rgba(239,68,68,0.2)'}`, fontFamily: 'var(--font-space)' }}>
              {passing ? '✓ Pass' : '⚠ Review'}
            </span>
          </div>
        </div>
        {group.score.total > 0 && (
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${Math.round(group.score.correct / group.score.total * 100)}%`, height: '100%', background: passing ? 'var(--tgl-lime)' : '#ef4444', borderRadius: 99 }} />
          </div>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(215,255,0,0.08)' }}>
        {group.rows.map((row, ri) => (
          <AnswerRowItem key={ri} row={row} aiGrade={row.id ? aiGrades?.[row.id] : undefined} />
        ))}

        {group.subGroups?.map((sub) => {
          const isSubCollapsed = collapsedSubs.has(sub.key);
          return (
            <div key={sub.key} style={{ margin: '8px 12px 12px 20px', borderLeft: '2px solid rgba(215,255,0,0.2)', borderRadius: '0 8px 8px 0', overflow: 'hidden', background: 'rgba(215,255,0,0.02)' }}>
              <button
                onClick={() => toggleSub(sub.key)}
                className="w-full px-4 py-2.5 flex items-center justify-between"
                style={{ background: 'rgba(215,255,0,0.04)', cursor: 'pointer', border: 'none', outline: 'none' }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(215,255,0,0.7)', fontFamily: 'var(--font-space)' }}>
                  {sub.label}
                </span>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={sub.score} small />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1, display: 'inline-block', transform: isSubCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▾</span>
                </div>
              </button>
              {!isSubCollapsed && sub.rows.map((row, ri) => <AnswerRowItem key={ri} row={row} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImprovementPage({ weakSections }: { weakSections: SectionScore[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
      <div className="px-5 py-3" style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(239,68,68,0.85)', fontFamily: 'var(--font-space)' }}>
          Improvement Areas
        </h2>
      </div>
      {weakSections.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: 'rgba(215,255,0,0.7)', fontFamily: 'var(--font-montserrat)' }}>All sections passed!</p>
        </div>
      ) : (
        weakSections.map((s, i) => (
          <div key={s.key} className="px-5 py-4 flex gap-4 items-start" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontFamily: 'var(--font-space)' }}>!</div>
            <div>
              <div className="text-sm font-bold mb-1" style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-space)' }}>{s.label} — {Math.round(s.pct * 100)}%</div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-montserrat)', lineHeight: 1.6 }}>{s.tip}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PageNav({ current, total, onPrev, onNext }: { current: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4"
      style={{
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(215,255,0,0.08)',
        boxShadow: '0 -1px 0 rgba(215,255,0,0.04), 0 -8px 40px rgba(0,0,0,0.5)',
        zIndex: 40,
      }}
    >
      <button
        onClick={onPrev}
        disabled={current === 0}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{
          background: current === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
          color: current === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${current === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
          fontFamily: 'var(--font-space)',
          cursor: current === 0 ? 'not-allowed' : 'pointer',
          letterSpacing: '-0.01em',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => { if (current !== 0) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={e => { if (current !== 0) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
      >
        ← Previous
      </button>

      {/* Dot indicator */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === current ? 16 : 5,
              height: 5,
              borderRadius: 99,
              background: i === current ? 'var(--tgl-lime)' : i < current ? 'rgba(215,255,0,0.3)' : 'rgba(255,255,255,0.1)',
              boxShadow: i === current ? '0 0 8px rgba(215,255,0,0.6)' : 'none',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={current === total - 1}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{
          background: current === total - 1 ? 'rgba(215,255,0,0.05)' : 'var(--tgl-lime)',
          color: current === total - 1 ? 'rgba(215,255,0,0.22)' : '#000',
          border: current === total - 1 ? '1px solid rgba(215,255,0,0.1)' : 'none',
          fontFamily: 'var(--font-space)',
          cursor: current === total - 1 ? 'not-allowed' : 'pointer',
          boxShadow: current === total - 1 ? 'none' : '0 0 16px rgba(215,255,0,0.35), 0 0 40px rgba(215,255,0,0.1)',
          letterSpacing: '-0.01em',
          transition: 'box-shadow 150ms ease',
        }}
        onMouseEnter={e => { if (current !== total - 1) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(215,255,0,0.55), 0 0 60px rgba(215,255,0,0.16)'; }}
        onMouseLeave={e => { if (current !== total - 1) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(215,255,0,0.35), 0 0 40px rgba(215,255,0,0.1)'; }}
      >
        Next →
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get('from') === 'admin';
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [aiGrades, setAiGrades] = useState<Record<string, AiGrade>>({});

  useEffect(() => {
    if (!sessionId) return;
    getSessionResults(sessionId)
      .then(({ session, answers }) => { setSession(session); setAnswers(answers); })
      .catch(() => setError('Could not load results. Please try again.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!answers.length) return;
    const freetextAnswers = answers.filter(a => {
      const q = QUESTION_MAP[a.question_id];
      return a.phase === 'phase2' && q?.type === 'freetext' && q?.answer && a.answer_given;
    });
    if (freetextAnswers.length === 0) return;
    const init: Record<string, AiGrade> = {};
    freetextAnswers.forEach(a => { init[a.question_id] = 'loading'; });
    setAiGrades(init);
    freetextAnswers.forEach(a => {
      const q = QUESTION_MAP[a.question_id]!;
      fetch('/api/assessment/grade-freetext', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswer: a.answer_given, correctAnswer: q.answer }),
      })
        .then(r => { if (!r.ok) throw new Error('grading_api_error'); return r.json(); })
        .then(data => setAiGrades(prev => ({ ...prev, [a.question_id]: { score: data.score, isCorrect: data.isCorrect } })))
        .catch(() => setAiGrades(prev => ({ ...prev, [a.question_id]: 'error' })));
    });
  }, [answers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--tgl-black)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(215,255,0,0.1)',
            borderTopColor: 'var(--tgl-lime)',
            animation: 'spin 0.8s linear infinite',
            boxShadow: '0 0 14px rgba(215,255,0,0.2)',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'var(--font-montserrat)' }}>Loading results…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--tgl-black)' }}>
        <div className="text-sm text-center" style={{ color: '#f87171', fontFamily: 'var(--font-montserrat)' }}>{error || 'Session not found.'}</div>
      </div>
    );
  }

  const isCapital = answers.some(a => a.phase.startsWith('capital_'));
  const scores = isCapital ? computeCapitalScores(answers) : computeScores(answers);
  const answerGroups = isCapital ? buildCapitalAnswerReview(answers) : buildAnswerReview(answers);
  const overall = computeOverall(scores);
  const { best, worst } = getBestWorst(scores);
  const weakSections = scores.filter(s => s.pct < PASS_THRESHOLD);

  const completedAt = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'In progress';

  // Pages: Summary + one per section group + Improvement Areas
  const pages: { key: string; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    ...answerGroups.map(g => ({ key: g.key, label: g.label })),
    { key: 'improvement', label: 'Improvement' },
  ];
  const totalPages = pages.length;
  const currentPageKey = pages[currentPage]?.key;
  const currentGroup = answerGroups.find(g => g.key === currentPageKey);

  async function handleDownload() {
    if (!session) return;
    setDownloading(true);
    try {
      const { generateReportDocx } = await import('@/lib/assessment/utils/generate-report');
      const blob = await generateReportDocx({ session, scores, answerGroups, title: isCapital ? 'New Capital Assessment Report' : 'North Coast Assessment Report' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TGL-Report-${session.full_name.replace(/\s+/g, '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const sharedHeader = (
    <header
      className="px-6 py-4 flex items-center justify-between shrink-0"
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
      <div className="flex items-center gap-3">
        <Image src="/assessment/tgl-logo.png" alt="TGL" width={36} height={36} className="object-contain" />
        <div>
          {fromAdmin ? (
            <button
              onClick={() => router.back()}
              className="text-xs font-bold block transition-opacity duration-150 hover:opacity-60"
              style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 2 }}
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => router.push('/dashboard/assessment')}
              className="text-xs font-bold block transition-opacity duration-150 hover:opacity-60"
              style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 2 }}
            >
              ← Home
            </button>
          )}
          <h1 className="text-base font-bold tracking-tight leading-none" style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)' }}>
            Assessment Report
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>
            {session.full_name} · {completedAt}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="px-3 py-1.5 rounded-full text-sm font-bold"
          style={{ border: `1px solid ${overall >= PASS_THRESHOLD ? 'rgba(215,255,0,0.3)' : 'rgba(239,68,68,0.3)'}`, color: overall >= PASS_THRESHOLD ? 'var(--tgl-lime)' : '#f87171', background: overall >= PASS_THRESHOLD ? 'rgba(215,255,0,0.06)' : 'rgba(239,68,68,0.06)', fontFamily: 'var(--font-space)' }}
        >
          {Math.round(overall * 100)}%
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150"
          style={{ background: 'rgba(163,230,53,0.12)', color: 'var(--tgl-lime)', border: '1px solid rgba(163,230,53,0.45)', fontFamily: 'var(--font-space)', cursor: downloading ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { if (!downloading) { (e.currentTarget as HTMLElement).style.background = 'var(--tgl-lime)'; (e.currentTarget as HTMLElement).style.color = '#000'; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(163,230,53,0.12)'; (e.currentTarget as HTMLElement).style.color = 'var(--tgl-lime)'; }}
        >
          {downloading ? '…' : '⬇ Report'}
        </button>
      </div>
    </header>
  );

  // Capital header — no download button (it lives at the bottom-center instead)
  const capitalHeader = (
    <header
      className="px-6 py-4 flex items-center justify-between shrink-0"
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
      <div className="flex items-center gap-3">
        <Image src="/assessment/tgl-logo.png" alt="TGL" width={36} height={36} className="object-contain" />
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none" style={{ fontFamily: 'var(--font-space)', color: 'var(--tgl-white)' }}>
            Assessment Report
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>
            {session.full_name} · {completedAt}
          </p>
        </div>
      </div>
      <div
        className="px-3 py-1.5 rounded-full text-sm font-bold"
        style={{ border: `1px solid ${overall >= PASS_THRESHOLD ? 'rgba(215,255,0,0.3)' : 'rgba(239,68,68,0.3)'}`, color: overall >= PASS_THRESHOLD ? 'var(--tgl-lime)' : '#f87171', background: overall >= PASS_THRESHOLD ? 'rgba(215,255,0,0.06)' : 'rgba(239,68,68,0.06)', fontFamily: 'var(--font-space)' }}
      >
        {Math.round(overall * 100)}%
      </div>
    </header>
  );

  // Capital assessment: summary + improvement inline, action buttons at bottom-center
  if (isCapital) {
    return (
      <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>
        {capitalHeader}
        <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SummaryPage scores={scores} overall={overall} best={best} worst={worst} />
          <ImprovementPage weakSections={weakSections} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 24 }}>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: '13px 40px',
                borderRadius: 12,
                background: downloading ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                color: downloading ? 'rgba(215,255,0,0.3)' : '#000',
                border: 'none',
                cursor: downloading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'var(--font-space)',
                letterSpacing: '-0.01em',
                boxShadow: downloading ? 'none' : '0 0 24px rgba(215,255,0,0.4)',
                transition: 'all 200ms ease',
              }}
            >
              {downloading ? '…' : '⬇ Download Report'}
            </button>
            <button
              onClick={() => router.push('/dashboard/assessment')}
              style={{
                padding: '10px 32px',
                borderRadius: 12,
                background: 'none',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-space)',
                letterSpacing: '-0.01em',
                transition: 'all 200ms ease',
              }}
            >
              ← Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)', paddingBottom: 80 }}>
      {sharedHeader}

      {/* Scrollable tab bar */}
      <div className="px-6 pt-4 pb-0 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex gap-1.5 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
          {pages.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setCurrentPage(i)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0"
              style={{
                background: i === currentPage ? 'var(--tgl-lime)' : 'rgba(255,255,255,0.05)',
                color: i === currentPage ? '#000' : 'rgba(255,255,255,0.45)',
                border: i === currentPage ? 'none' : '1px solid rgba(255,255,255,0.07)',
                fontFamily: 'var(--font-space)',
                cursor: 'pointer',
                boxShadow: i === currentPage ? '0 0 12px rgba(215,255,0,0.3)' : 'none',
                letterSpacing: '-0.01em',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (i !== currentPage) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
                }
              }}
              onMouseLeave={e => {
                if (i !== currentPage) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                }
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">
        {currentPageKey === 'summary' && (
          <SummaryPage scores={scores} overall={overall} best={best} worst={worst} />
        )}
        {currentGroup && (
          <SectionPage group={currentGroup} aiGrades={aiGrades} />
        )}
        {currentPageKey === 'improvement' && (
          <ImprovementPage weakSections={weakSections} />
        )}
      </div>

      {/* Fixed Prev/Next navigation */}
      <PageNav
        current={currentPage}
        total={totalPages}
        onPrev={() => setCurrentPage(p => Math.max(0, p - 1))}
        onNext={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
      />
    </main>
  );
}
