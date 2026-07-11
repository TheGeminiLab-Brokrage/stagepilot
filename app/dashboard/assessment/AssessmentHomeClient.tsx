'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getMySessions, createSession } from '@/lib/assessment/data-client';
import type { Session, Answer } from '@/lib/assessment/types';
import { SECTIONS } from '@/lib/assessment/data/landmarks';

const PASS_THRESHOLD = 0.7;

const COLUMNS = [
  { key: 'phase0', label: 'Overview' },
  ...SECTIONS.map((s) => ({ key: `phase1_${s.id}`, label: s.label.split(' ')[0] })),
  { key: 'phase2', label: 'Quiz' },
];

const CAPITAL_COLUMNS = [
  { key: 'capital_map',  label: 'Map'      },
  { key: 'capital_pins', label: 'Projects' },
  { key: 'capital_quiz', label: 'Quiz'     },
];

function computeOverall(answers: Answer[]) {
  const totalCorrect = answers.filter((a) => a.correct).length;
  return answers.length > 0 ? totalCorrect / answers.length : 0;
}

function computePhaseScore(answers: Answer[], phaseKey: string) {
  const sa = answers.filter((a) => a.phase === phaseKey);
  if (!sa.length) return null;
  const correct = sa.filter((a) => a.correct).length;
  return { correct, total: sa.length, pct: correct / sa.length };
}

function computeCapitalPinsScore(answers: Answer[]) {
  const pa = answers.filter((a) => a.phase.startsWith('capital_pin_'));
  if (!pa.length) return null;
  const correct = pa.filter((a) => a.correct).length;
  return { correct, total: pa.length, pct: correct / pa.length };
}

function ScoreBadge({ score }: { score: { pct: number } | null }) {
  if (!score) {
    return (
      <td className="px-3 py-3.5 text-center" style={{ color: 'rgba(255,255,255,0.12)', fontSize: 12, fontFamily: 'var(--font-montserrat)' }}>—</td>
    );
  }
  const ok = score.pct >= PASS_THRESHOLD;
  return (
    <td className="px-3 py-3.5 text-center">
      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
        color: ok ? 'var(--tgl-lime)' : '#ef4444',
        background: ok ? 'rgba(215,255,0,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${ok ? 'rgba(215,255,0,0.15)' : 'rgba(239,68,68,0.15)'}`,
        fontFamily: 'var(--font-space)',
        boxShadow: ok ? '0 0 8px rgba(215,255,0,0.1)' : 'none',
      }}>
        {Math.round(score.pct * 100)}%
      </span>
    </td>
  );
}

function ViewLink({ sessionId }: { sessionId: string }) {
  return (
    <td className="px-3 py-3.5 text-center">
      <a
        href={`/dashboard/assessment/results/${sessionId}`}
        style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space)', color: 'rgba(215,255,0,0.6)', textDecoration: 'none', background: 'rgba(215,255,0,0.06)', border: '1px solid rgba(215,255,0,0.15)', borderRadius: 8, padding: '4px 10px', display: 'inline-block', transition: 'all 150ms ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(215,255,0,0.12)'; (e.currentTarget as HTMLElement).style.color = 'var(--tgl-lime)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(215,255,0,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(215,255,0,0.6)'; }}
      >
        View →
      </a>
    </td>
  );
}

function TableHeader({ columns, accentColor }: { columns: { key: string; label: string }[]; accentColor: string }) {
  return (
    <thead>
      <tr style={{ background: 'linear-gradient(180deg, #111111 0%, #0d0d0d 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <th className="px-5 py-3.5 text-left">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor, fontFamily: 'var(--font-space)' }}>Date</span>
        </th>
        {columns.map((col) => (
          <th key={col.key} className="px-3 py-3.5 text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-space)' }}>{col.label}</span>
          </th>
        ))}
        <th className="px-3 py-3.5 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor, fontFamily: 'var(--font-space)' }}>Total</span>
        </th>
        <th className="px-3 py-3.5 text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-space)' }}>Report</span>
        </th>
      </tr>
    </thead>
  );
}

interface AssessmentHomeClientProps {
  fullName: string;
  isManagerOrAdmin: boolean;
}

export default function DashboardPage({ fullName, isManagerOrAdmin }: AssessmentHomeClientProps) {
  const router = useRouter();
  const [rows, setRows]         = useState<{ session: Session; answers: Answer[] }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [starting, setStarting] = useState<'sahel' | 'capital' | null>(null);

  useEffect(() => {
    getMySessions()
      .then((sessions) => { setRows(sessions); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  const handleStartAssessment = useCallback(async () => {
    setStarting('sahel');
    try {
      const sessionId = await createSession('north_coast');
      localStorage.setItem('va_session_id', sessionId);
      localStorage.removeItem('va_capital');
      router.push('/dashboard/assessment/game');
    } catch {
      setStarting(null);
    }
  }, [router]);

  const handleStartCapitalAssessment = useCallback(() => {
    router.push('/dashboard/assessment/capital-selection');
  }, [router]);

  const sahelRows   = rows.filter((r) => r.session.region === 'north_coast');
  const capitalRows = rows.filter((r) => r.session.region !== 'north_coast');

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--tgl-black)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {loadError ? (
            <>
              <p style={{ color: '#ef4444', fontSize: 14, fontFamily: 'var(--font-space)', fontWeight: 700 }}>Failed to load dashboard</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'var(--font-montserrat)' }}>Check your connection, then refresh the page.</p>
              <button
                onClick={() => window.location.reload()}
                style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, background: 'var(--tgl-lime)', color: '#000', fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}
              >
                Refresh
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid rgba(215,255,0,0.1)',
                borderTopColor: 'var(--tgl-lime)',
                animation: 'spin 0.8s linear infinite',
                boxShadow: '0 0 14px rgba(215,255,0,0.2)',
              }} />
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'var(--font-montserrat)' }}>Loading…</p>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>

      {/* ── Header ── */}
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
            <h1
              className="text-lg font-bold leading-none"
              style={{
                fontFamily: 'var(--font-space)',
                color: 'var(--tgl-white)',
                letterSpacing: '-0.02em',
              }}
            >
              {fullName || 'My Dashboard'}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-montserrat)' }}>
              TGL Assessment
            </p>
          </div>
        </div>

        {isManagerOrAdmin && (
          <button
            onClick={() => router.push('/dashboard/assessment/manager')}
            className="px-4 py-2 rounded-full text-xs font-bold"
            style={{
              fontFamily: 'var(--font-space)',
              color: 'var(--tgl-lime)',
              border: '1px solid rgba(215,255,0,0.25)',
              background: 'rgba(215,255,0,0.06)',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Manager View →
          </button>
        )}
      </header>

      {/* ── Region Selector ── */}
      <div className="px-6 pt-8 pb-2">
        <p
          className="text-xs font-bold uppercase tracking-widest mb-4"
          style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-space)' }}
        >
          Select Assessment Region
        </p>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
        >
          {/* Sahel Card */}
          <button
            onClick={handleStartAssessment}
            disabled={starting !== null}
            className="text-left rounded-2xl p-6 active:scale-[0.98]"
            style={{
              background: 'rgba(215,255,0,0.04)',
              border: '1px solid rgba(215,255,0,0.18)',
              boxShadow: '0 0 24px rgba(215,255,0,0.06), inset 0 1px 0 rgba(215,255,0,0.08)',
              cursor: starting !== null ? 'not-allowed' : 'pointer',
              transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 150ms ease',
              opacity: starting !== null ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!starting) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(215,255,0,0.18), inset 0 1px 0 rgba(215,255,0,0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.4)';
              }
            }}
            onMouseLeave={e => {
              if (!starting) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(215,255,0,0.06), inset 0 1px 0 rgba(215,255,0,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.18)';
              }
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span style={{ fontSize: 28 }}>🏖️</span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  fontFamily: 'var(--font-space)',
                  color: 'var(--tgl-lime)',
                  background: 'rgba(215,255,0,0.1)',
                  border: '1px solid rgba(215,255,0,0.2)',
                  boxShadow: '0 0 8px rgba(215,255,0,0.1)',
                }}
              >
                {starting === 'sahel' ? 'Starting…' : 'Start →'}
              </span>
            </div>
            <h3
              className="text-2xl font-black mb-1"
              style={{
                fontFamily: 'var(--font-space)',
                color: 'var(--tgl-white)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Sahel
            </h3>
            <p
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)', lineHeight: 1.6 }}
            >
              North Coast · Egypt
            </p>
          </button>

          {/* New Capital Card */}
          <button
            onClick={handleStartCapitalAssessment}
            disabled={starting !== null}
            className="text-left rounded-2xl p-6 active:scale-[0.98]"
            style={{
              background: 'rgba(56,189,248,0.04)',
              border: '1px solid rgba(56,189,248,0.18)',
              boxShadow: '0 0 24px rgba(56,189,248,0.06), inset 0 1px 0 rgba(56,189,248,0.08)',
              cursor: starting !== null ? 'not-allowed' : 'pointer',
              transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 150ms ease',
              opacity: starting !== null ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!starting) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(56,189,248,0.18), inset 0 1px 0 rgba(56,189,248,0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.4)';
              }
            }}
            onMouseLeave={e => {
              if (!starting) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(56,189,248,0.06), inset 0 1px 0 rgba(56,189,248,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.18)';
              }
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <span style={{ fontSize: 28 }}>🏙️</span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  fontFamily: 'var(--font-space)',
                  color: 'rgba(56,189,248,0.9)',
                  background: 'rgba(56,189,248,0.1)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  boxShadow: '0 0 8px rgba(56,189,248,0.1)',
                }}
              >
                {starting === 'capital' ? 'Starting…' : 'Start →'}
              </span>
            </div>
            <h3
              className="text-2xl font-black mb-1"
              style={{
                fontFamily: 'var(--font-space)',
                color: 'var(--tgl-white)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              New Capital
            </h3>
            <p
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)', lineHeight: 1.6 }}
            >
              New Administrative Capital · Egypt
            </p>
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-8">
        {rows.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {/* Glow + icon */}
            <div style={{ position: 'relative', marginBottom: 28 }}>
              <div style={{
                position: 'absolute',
                inset: -40,
                background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(215,255,0,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: 'rgba(215,255,0,0.06)',
                  border: '1px solid rgba(215,255,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 0 40px rgba(215,255,0,0.08), inset 0 1px 0 rgba(215,255,0,0.1)',
                }}
              >
                <span style={{ fontSize: 32 }}>🗺️</span>
              </div>
            </div>

            <h2
              className="text-2xl font-bold mb-3"
              style={{
                fontFamily: 'var(--font-space)',
                color: 'var(--tgl-white)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              No assessments yet
            </h2>
            <p
              className="text-sm mb-10"
              style={{
                color: 'rgba(255,255,255,0.38)',
                fontFamily: 'var(--font-montserrat)',
                maxWidth: 300,
                lineHeight: 1.7,
              }}
            >
              Start your first North Coast assessment to test your knowledge and track your progress over time.
            </p>
            <button
              onClick={handleStartAssessment}
              disabled={starting !== null}
              className="px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-widest active:scale-95"
              style={{
                fontFamily: 'var(--font-space)',
                background: starting ? 'rgba(215,255,0,0.08)' : 'var(--tgl-lime)',
                color: starting ? 'rgba(215,255,0,0.3)' : '#000',
                boxShadow: starting ? 'none' : '0 0 24px rgba(215,255,0,0.45), 0 0 60px rgba(215,255,0,0.15)',
                border: 'none',
                cursor: starting ? 'not-allowed' : 'pointer',
                letterSpacing: '0.08em',
                transition: 'box-shadow 150ms ease, transform 150ms ease',
              }}
              onMouseEnter={e => {
                if (!starting) {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(215,255,0,0.65), 0 0 80px rgba(215,255,0,0.2)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={e => {
                if (!starting) {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(215,255,0,0.45), 0 0 60px rgba(215,255,0,0.15)';
                  (e.currentTarget as HTMLElement).style.transform = '';
                }
              }}
            >
              {starting === 'sahel' ? 'Starting…' : 'Begin Assessment →'}
            </button>
          </div>
        ) : (
          <>
            {/* ── History header ── */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-space)', color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em' }}>
                  Assessment History
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}>
                  {rows.length} {rows.length === 1 ? 'session' : 'sessions'} completed
                </p>
              </div>
              <button
                onClick={handleStartAssessment}
                disabled={starting !== null}
                className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
                style={{ fontFamily: 'var(--font-space)', background: starting ? 'rgba(215,255,0,0.06)' : 'rgba(215,255,0,0.1)', color: starting ? 'rgba(215,255,0,0.3)' : 'var(--tgl-lime)', border: '1px solid rgba(215,255,0,0.2)', cursor: starting ? 'not-allowed' : 'pointer', boxShadow: starting ? 'none' : '0 0 10px rgba(215,255,0,0.12)', letterSpacing: '-0.01em', transition: 'all 150ms ease' }}
                onMouseEnter={e => { if (!starting) (e.currentTarget as HTMLElement).style.background = 'rgba(215,255,0,0.16)'; }}
                onMouseLeave={e => { if (!starting) (e.currentTarget as HTMLElement).style.background = 'rgba(215,255,0,0.1)'; }}
              >
                {starting === 'sahel' ? 'Starting…' : '+ New Assessment'}
              </button>
            </div>

            {/* ── Sahel table ── */}
            {sahelRows.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(215,255,0,0.45)', fontFamily: 'var(--font-space)' }}>
                  Sahel — North Coast · {sahelRows.length} {sahelRows.length === 1 ? 'session' : 'sessions'}
                </p>
                <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid rgba(215,255,0,0.1)', boxShadow: '0 0 40px rgba(215,255,0,0.04)', minWidth: 700 }}>
                  <table className="w-full border-collapse">
                    <TableHeader columns={COLUMNS} accentColor="rgba(215,255,0,0.5)" />
                    <tbody>
                      {sahelRows.map(({ session, answers }, i) => {
                        const overall = computeOverall(answers);
                        const passing = overall >= PASS_THRESHOLD;
                        const date = session.completed_at
                          ? new Date(session.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—';
                        return (
                          <tr key={session.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', transition: 'background 150ms ease', cursor: 'default' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(215,255,0,0.025)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'; }}
                          >
                            <td className="px-5 py-3.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>{date}</td>
                            {COLUMNS.map((col) => <ScoreBadge key={col.key} score={computePhaseScore(answers, col.key)} />)}
                            <td className="px-3 py-3.5 text-center">
                              <span className="text-sm font-black" style={{ color: passing ? 'var(--tgl-lime)' : '#ef4444', fontFamily: 'var(--font-space)', textShadow: passing ? '0 0 10px rgba(215,255,0,0.35)' : '0 0 10px rgba(239,68,68,0.3)', letterSpacing: '-0.02em' }}>
                                {Math.round(overall * 100)}%
                              </span>
                            </td>
                            <ViewLink sessionId={session.id} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── New Capital table ── */}
            {capitalRows.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(56,189,248,0.55)', fontFamily: 'var(--font-space)' }}>
                  New Capital · {capitalRows.length} {capitalRows.length === 1 ? 'session' : 'sessions'}
                </p>
                <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ border: '1px solid rgba(56,189,248,0.12)', boxShadow: '0 0 40px rgba(56,189,248,0.04)', minWidth: 500 }}>
                  <table className="w-full border-collapse">
                    <TableHeader columns={CAPITAL_COLUMNS} accentColor="rgba(56,189,248,0.55)" />
                    <tbody>
                      {capitalRows.map(({ session, answers }, i) => {
                        const overall = computeOverall(answers);
                        const passing = overall >= PASS_THRESHOLD;
                        const date = session.completed_at
                          ? new Date(session.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—';
                        return (
                          <tr key={session.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', transition: 'background 150ms ease', cursor: 'default' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.025)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'; }}
                          >
                            <td className="px-5 py-3.5 text-sm" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-montserrat)' }}>{date}</td>
                            <ScoreBadge score={computePhaseScore(answers, 'capital_map')} />
                            <ScoreBadge score={computeCapitalPinsScore(answers)} />
                            <ScoreBadge score={computePhaseScore(answers, 'capital_quiz')} />
                            <td className="px-3 py-3.5 text-center">
                              <span className="text-sm font-black" style={{ color: passing ? 'rgba(56,189,248,0.9)' : '#ef4444', fontFamily: 'var(--font-space)', textShadow: passing ? '0 0 10px rgba(56,189,248,0.35)' : '0 0 10px rgba(239,68,68,0.3)', letterSpacing: '-0.02em' }}>
                                {Math.round(overall * 100)}%
                              </span>
                            </td>
                            <ViewLink sessionId={session.id} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
