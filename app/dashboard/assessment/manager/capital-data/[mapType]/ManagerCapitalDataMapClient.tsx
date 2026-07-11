'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CapitalMap, { CAPITAL_NO_PIN_IDS } from '@/app/dashboard/assessment/components/CapitalMap';
import Part2Modal from '@/app/dashboard/assessment/components/Part2Modal';
import { CAPITAL_ZONES } from '@/lib/assessment/data/landmarks-capital';
import { CAPITAL_R7_ZONES, CAPITAL_R7_NO_PIN_IDS } from '@/lib/assessment/data/landmarks-capital-r7';
import { CAPITAL_ZONE_ANSWERS } from '@/lib/assessment/data/zone-answers-capital';
import { CAPITAL_R7_ZONE_ANSWERS } from '@/lib/assessment/data/zone-answers-capital-r7';
import { CAPITAL_PART2_ANSWERS } from '@/lib/assessment/data/zone-answers-capital-part2';
import type { CapitalPart2Answer } from '@/lib/assessment/data/zone-answers-capital-part2';
import type { CapitalR7ZoneAnswer } from '@/lib/assessment/data/zone-answers-capital-r7';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DbAnswer {
  id: string;
  zone_id: string;
  capital_type: string;
  price_per_meter: number | null;
  part2_data: Record<string, string> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function staticPart2ToInitialAnswers(a: CapitalPart2Answer): Record<string, string> {
  const r: Record<string, string> = {};
  if (a.hasVillas !== null) r['p2-q2'] = a.hasVillas ? 'صح' : 'خطأ';
  if (a.unitTypes.length > 0) r['p2-q3'] = JSON.stringify(a.unitTypes);
  if (Object.keys(a.minAreaByType).length > 0) r['p2-q3b'] = JSON.stringify(a.minAreaByType);
  if (Object.keys(a.startingPriceByType).length > 0) r['p2-q4'] = JSON.stringify(a.startingPriceByType);
  if (a.finishing) r['p2-q5'] = a.finishing;
  if (a.longestPayment) r['p2-q6'] = JSON.stringify({ 'مقدم': a.longestPayment.dp, 'عدد السنوات': a.longestPayment.years });
  if (a.minDownPayment) r['p2-q7'] = JSON.stringify({ 'مقدم': a.minDownPayment.dp, 'عدد السنوات': a.minDownPayment.years ?? '' });
  if (a.deliveryDate) r['p2-q8'] = a.deliveryDate;
  return r;
}

// ── Shared input style ─────────────────────────────────────────────────────────

const readonlyStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  padding: '9px 14px',
  color: 'rgba(255,255,255,0.4)',
  fontSize: 13,
  fontFamily: 'var(--font-space)',
  boxSizing: 'border-box',
  textAlign: 'right',
  direction: 'rtl',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerCapitalDataMapPage() {
  const router = useRouter();
  const params = useParams();
  const mapType = params.mapType as string;
  const isR7 = mapType === 'r7';
  const capitalType = isR7 ? 'r7' : 'standard';

  const zones      = isR7 ? CAPITAL_R7_ZONES    : CAPITAL_ZONES;
  const noPinIds   = isR7 ? CAPITAL_R7_NO_PIN_IDS : CAPITAL_NO_PIN_IDS;
  const zoneAnswers = isR7 ? CAPITAL_R7_ZONE_ANSWERS : CAPITAL_ZONE_ANSWERS;

  const [dbAnswers,  setDbAnswers]  = useState<DbAnswer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [mapReady,   setMapReady]   = useState(false);

  // Part 1 form
  const [activeZoneId,  setActiveZoneId]  = useState<string | null>(null);
  const [priceInput,    setPriceInput]    = useState('');
  const [savingPart1,   setSavingPart1]   = useState(false);
  const [part1Error,    setPart1Error]    = useState('');

  // Part 2 modal
  const [part2ZoneId,  setPart2ZoneId]   = useState<string | null>(null);
  const [savingPart2,  setSavingPart2]   = useState(false);

  // Load DB answers
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/assessment/manager/zone-answers?capitalType=${capitalType}&onlyMine=true`);
        if (res.ok) {
          const json = await res.json();
          setDbAnswers(json.data ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [capitalType]);

  // DB lookup by zone_id
  const dbByZoneId = useMemo(() => {
    const m: Record<string, DbAnswer> = {};
    dbAnswers.forEach(a => { m[a.zone_id] = a; });
    return m;
  }, [dbAnswers]);

  // Part 2 static lookup
  const staticPart2Map = useMemo(() => {
    const m: Record<string, CapitalPart2Answer> = {};
    CAPITAL_PART2_ANSWERS.forEach(a => { m[a.zoneId] = a; });
    return m;
  }, []);

  // Classify zones → pin colors
  const { zoneResults, part2Results } = useMemo(() => {
    const zr: Record<string, boolean> = {};
    const p2r: Record<string, boolean> = {};

    zones.filter(z => !noPinIds.has(z.id)).forEach(z => {
      const dbRow = dbByZoneId[z.id];

      // Part 1 complete?
      const staticHasPrice = isR7
        ? (zoneAnswers as CapitalR7ZoneAnswer[]).find(a => a.zoneId === z.id)?.pricePerMeter != null
        : false;
      const part1Done = staticHasPrice || (dbRow?.price_per_meter != null);
      if (part1Done) zr[z.id] = true;

      // Part 2 complete?
      const staticP2 = staticPart2Map[z.id];
      const part2Done = (dbRow?.part2_data != null) || (staticP2 ? isStaticPart2Complete(staticP2) : false);
      if (part1Done && part2Done) p2r[z.id] = true;
    });

    return { zoneResults: zr, part2Results: p2r };
  }, [zones, noPinIds, zoneAnswers, dbByZoneId, isR7, staticPart2Map]);

  // Click handler
  const handleStarClick = useCallback((zoneId: string) => {
    if (zoneResults[zoneId] === true && part2Results[zoneId] === true) return; // gold → locked
    if (zoneResults[zoneId] === true) {
      setPart2ZoneId(zoneId);
      return;
    }
    // Yellow → Part 1 form
    setPriceInput('');
    setPart1Error('');
    setActiveZoneId(zoneId);
  }, [zoneResults, part2Results]);

  // Part 1 submit
  const handlePart1Submit = useCallback(async () => {
    if (!activeZoneId) return;
    const parsed = parseFloat(priceInput.replace(/,/g, '').trim());
    if (!priceInput.trim() || isNaN(parsed) || parsed <= 0) {
      setPart1Error('أدخل سعرًا صحيحًا');
      return;
    }
    setSavingPart1(true);
    setPart1Error('');
    try {
      const res = await fetch('/api/assessment/manager/zone-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: activeZoneId, capital_type: capitalType, price_per_meter: parsed }),
      });
      if (!res.ok) {
        const json = await res.json();
        setPart1Error(json.error ?? 'فشل الحفظ');
        return;
      }
      setDbAnswers(prev => {
        const ex = prev.find(a => a.zone_id === activeZoneId);
        if (ex) return prev.map(a => a.zone_id === activeZoneId ? { ...a, price_per_meter: parsed } : a);
        return [...prev, { id: Date.now().toString(), zone_id: activeZoneId, capital_type: capitalType, price_per_meter: parsed, part2_data: null }];
      });
      const zId = activeZoneId;
      setActiveZoneId(null);
      setPart2ZoneId(zId); // auto-open Part 2
    } catch {
      setPart1Error('حدث خطأ، حاول مرة أخرى');
    } finally {
      setSavingPart1(false);
    }
  }, [activeZoneId, priceInput, capitalType]);

  // Part 2 manager submit
  const handlePart2ManagerSubmit = useCallback(async (answers: Record<string, string>) => {
    if (!part2ZoneId) return;
    setSavingPart2(true);
    try {
      const res = await fetch('/api/assessment/manager/zone-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: part2ZoneId, capital_type: capitalType, part2_data: answers }),
      });
      if (res.ok) {
        setDbAnswers(prev => {
          const ex = prev.find(a => a.zone_id === part2ZoneId);
          if (ex) return prev.map(a => a.zone_id === part2ZoneId ? { ...a, part2_data: answers } : a);
          return [...prev, { id: Date.now().toString(), zone_id: part2ZoneId, capital_type: capitalType, price_per_meter: null, part2_data: answers }];
        });
        setPart2ZoneId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPart2(false);
    }
  }, [part2ZoneId, capitalType]);

  // Active zone data
  const activeZone = activeZoneId ? zones.find(z => z.id === activeZoneId) : null;
  const activeStaticAnswer = activeZone ? zoneAnswers.find(a => a.zoneId === activeZone.id) : null;

  // Part 2 zone + initial answers
  const part2Zone = part2ZoneId ? zones.find(z => z.id === part2ZoneId) : null;
  const part2InitialAnswers = useMemo(() => {
    if (!part2ZoneId) return {};
    const staticP2 = staticPart2Map[part2ZoneId];
    return staticP2 ? staticPart2ToInitialAnswers(staticP2) : {};
  }, [part2ZoneId, staticPart2Map]);

  // Progress counts
  const allZones    = zones.filter(z => !noPinIds.has(z.id));
  const donePart1   = allZones.filter(z => zoneResults[z.id] === true).length;
  const doneBoth    = allZones.filter(z => part2Results[z.id] === true).length;
  const missingPart1 = allZones.length - donePart1;
  const missingPart2 = donePart1 - doneBoth;

  return (
    <main className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--tgl-black)', fontFamily: 'var(--font-space)' }}>

      {/* ── Header ── */}
      <header
        className="px-5 py-3 flex items-center justify-between shrink-0"
        style={{
          background: 'rgba(0,0,0,0.95)',
          borderBottom: '1px solid rgba(215,255,0,0.1)',
          boxShadow: '0 1px 0 rgba(215,255,0,0.04), 0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={28} height={28} className="object-contain" />
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.01em' }}>
              Data Collection — {isR7 ? 'R7' : 'R8'}
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)', fontSize: 10 }}>
              {loading ? 'Loading...' : `${missingPart1} Part 1 missing · ${missingPart2} Part 2 missing`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress pill */}
          {!loading && (
            <div
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{ background: 'rgba(215,255,0,0.07)', color: 'rgba(215,255,0,0.6)', border: '1px solid rgba(215,255,0,0.12)' }}
            >
              {doneBoth}/{allZones.length} complete
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/assessment/manager/capital-data')}
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
            ← Back
          </button>
        </div>
      </header>

      {/* ── Map area ── */}
      <div
        className="flex-1 overflow-hidden p-3"
        style={{ position: 'relative', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {(!mapReady || loading) && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid rgba(215,255,0,0.1)',
              borderTopColor: 'var(--tgl-lime)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}
        <div style={{ opacity: (mapReady && !loading) ? 1 : 0, transition: 'opacity 300ms', width: '100%' }}>
          <CapitalMap
            zones={zones}
            zoneResults={zoneResults}
            part2Results={part2Results}
            onStarClick={handleStarClick}
            onReady={() => setMapReady(true)}
            mapSrc={isR7 ? '/assessment/r7-capital-map.png' : '/assessment/new-capital-map.png'}
            mapW={isR7 ? 1998 : 1153}
            mapH={isR7 ? 1563 : 878}
            zoneAnswers={zoneAnswers}
            noPinIds={noPinIds}
          />
        </div>
      </div>

      {/* ── Part 1 Form Modal ── */}
      {activeZone && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.80)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) setActiveZoneId(null); }}
        >
          <div
            dir="rtl"
            style={{
              background: 'rgba(10,10,10,0.98)',
              border: '1px solid rgba(255,215,0,0.35)',
              borderRadius: 16,
              padding: 28,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 0 40px rgba(255,215,0,0.1), 0 20px 60px rgba(0,0,0,0.6)',
              fontFamily: 'var(--font-space)',
            }}
          >
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, color: '#FFD700', filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.8))' }}>★</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#FFD700' }}>
                    منطقة {activeZone.code}
                  </h2>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
                    MANAGER DATA ENTRY
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveZoneId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            {/* Read-only: Developer */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '0.05em' }}>
                المطور (محدد مسبقًا)
              </label>
              <div style={readonlyStyle}>{activeStaticAnswer?.developer ?? '—'}</div>
            </div>

            {/* Read-only: Project */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '0.05em' }}>
                المشروع (محدد مسبقًا)
              </label>
              <div style={readonlyStyle}>{activeStaticAnswer?.project ?? '—'}</div>
            </div>

            {/* Read-only: Acres */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '0.05em' }}>
                المساحة بالفدان (محدد مسبقًا)
              </label>
              <div style={readonlyStyle}>{activeStaticAnswer?.acres ?? '—'}</div>
            </div>

            {/* Editable: Price per meter */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,215,0,0.8)', marginBottom: 7 }}>
                ★ بداية سعر المتر (أدخل القيمة الصحيحة)
              </label>
              <input
                type="text"
                value={priceInput}
                onChange={e => { setPriceInput(e.target.value); setPart1Error(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handlePart1Submit(); }}
                style={{
                  ...inputStyle,
                  border: part1Error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,215,0,0.3)',
                  boxShadow: part1Error ? 'none' : '0 0 0 0 transparent',
                }}
                placeholder="مثال: 48000"
                autoFocus
              />
              {part1Error && (
                <p style={{ margin: '5px 0 0', fontSize: 11, color: '#f87171', textAlign: 'right' }}>{part1Error}</p>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handlePart1Submit}
                disabled={savingPart1 || !priceInput.trim()}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 10,
                  background: (savingPart1 || !priceInput.trim()) ? 'rgba(255,215,0,0.12)' : '#FFD700',
                  color: (savingPart1 || !priceInput.trim()) ? 'rgba(0,0,0,0.3)' : '#000',
                  border: 'none',
                  cursor: (savingPart1 || !priceInput.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'var(--font-space)',
                  boxShadow: (savingPart1 || !priceInput.trim()) ? 'none' : '0 0 18px rgba(255,215,0,0.3)',
                  transition: 'all 150ms',
                }}
              >
                {savingPart1 ? 'جاري الحفظ...' : 'حفظ ← الجزء الثاني'}
              </button>
              <button
                onClick={() => setActiveZoneId(null)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'var(--font-space)',
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Part 2 Modal ── */}
      {part2Zone && (
        <Part2Modal
          zoneCode={part2Zone.code}
          zoneLabel={part2Zone.label}
          onSubmit={() => {}}
          onClose={() => setPart2ZoneId(null)}
          saving={savingPart2}
          onManagerSubmit={handlePart2ManagerSubmit}
          initialAnswers={part2InitialAnswers}
        />
      )}
    </main>
  );
}
