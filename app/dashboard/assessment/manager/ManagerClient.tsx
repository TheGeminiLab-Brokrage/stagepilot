'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getTeamAgents } from '@/lib/assessment/data-client';
import type { TeamAgent } from '@/lib/assessment/data-client';
import { computeScores, computeOverall, averageScores, PASS_THRESHOLD } from '@/lib/assessment/utils/scores';
import type { SectionScore } from '@/lib/assessment/utils/scores';

interface AgentWithStats {
  agent: TeamAgent;
  sessionCount: number;
  avgScores: SectionScore[];
  overall: number;
}

// ─── Section Score Pills ──────────────────────────────────────────────────────

function ScorePill({ score }: { score: SectionScore }) {
  const pass = score.pct >= PASS_THRESHOLD;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{
        background: pass ? 'rgba(215,255,0,0.08)' : 'rgba(239,68,68,0.08)',
        color: pass ? 'rgba(215,255,0,0.9)' : '#f87171',
        border: `1px solid ${pass ? 'rgba(215,255,0,0.18)' : 'rgba(239,68,68,0.2)'}`,
        fontFamily: 'var(--font-space)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: pass ? 'var(--tgl-lime)' : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
      {score.label} {Math.round(score.pct * 100)}%
    </span>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ data, onClick }: { data: AgentWithStats; onClick: () => void }) {
  const { agent, sessionCount, avgScores, overall } = data;
  const displayName = agent.full_name;
  const goodSections = avgScores.filter(s => s.pct >= PASS_THRESHOLD);
  const weakSections = avgScores.filter(s => s.pct < PASS_THRESHOLD);
  const overallPass = overall >= PASS_THRESHOLD;

  return (
    <div
      className="group relative rounded-2xl p-5 flex flex-col cursor-pointer"
      style={{ background: '#0d0d0d', border: '1px solid rgba(215,255,0,0.1)', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', height: '400px' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(215,255,0,0.06)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.1)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="text-base font-bold leading-tight" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)', letterSpacing: '-0.02em' }}>
            {displayName}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-xs px-2.5 py-1 rounded-full font-bold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-space)', whiteSpace: 'nowrap' }}>
            {sessionCount} session{sessionCount !== 1 ? 's' : ''}
          </div>
          {sessionCount > 0 && (
            <div className="text-sm font-black"
              style={{ color: overallPass ? 'var(--tgl-lime)' : '#f87171', fontFamily: 'var(--font-space)', letterSpacing: '-0.02em' }}>
              {Math.round(overall * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 mt-4 flex flex-col gap-2.5">
        {sessionCount === 0 ? (
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}>
            No sessions completed yet.
          </p>
        ) : (
          <>
            {goodSections.length > 0 && (
              <div className="shrink-0">
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(215,255,0,0.5)', fontFamily: 'var(--font-space)' }}>Strong</div>
                <div className="flex flex-wrap gap-1.5">
                  {goodSections.map(s => <ScorePill key={s.key} score={s} />)}
                </div>
              </div>
            )}
            {weakSections.length > 0 && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="text-xs font-bold uppercase tracking-widest mb-2 shrink-0" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'var(--font-space)' }}>Needs Work</div>
                <div className="flex flex-wrap content-start gap-1.5 overflow-y-auto landmark-scroll flex-1 pr-1">
                  {weakSections.map(s => <ScorePill key={s.key} score={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end mt-4 shrink-0">
        <span className="text-xs font-bold" style={{ color: 'rgba(215,255,0,0.6)', fontFamily: 'var(--font-space)' }}>
          View Details →
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface ManagerClientProps {
  isAdmin: boolean;
}

export default function ManagerPage({ isAdmin }: ManagerClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const teamAgents = await getTeamAgents();
      const withStats: AgentWithStats[] = teamAgents.map((agent) => {
        const allScores = agent.sessions.map(sd => computeScores(sd.answers));
        const avgScores = averageScores(allScores);
        const overall = computeOverall(avgScores);
        return { agent, sessionCount: agent.sessions.length, avgScores, overall };
      });
      setAgents(withStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const withSessions = agents.filter(a => a.sessionCount > 0);
  const teamAvg = withSessions.length > 0
    ? Math.round(withSessions.reduce((s, a) => s + a.overall, 0) / withSessions.length * 100)
    : null;

  return (
    <main className="min-h-screen" style={{ background: 'var(--tgl-black)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(215,255,0,0.1)' }}>
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={36} height={36} className="object-contain" />
          <div>
            <h1 className="text-lg font-bold leading-none" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)', letterSpacing: '-0.03em' }}>
              Manager Dashboard
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
              {isAdmin ? 'Company-wide' : 'Your team'} · North Coast
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/assessment/manager/overview')}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
            style={{ background: 'rgba(215,255,0,0.1)', color: 'var(--tgl-lime)', border: '1px solid rgba(215,255,0,0.25)', fontFamily: 'var(--font-space)', cursor: 'pointer' }}
          >
            Agent Development
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push('/dashboard/assessment/admin/zone-answers')}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'var(--font-space)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
            >
              Zone Answer Review
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/assessment/manager/capital-data')}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: 'var(--font-space)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
          >
            Data Collection
          </button>
        </div>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">
        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-8">
          <div>
            <div className="text-3xl font-black" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)', letterSpacing: '-0.04em' }}>
              {agents.length}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>Managed agents</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div className="text-3xl font-black" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)', letterSpacing: '-0.04em' }}>
              {agents.reduce((s, a) => s + a.sessionCount, 0)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>Total sessions</div>
          </div>
          {teamAvg !== null && (
            <>
              <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <div className="text-3xl font-black" style={{ color: 'var(--tgl-lime)', fontFamily: 'var(--font-space)', letterSpacing: '-0.04em' }}>
                  {teamAvg}%
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>Team average</div>
              </div>
            </>
          )}
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-montserrat)' }}>Loading agents…</div>
          </div>
        ) : agents.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ border: '1px dashed rgba(215,255,0,0.15)', background: 'rgba(215,255,0,0.02)' }}
          >
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--tgl-white)', fontFamily: 'var(--font-space)' }}>
              No agents yet
            </h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
              No agents are assigned to your team yet. Ask a super admin to add agents under your team.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map(data => (
              <AgentCard
                key={data.agent.id}
                data={data}
                onClick={() => router.push(`/dashboard/assessment/manager/agent/${data.agent.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
