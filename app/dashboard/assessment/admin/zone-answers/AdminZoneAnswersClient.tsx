'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CAPITAL_ZONE_ANSWERS } from '@/lib/assessment/data/zone-answers-capital';
import { CAPITAL_R7_ZONE_ANSWERS } from '@/lib/assessment/data/zone-answers-capital-r7';

interface ZoneSubmission {
  id: string;
  zone_id: string;
  capital_type: string;
  price_per_meter: number | null;
  part2_data: Record<string, unknown> | null;
  is_approved: boolean;
  submitted_by: string;
  manager_name: string;
  created_at: string;
}

type MapTab = 'standard' | 'r7';
type FilterTab = 'all' | 'with_submissions' | 'approved' | 'unapproved';

const TABS: { id: MapTab; label: string }[] = [
  { id: 'standard', label: 'R8 (Standard)' },
  { id: 'r7', label: 'R7' },
];

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All Zones' },
  { id: 'with_submissions', label: 'Has Submissions' },
  { id: 'approved', label: 'Approved' },
  { id: 'unapproved', label: 'No Approval Yet' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminZoneAnswersPage() {
  const router = useRouter();
  const [mapTab, setMapTab] = useState<MapTab>('standard');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [submissions, setSubmissions] = useState<ZoneSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Load submissions
  const loadSubmissions = useCallback(async (type: MapTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assessment/admin/zone-answers?capitalType=${type}`);
      if (res.ok) {
        const json = await res.json();
        setSubmissions(json.data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubmissions(mapTab); }, [mapTab, loadSubmissions]);

  const handleApprove = useCallback(async (answerId: string) => {
    setApprovingId(answerId);
    try {
      const res = await fetch('/api/assessment/admin/zone-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_id: answerId }),
      });
      if (res.ok) {
        const json = await res.json();
        setSubmissions(prev => {
          if (json.approved) {
            // Approve this one, clear others in same zone
            const target = prev.find(s => s.id === answerId);
            return prev.map(s => {
              if (s.id === answerId) return { ...s, is_approved: true };
              if (target && s.zone_id === target.zone_id && s.capital_type === target.capital_type) return { ...s, is_approved: false };
              return s;
            });
          } else {
            return prev.map(s => s.id === answerId ? { ...s, is_approved: false } : s);
          }
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  }, []);

  // Build zone list for current map type
  const allZoneAnswers = mapTab === 'r7' ? CAPITAL_R7_ZONE_ANSWERS : CAPITAL_ZONE_ANSWERS;

  // Group submissions by zone_id
  const byZoneId: Record<string, ZoneSubmission[]> = {};
  for (const s of submissions) {
    if (!byZoneId[s.zone_id]) byZoneId[s.zone_id] = [];
    byZoneId[s.zone_id].push(s);
  }

  // Apply filter
  const filteredZones = allZoneAnswers.filter(z => {
    const subs = byZoneId[z.zoneId] ?? [];
    if (filterTab === 'with_submissions') return subs.length > 0;
    if (filterTab === 'approved') return subs.some(s => s.is_approved);
    if (filterTab === 'unapproved') return subs.length > 0 && !subs.some(s => s.is_approved);
    return true;
  });

  const totalZones = allZoneAnswers.length;
  const zonesWithSubs = allZoneAnswers.filter(z => (byZoneId[z.zoneId] ?? []).length > 0).length;
  const approvedZones = allZoneAnswers.filter(z => (byZoneId[z.zoneId] ?? []).some(s => s.is_approved)).length;

  return (
    <main className="min-h-screen" style={{ background: 'var(--tgl-black)', fontFamily: 'var(--font-space)' }}>

      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(215,255,0,0.1)', background: 'rgba(0,0,0,0.95)' }}
      >
        <div className="flex items-center gap-3">
          <Image src="/assessment/tgl-logo.png" alt="TGL" width={32} height={32} className="object-contain" />
          <div>
            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.03em' }}>
              Zone Answer Review
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
              {loading ? 'Loading...' : `${approvedZones}/${totalZones} zones approved · ${zonesWithSubs} with submissions`}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/assessment/manager')}
          className="px-3 py-2 rounded-xl text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          ← Admin Dashboard
        </button>
      </header>

      <div className="px-6 py-6 max-w-5xl mx-auto">

        {/* Map tab + filter bar */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Map type tabs */}
          <div className="flex gap-2">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setMapTab(t.id)}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150"
                style={{
                  background: mapTab === t.id ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.04)',
                  color: mapTab === t.id ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.35)',
                  border: mapTab === t.id ? '1px solid rgba(215,255,0,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilterTab(f.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
                style={{
                  background: filterTab === f.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                  color: filterTab === f.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                  border: filterTab === f.id ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zone cards */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '2px solid rgba(215,255,0,0.1)',
              borderTopColor: 'var(--tgl-lime)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-montserrat)' }}>
              No zones match this filter
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredZones.map(zone => {
              const subs = byZoneId[zone.zoneId] ?? [];
              const hasApproval = subs.some(s => s.is_approved);

              return (
                <div
                  key={zone.zoneId}
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: hasApproval
                      ? '1px solid rgba(100,220,80,0.25)'
                      : subs.length > 0
                        ? '1px solid rgba(255,215,0,0.15)'
                        : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {/* Zone header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{
                      background: hasApproval
                        ? 'rgba(100,220,80,0.04)'
                        : subs.length > 0
                          ? 'rgba(255,215,0,0.03)'
                          : 'transparent',
                      borderBottom: subs.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          fontSize: 16,
                          filter: hasApproval
                            ? 'drop-shadow(0 0 6px rgba(100,220,80,0.7))'
                            : subs.length > 0
                              ? 'drop-shadow(0 0 6px rgba(255,215,0,0.7))'
                              : 'none',
                        }}
                      >
                        {hasApproval ? '🟢' : subs.length > 0 ? '⭐' : '⚪'}
                      </span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--tgl-white)', letterSpacing: '-0.01em' }}>
                          {zone.zoneId}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-montserrat)' }}>
                          {zone.developer} · {zone.project}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasApproval && (
                        <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: 'rgba(100,220,80,0.12)', color: 'rgba(100,220,80,0.8)', border: '1px solid rgba(100,220,80,0.2)' }}>
                          ✓ Approved
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {subs.length} submission{subs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Submissions list */}
                  {subs.length === 0 ? (
                    <div className="px-5 py-4">
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-montserrat)' }}>
                        No answers submitted yet
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {subs.map(sub => (
                        <div
                          key={sub.id}
                          className="px-5 py-4 flex items-center justify-between gap-4"
                          style={{
                            background: sub.is_approved ? 'rgba(100,220,80,0.03)' : 'transparent',
                          }}
                        >
                          {/* Manager info + data summary */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-bold" style={{ color: sub.is_approved ? 'rgba(100,220,80,0.9)' : 'var(--tgl-white)' }}>
                                {sub.manager_name}
                              </span>
                              {sub.is_approved && (
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(100,220,80,0.12)', color: 'rgba(100,220,80,0.8)' }}>
                                  APPROVED
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-montserrat)' }}>
                                {sub.price_per_meter != null
                                  ? `Part 1: ${sub.price_per_meter.toLocaleString()} EGP/m²`
                                  : 'Part 1: —'}
                              </span>
                              <span className="text-xs" style={{ color: sub.part2_data ? 'rgba(100,220,80,0.6)' : 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-montserrat)' }}>
                                {sub.part2_data ? '✓ Part 2 filled' : '✗ Part 2 missing'}
                              </span>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-montserrat)' }}>
                                {formatDate(sub.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* Approve button */}
                          <button
                            onClick={() => handleApprove(sub.id)}
                            disabled={approvingId === sub.id}
                            className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150"
                            style={{
                              background: sub.is_approved
                                ? 'rgba(100,220,80,0.15)'
                                : 'rgba(255,255,255,0.06)',
                              color: sub.is_approved
                                ? 'rgba(100,220,80,0.9)'
                                : 'rgba(255,255,255,0.5)',
                              border: sub.is_approved
                                ? '1px solid rgba(100,220,80,0.3)'
                                : '1px solid rgba(255,255,255,0.08)',
                              cursor: approvingId === sub.id ? 'not-allowed' : 'pointer',
                              opacity: approvingId === sub.id ? 0.5 : 1,
                            }}
                          >
                            {approvingId === sub.id
                              ? '...'
                              : sub.is_approved
                                ? '✓ Approved'
                                : 'Approve'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
