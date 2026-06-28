'use client'

import { useState } from 'react'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type Row = Record<string, unknown>

export default function CrmStatusChanges() {
  const [dateFrom, setDateFrom] = useState(monthStartStr)
  const [dateTo, setDateTo]     = useState(todayStr)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [debug, setDebug]       = useState<Record<string, unknown> | null>(null)
  const [result, setResult]     = useState<{ count: number; dateFrom: string; dateTo: string; data: Row[] } | null>(null)

  async function handleUpdate() {
    if (!dateFrom || !dateTo) {
      setError('Please select both a From and To date.')
      return
    }
    if (dateFrom > dateTo) {
      setError('"From" date must be before or equal to "To" date.')
      return
    }

    setLoading(true)
    setError(null)
    setDebug(null)
    setResult(null)

    try {
      const res = await fetch('/api/crm/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Request failed (HTTP ${res.status})`)
        if (json.debug) setDebug(json.debug as Record<string, unknown>)
        return
      }
      setResult(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Derive column headers from the first row
  const columns: string[] = result?.data?.length
    ? Object.keys(result.data[0])
    : []

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 24,
        padding: '20px 24px',
        background: 'rgba(215,255,0,0.02)',
        border: '1px solid rgba(215,255,0,0.12)',
        borderRadius: 14,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 12px',
              fontFamily: "'Montserrat', sans-serif",
              outline: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              colorScheme: 'dark',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '8px 12px',
              fontFamily: "'Montserrat', sans-serif",
              outline: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              colorScheme: 'dark',
            }}
          />
        </div>

        <button
          onClick={handleUpdate}
          disabled={loading}
          style={{
            background: loading ? 'rgba(215,255,0,0.1)' : '#D7FF00',
            color: loading ? 'rgba(215,255,0,0.4)' : '#000',
            border: 'none',
            borderRadius: 8,
            padding: '0 24px',
            height: 40,
            fontSize: 14,
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'Montserrat', sans-serif",
            transition: 'all 0.15s',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
        >
          {loading ? 'Updating…' : 'Update'}
        </button>

        {loading && (
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', alignSelf: 'center' }}>
            This may take up to 90 seconds
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: debug ? 8 : 20,
          color: '#f87171',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {debug && (
        <pre style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 20,
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{
              background: 'rgba(215,255,0,0.08)',
              border: '1px solid rgba(215,255,0,0.2)',
              borderRadius: 8,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#D7FF00',
            }}>
              {result.count.toLocaleString()} records
            </div>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              {result.dateFrom} → {result.dateTo}
            </span>
          </div>

          {result.data.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
              No records found for this date range.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                fontFamily: "'Montserrat', sans-serif",
              }}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th key={col} style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#D7FF00',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        background: 'rgba(215,255,0,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        whiteSpace: 'nowrap',
                      }}>
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}
                    >
                      {columns.map(col => (
                        <td key={col} style={{
                          padding: '10px 16px',
                          color: 'rgba(255,255,255,0.8)',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          whiteSpace: 'nowrap',
                          maxWidth: 260,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {row[col] == null || row[col] === '' ? '—' : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {!loading && !error && !result && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          color: 'rgba(255,255,255,0.2)',
          gap: 8,
        }}>
          <span style={{ fontSize: 32 }}>🔄</span>
          <p style={{ fontSize: 15, margin: 0, color: 'rgba(255,255,255,0.3)' }}>
            Select a date range and click Update
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            Fetches CRM Status Changes via the local automation server
          </p>
        </div>
      )}
    </div>
  )
}
