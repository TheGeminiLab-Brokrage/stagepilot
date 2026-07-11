'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CAPITAL_ZONES } from '@/lib/assessment/data/landmarks-capital';
import { CAPITAL_R7_ZONES, CAPITAL_R7_NO_PIN_IDS } from '@/lib/assessment/data/landmarks-capital-r7';
import { CAPITAL_NO_PIN_IDS } from '@/app/dashboard/assessment/components/CapitalMap';
import { CAPITAL_R7_ZONE_ANSWERS } from '@/lib/assessment/data/zone-answers-capital-r7';
import { CAPITAL_PART2_ANSWERS } from '@/lib/assessment/data/zone-answers-capital-part2';
import type { CapitalPart2Answer } from '@/lib/assessment/data/zone-answers-capital-part2';
import type { CapitalR7ZoneAnswer } from '@/lib/assessment/data/zone-answers-capital-r7';

interface DbAnswer {
  zone_id: string;
  capital_type: string;
  price_per_meter: number | null;
  part2_data: Record<string, string> | null;
}

function isStaticPart2Complete(a: CapitalPart2Answer): boolean {
  return (
    a.hasVillas !== null &&
    a.unitTypes.length > 0 &&
    a.finishing !== null &&
    a.longestPayment !== null &&
    a.minDownPayment !== null &&
    a.deliveryDate !== null
  );
}

function computeCounts(
  capitalType: 'standard' | 'r7',
  dbRows: DbAnswer[]
) {
  const zones = capitalType === 'r7' ? CAPITAL_R7_ZONES : CAPITAL_ZONES;
  const noPins = capitalType === 'r7' ? CAPITAL_R7_NO_PIN_IDS : CAPITAL_NO_PIN_IDS;
  const r7Answers = CAPITAL_R7_ZONE_ANSWERS as CapitalR7ZoneAnswer[];

  const part2Map: Record<string, CapitalPart2Answer> = {};
  CAPITAL_PART2_ANSWERS.forEach(a => { part2Map[a.zoneId] = a; });

  const dbMap: Record<string, DbAnswer> = {};
  dbRows.filter(r => r.capital_type === capitalType).forEach(r => { dbMap[r.zone_id] = r; });

  let missingPart1 = 0;
  let missingPart2 = 0;

  zones.filter(z => !noPins.has(z.id)).forEach(z => {
    const dbRow = dbMap[z.id];

    const staticHasPrice = capitalType === 'r7'
      ? (r7Answers.find(a => a.zoneId === z.id)?.pricePerMeter != null)
      : false;
    const part1Done = staticHasPrice || (dbRow?.price_per_meter != null);
    if (!part1Done) missingPart1++;

    const staticPart2 = part2Map[z.id];
    const part2Done = (dbRow?.part2_data != null) || (staticPart2 ? isStaticPart2Complete(staticPart2) : false);
    if (part1Done && !part2Done) missingPart2++;
  });

  return { missingPart1, missingPart2 };
}

export default function ManagerCapitalDataSelectionPage() {
  const router = useRouter();
  const [dbAnswers, setDbAnswers] = useState<DbAnswer[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadDb() {
      try {
        const [r7Res, r8Res] = await Promise.all([
          fetch('/api/assessment/manager/zone-answers?capitalType=r7&onlyMine=true'),
          fetch('/api/assessment/manager/zone-answers?capitalType=standard&onlyMine=true'),
        ]);
        const r7Json = r7Res.ok ? await r7Res.json() : { data: [] };
        const r8Json = r8Res.ok ? await r8Res.json() : { data: [] };
        setDbAnswers([...(r7Json.data ?? []), ...(r8Json.data ?? [])]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    }
    loadDb();
  }, []);

  const r7Counts = computeCounts('r7', dbAnswers);
  const r8Counts = computeCounts('standard', dbAnswers);
  const r7Total = CAPITAL_R7_ZONES.filter(z => !CAPITAL_R7_NO_PIN_IDS.has(z.id)).length;
  const r8Total = CAPITAL_ZONES.filter(z => !CAPITAL_NO_PIN_IDS.has(z.id)).length;

  const cards = [
    {
      id: 'r7',
      title: 'New Capital — R7',
      subtitle: 'منطقة R7 · الخريطة المتقدمة',
      total: r7Total,
      missingPart1: r7Counts.missingPart1,
      missingPart2: r7Counts.missingPart2,
    },
    {
      id: 'r8',
      title: 'New Capital — R8',
      subtitle: 'منطقة R8 · الخريطة الأساسية',
      total: r8Total,
      missingPart1: r8Counts.missingPart1,
      missingPart2: r8Counts.missingPart2,
    },
  ];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--tgl-black)', fontFamily: 'var(--font-space)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(215,255,0,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={36} height={36} className="object-contain" />
          <div>
            <h1 className="text-lg font-bold leading-none" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.03em' }}>
              Data Collection
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
              Select a map to fill missing data
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/assessment/manager')}
          className="px-3 py-2 rounded-xl text-xs font-bold"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          ← Manager Dashboard
        </button>
      </header>

      <div className="px-6 py-10 max-w-3xl mx-auto w-full flex-1">
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-montserrat)', lineHeight: 1.7 }}>
          Click on a pin with missing data to enter the correct answer. Pins that already have complete data are locked.
        </p>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid rgba(215,255,0,0.1)',
              borderTopColor: 'var(--tgl-lime)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {cards.map(card => {
              const totalMissing = card.missingPart1 + card.missingPart2;
              const allDone = totalMissing === 0;
              return (
                <div
                  key={card.id}
                  onClick={() => router.push(`/dashboard/assessment/manager/capital-data/${card.id}`)}
                  className="rounded-2xl p-6 cursor-pointer flex flex-col gap-4"
                  style={{
                    background: '#0d0d0d',
                    border: `1px solid ${allDone ? 'rgba(34,197,94,0.25)' : 'rgba(215,255,0,0.15)'}`,
                    transition: 'border-color 200ms, box-shadow 200ms',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = allDone ? 'rgba(34,197,94,0.5)' : 'rgba(215,255,0,0.35)';
                    el.style.boxShadow = allDone ? '0 8px 32px rgba(34,197,94,0.08)' : '0 8px 32px rgba(215,255,0,0.07)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = allDone ? 'rgba(34,197,94,0.25)' : 'rgba(215,255,0,0.15)';
                    el.style.boxShadow = 'none';
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-bold" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.02em' }}>
                        {card.title}
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)', direction: 'rtl', textAlign: 'right' }}>
                        {card.subtitle}
                      </p>
                    </div>
                    {allDone ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', whiteSpace: 'nowrap' }}>
                        ✓ Complete
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(215,255,0,0.08)', color: 'var(--tgl-lime)', border: '1px solid rgba(215,255,0,0.15)', whiteSpace: 'nowrap' }}>
                        {totalMissing} missing
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4">
                    <div>
                      <div className="text-2xl font-black" style={{ color: card.missingPart1 === 0 ? '#4ade80' : '#FFD700', letterSpacing: '-0.04em' }}>
                        {card.missingPart1}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
                        Part 1 missing<br />
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>(price/meter)</span>
                      </div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                      <div className="text-2xl font-black" style={{ color: card.missingPart2 === 0 ? '#4ade80' : '#22c55e', letterSpacing: '-0.04em' }}>
                        {card.missingPart2}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
                        Part 2 missing<br />
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>(details)</span>
                      </div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                      <div className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '-0.04em' }}>
                        {card.total}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
                        Total zones
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD700', display: 'inline-block', flexShrink: 0 }} />
                      Yellow — Part 1 missing (click to enter price/meter)
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                      Green — Part 2 missing (click to enter details)
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', flexShrink: 0 }} />
                      Gold — complete (locked)
                    </div>
                  </div>

                  <div className="flex justify-end mt-auto">
                    <span className="text-xs font-bold" style={{ color: 'rgba(215,255,0,0.6)' }}>
                      Open Map →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
