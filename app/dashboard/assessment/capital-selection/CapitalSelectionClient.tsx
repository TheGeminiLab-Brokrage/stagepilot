'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSession } from '@/lib/assessment/data-client';

export default function CapitalSelectionPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startingR7, setStartingR7] = useState(false);

  const handleR7 = useCallback(async () => {
    if (startingR7) return;
    setStartingR7(true);
    try {
      const sessionId = await createSession('capital_r7');
      localStorage.setItem('va_session_id', sessionId);
      localStorage.setItem('va_capital', '2');
      router.push('/dashboard/assessment/capital-game-r7');
    } catch {
      setStartingR7(false);
    }
  }, [startingR7, router]);

  const handleR8 = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const sessionId = await createSession('capital_r8');
      localStorage.setItem('va_session_id', sessionId);
      localStorage.setItem('va_capital', '1');
      router.push('/dashboard/assessment/capital-game');
    } catch {
      setStarting(false);
    }
  }, [starting, router]);

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => router.push('/dashboard/assessment')}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '6px 14px',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-space)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          ← Back
        </button>

        <div>
          <p style={{ fontFamily: 'var(--font-space)', fontWeight: 900, fontSize: 16, color: 'var(--tgl-white)', letterSpacing: '-0.02em' }}>
            New Capital
          </p>
          <p style={{ fontFamily: 'var(--font-montserrat)', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
            New Administrative Capital · Egypt
          </p>
        </div>
      </div>

      {/* Selection Area */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">

        {/* Title */}
        <div className="text-center mb-12">
          <h1
            style={{
              fontFamily: 'var(--font-space)',
              fontWeight: 900,
              fontSize: 32,
              color: 'var(--tgl-white)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: 10,
            }}
          >
            Choose Assessment
          </h1>
          <p style={{ fontFamily: 'var(--font-montserrat)', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Select the area you want to be assessed on
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-5 w-full" style={{ maxWidth: 520 }}>

          {/* R7 — Available */}
          <button
            onClick={handleR7}
            disabled={startingR7}
            className="text-left rounded-2xl p-6 active:scale-[0.98]"
            style={{
              background: 'rgba(215,255,0,0.04)',
              border: '1px solid rgba(215,255,0,0.18)',
              boxShadow: '0 0 24px rgba(215,255,0,0.06), inset 0 1px 0 rgba(215,255,0,0.08)',
              cursor: startingR7 ? 'not-allowed' : 'pointer',
              transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 150ms ease',
              opacity: startingR7 ? 0.7 : 1,
            }}
            onMouseEnter={e => {
              if (!startingR7) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(215,255,0,0.18), inset 0 1px 0 rgba(215,255,0,0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.4)';
              }
            }}
            onMouseLeave={e => {
              if (!startingR7) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(215,255,0,0.06), inset 0 1px 0 rgba(215,255,0,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(215,255,0,0.18)';
              }
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <span style={{ fontSize: 26 }}>🗺️</span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  fontFamily: 'var(--font-space)',
                  color: 'rgba(215,255,0,0.9)',
                  background: 'rgba(215,255,0,0.1)',
                  border: '1px solid rgba(215,255,0,0.2)',
                }}
              >
                {startingR7 ? 'Starting…' : 'Start →'}
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-space)',
                fontWeight: 900,
                fontSize: 28,
                color: 'var(--tgl-white)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              R7
            </h2>
            <p style={{ fontFamily: 'var(--font-montserrat)', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Round 7 · Available Now
            </p>
          </button>

          {/* R8 — Available */}
          <button
            onClick={handleR8}
            disabled={starting}
            className="text-left rounded-2xl p-6 active:scale-[0.98]"
            style={{
              background: 'rgba(215,255,0,0.04)',
              border: '1px solid rgba(215,255,0,0.18)',
              boxShadow: '0 0 24px rgba(215,255,0,0.06), inset 0 1px 0 rgba(215,255,0,0.08)',
              cursor: starting ? 'not-allowed' : 'pointer',
              transition: 'box-shadow 200ms ease, border-color 200ms ease, transform 150ms ease',
              opacity: starting ? 0.7 : 1,
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
            <div className="flex items-start justify-between mb-4">
              <span style={{ fontSize: 26 }}>🏙️</span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  fontFamily: 'var(--font-space)',
                  color: 'rgba(215,255,0,0.9)',
                  background: 'rgba(215,255,0,0.1)',
                  border: '1px solid rgba(215,255,0,0.2)',
                }}
              >
                {starting ? 'Starting…' : 'Start →'}
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-space)',
                fontWeight: 900,
                fontSize: 28,
                color: 'var(--tgl-white)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              R8
            </h2>
            <p style={{ fontFamily: 'var(--font-montserrat)', fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              Round 8 · Available Now
            </p>
          </button>

        </div>
      </div>

    </main>
  );
}
