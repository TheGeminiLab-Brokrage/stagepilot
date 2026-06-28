'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import MultiCombobox from '@/app/dashboard/components/MultiCombobox'
import { parseExcelFile, type RawRow } from '@/lib/excel-parser'
import { analyzeColumns, mergeColumnMeta, type ColumnMeta } from '@/lib/column-analyzer'
import { fmt, fmtFull } from '@/lib/property-utils'
import './property.css'

const PAGE_SIZE = 24

interface SheetRecord {
  id: string
  file_name: string
  row_count: number
  columns: ColumnMeta[]
  uploaded_at: string
}

type NumericFilter = { min: string; max: string }
type FilterValue = string[] | NumericFilter
type FilterState = Record<string, FilterValue>

function emptyFilters(columns: ColumnMeta[]): FilterState {
  return Object.fromEntries(
    columns
      .filter(c => c.type !== 'text')
      .map(c => [c.key, c.type === 'numeric' ? { min: '', max: '' } : []])
  )
}

function filterRows(rows: RawRow[], filters: FilterState, columns: ColumnMeta[]): RawRow[] {
  const active = columns.filter(c => {
    const f = filters[c.key]
    if (!f) return false
    return Array.isArray(f) ? f.length > 0 : f.min !== '' || f.max !== ''
  })
  if (active.length === 0) return rows

  return rows.filter(row => {
    for (const col of active) {
      const f = filters[col.key]
      const cell = row[col.key]
      if (Array.isArray(f)) {
        if (!f.includes(String(cell ?? ''))) return false
      } else {
        const num = parseFloat(String(cell ?? '').replace(/,/g, ''))
        const fNum = f as NumericFilter
        if (fNum.min !== '' && num < parseFloat(fNum.min)) return false
        if (fNum.max !== '' && num > parseFloat(fNum.max)) return false
      }
    }
    return true
  })
}

export default function PropertyViewerClient({ userId, companyId }: {
  userId: string
  companyId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<'loading' | 'empty' | 'loaded'>('loading')
  const [sheets, setSheets] = useState<SheetRecord[]>([])
  const [columns, setColumns] = useState<ColumnMeta[]>([])
  const [rows, setRows] = useState<RawRow[]>([])
  const [filters, setFilters] = useState<FilterState>({})
  const [sort, setSort] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: sheetRows, error: shErr } = await supabase
        .from('property_sheets')
        .select('id, file_name, row_count, columns, uploaded_at')
        .order('uploaded_at', { ascending: true })

      if (shErr || !sheetRows || sheetRows.length === 0) {
        setPhase('empty')
        return
      }

      const { data: propRows } = await supabase
        .from('property_rows')
        .select('data')
        .order('id', { ascending: true })

      const typedSheets = sheetRows as SheetRecord[]
      const merged = mergeColumnMeta(typedSheets.map(s => s.columns as ColumnMeta[]))
      const allRows = (propRows ?? []).map((r: { data: RawRow }) => r.data)
      const firstNumeric = merged.find(c => c.type === 'numeric')

      setSheets(typedSheets)
      setColumns(merged)
      setRows(allRows)
      setFilters(emptyFilters(merged))
      setSort(firstNumeric ? `${firstNumeric.key}-asc` : '')
      setPhase('loaded')
    }
    load()
  }, [supabase])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError('')

    try {
      for (const file of Array.from(files)) {
        const parsed = await parseExcelFile(file)
        for (const { sheetName, rows: sheetRows, headers } of parsed) {
          if (sheetRows.length === 0) continue
          const colMeta = analyzeColumns(sheetRows, headers)
          const displayName = parsed.length > 1 ? `${file.name} – ${sheetName}` : file.name

          const { data: sheetRecord, error: sheetErr } = await supabase
            .from('property_sheets')
            .insert({
              user_id: userId,
              company_id: companyId,
              file_name: displayName,
              row_count: sheetRows.length,
              columns: colMeta,
            })
            .select('id, file_name, row_count, columns, uploaded_at')
            .single()

          if (sheetErr || !sheetRecord) {
            setUploadError('Failed to save sheet. Check your connection and try again.')
            continue
          }

          const CHUNK = 500
          for (let i = 0; i < sheetRows.length; i += CHUNK) {
            const chunk = sheetRows.slice(i, i + CHUNK).map(r => ({
              sheet_id: sheetRecord.id,
              user_id: userId,
              company_id: companyId,
              data: r,
            }))
            await supabase.from('property_rows').insert(chunk)
          }

          const newSheet = sheetRecord as SheetRecord
          setSheets(prev => {
            const next = [...prev, newSheet]
            const merged = mergeColumnMeta(next.map(s => s.columns as ColumnMeta[]))
            setColumns(merged)
            setFilters(f => {
              const updated = emptyFilters(merged)
              // Keep existing filter values where column still exists
              for (const key of Object.keys(f)) {
                if (key in updated) updated[key] = f[key]
              }
              return updated
            })
            return next
          })
          setRows(prev => [...prev, ...sheetRows])
        }
      }
      setPhase('loaded')
    } catch (err) {
      console.error(err)
      setUploadError('Failed to parse file. Make sure it is a valid Excel (.xlsx / .xls) file.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteSheet(sheetId: string) {
    await supabase.from('property_sheets').delete().eq('id', sheetId)
    const nextSheets = sheets.filter(s => s.id !== sheetId)
    setSheets(nextSheets)

    if (nextSheets.length === 0) {
      setRows([])
      setColumns([])
      setFilters({})
      setPhase('empty')
      return
    }

    const { data: propRows } = await supabase
      .from('property_rows')
      .select('data')
      .order('id', { ascending: true })

    const allRows = (propRows ?? []).map((r: { data: RawRow }) => r.data)
    const merged = mergeColumnMeta(nextSheets.map(s => s.columns as ColumnMeta[]))
    setRows(allRows)
    setColumns(merged)
    setFilters(emptyFilters(merged))
  }

  const filtered = useMemo(() => filterRows(rows, filters, columns), [rows, filters, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const [key, dir] = sort.split('-')
    return [...filtered].sort((a, b) => {
      const av = parseFloat(String(a[key] ?? '').replace(/,/g, '')) || 0
      const bv = parseFloat(String(b[key] ?? '').replace(/,/g, '')) || 0
      return dir === 'asc' ? av - bv : bv - av
    })
  }, [filtered, sort])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const showStart = sorted.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const showEnd = Math.min(page * PAGE_SIZE, sorted.length)
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handlePage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)))
    setSelectedIdx(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [totalPages])

  const categoricalCols = useMemo(() => columns.filter(c => c.type === 'categorical'), [columns])
  const numericCols = useMemo(() => columns.filter(c => c.type === 'numeric'), [columns])
  const yearCols = useMemo(() => columns.filter(c => c.type === 'year'), [columns])
  const titleCol = categoricalCols[0]
  const subtitleCol = categoricalCols[1]

  const numericSortOptions = useMemo(() =>
    numericCols.flatMap(c => [
      { value: `${c.key}-asc`, label: `${c.label} ↑` },
      { value: `${c.key}-desc`, label: `${c.label} ↓` },
    ]), [numericCols])

  const kpiNumerics = numericCols.slice(0, 3)

  const selectedProperty = selectedIdx !== null ? sorted[selectedIdx] : null

  // ── LOADING ──
  if (phase === 'loading') {
    return (
      <div className="ph-root">
        <div className="ph-loading" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ph-spinner" />
          <p>Loading your property data…</p>
        </div>
      </div>
    )
  }

  // ── EMPTY / UPLOAD ──
  if (phase === 'empty') {
    return (
      <div className="ph-root">
        <div
          style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          <div style={{
            border: `2px dashed ${isDragging ? '#d7ff00' : 'rgba(215,255,0,0.3)'}`,
            borderRadius: 20,
            padding: '72px 80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            background: isDragging ? 'rgba(215,255,0,0.04)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s',
            maxWidth: 520,
            width: '100%',
          }}>
            <div style={{ fontSize: 60 }}>{uploading ? '⏳' : '📊'}</div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", margin: 0, textAlign: 'center' }}>
              {uploading ? 'Processing your file…' : 'Your Property Database'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontFamily: "'Montserrat', sans-serif", margin: 0, textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {uploading
                ? 'Parsing and uploading rows to your account…'
                : 'Drag & drop an Excel file here to get started.\nFilters and cards are generated automatically\nbased on your column headers.'}
            </p>
            {!uploading && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    marginTop: 8,
                    background: '#d7ff00',
                    color: '#000',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 32px',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '0.03em',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c8f000' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d7ff00' }}
                >
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handleFiles(e.target.files)}
                />
              </>
            )}
            {uploadError && (
              <p style={{ color: '#ef4444', fontSize: 13, margin: 0, textAlign: 'center' }}>{uploadError}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── LOADED ──
  return (
    <div
      className="ph-root"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
    >
      {/* Sheet manager bar */}
      <div style={{
        background: 'rgba(215,255,0,0.04)',
        borderBottom: '1px solid rgba(215,255,0,0.12)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
          Sheets:
        </span>
        {sheets.map(sheet => (
          <span key={sheet.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(215,255,0,0.1)', color: '#d7ff00',
            border: '1px solid rgba(215,255,0,0.25)',
            borderRadius: 20, padding: '3px 10px 3px 12px',
            fontSize: 12, fontFamily: "'Montserrat', sans-serif",
          }}>
            {sheet.file_name}
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>({sheet.row_count.toLocaleString()} rows)</span>
            <button
              onClick={() => deleteSheet(sheet.id)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 15, marginLeft: 2 }}
              title="Remove this sheet"
            >×</button>
          </span>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'none',
            border: '1px dashed rgba(215,255,0,0.3)',
            color: 'rgba(215,255,0,0.7)',
            borderRadius: 20, padding: '3px 12px',
            fontSize: 12, cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          + Add more data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading && <span style={{ color: 'rgba(215,255,0,0.6)', fontSize: 12 }}>Uploading…</span>}
        {uploadError && <span style={{ color: '#ef4444', fontSize: 12 }}>{uploadError}</span>}
      </div>

      <div className="ph-layout">
        {/* ── SIDEBAR ── */}
        <aside className="ph-sidebar">
          {columns.filter(c => c.type !== 'text').map(col => {
            if (col.type === 'categorical' || col.type === 'year') {
              const options = col.type === 'year'
                ? (col.years ?? []).map(y => ({ value: String(y), label: String(y) }))
                : (col.uniqueValues ?? []).map(v => ({ value: v, label: v }))
              const currentVal = (filters[col.key] ?? []) as string[]
              return (
                <div key={col.key} className="ph-filter-section">
                  <h3>{col.label}</h3>
                  <MultiCombobox
                    value={currentVal}
                    onChange={v => { setFilters(f => ({ ...f, [col.key]: v })); setPage(1) }}
                    options={options}
                    placeholder={`All (${options.length})`}
                  />
                </div>
              )
            }

            if (col.type === 'numeric') {
              const currentVal = (filters[col.key] ?? { min: '', max: '' }) as NumericFilter
              return (
                <div key={col.key} className="ph-filter-section">
                  <h3>{col.label}</h3>
                  <div className="ph-range-row">
                    <div>
                      <label className="ph-filter-label">Min</label>
                      <input
                        type="number"
                        className="ph-input"
                        placeholder={col.min != null ? String(Math.floor(col.min)) : '0'}
                        value={currentVal.min}
                        onChange={e => {
                          setFilters(f => ({ ...f, [col.key]: { ...(f[col.key] as NumericFilter), min: e.target.value } }))
                          setPage(1)
                        }}
                      />
                    </div>
                    <div>
                      <label className="ph-filter-label">Max</label>
                      <input
                        type="number"
                        className="ph-input"
                        placeholder={col.max != null ? String(Math.ceil(col.max)) : ''}
                        value={currentVal.max}
                        onChange={e => {
                          setFilters(f => ({ ...f, [col.key]: { ...(f[col.key] as NumericFilter), max: e.target.value } }))
                          setPage(1)
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            }

            return null
          })}

          <button
            className="ph-btn-reset"
            style={{ gridColumn: '1 / -1' }}
            onClick={() => { setFilters(emptyFilters(columns)); setPage(1) }}
          >
            ↺ Reset All
          </button>
        </aside>

        {/* ── MAIN ── */}
        <main className="ph-main">
          {/* KPIs */}
          <div className="ph-kpi-row">
            <div className="ph-kpi ph-kpi-energy">
              <div className="ph-kpi-icon">🏠</div>
              <div className="ph-kpi-val">{filtered.length.toLocaleString()}</div>
              <div className="ph-kpi-lbl">Total Units</div>
            </div>
            {kpiNumerics.map(col => {
              const vals = filtered
                .map(r => parseFloat(String(r[col.key] ?? '').replace(/,/g, '')))
                .filter(n => !isNaN(n) && isFinite(n))
              const minVal = vals.length ? Math.min(...vals) : null
              return (
                <div key={col.key} className="ph-kpi ph-kpi-gold">
                  <div className="ph-kpi-icon">📊</div>
                  <div className="ph-kpi-val">{minVal != null ? fmt(minVal) : '—'}</div>
                  <div className="ph-kpi-lbl">Min {col.label}</div>
                </div>
              )
            })}
          </div>

          {/* Results header */}
          <div className="ph-results-header">
            <div className="ph-results-count">
              Showing <span>{sorted.length > 0 ? `${showStart}–${showEnd}` : '0'}</span> of <span>{sorted.length.toLocaleString()}</span> units
            </div>
            <div className="ph-view-controls">
              {numericSortOptions.length > 0 && (
                <select
                  className="ph-sort-select"
                  value={sort}
                  onChange={e => { setSort(e.target.value); setPage(1) }}
                >
                  {numericSortOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <button className={`ph-view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
              <button className={`ph-view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
            </div>
          </div>

          {/* Results */}
          {sorted.length === 0 ? (
            <div className="ph-empty">
              <div className="ph-empty-icon">🔍</div>
              <h3>No records found</h3>
              <p>Try adjusting your filters</p>
            </div>
          ) : view === 'grid' ? (
            <div className="ph-grid-view">
              {pageItems.map((row, i) => {
                const idx = (page - 1) * PAGE_SIZE + i
                return (
                  <div key={idx} className="ph-property-card" onClick={() => setSelectedIdx(idx)}>
                    <div className="ph-card-top">
                      {titleCol && (
                        <div className="ph-city-badge">{String(row[titleCol.key] ?? '—')}</div>
                      )}
                      {subtitleCol && (
                        <div className="ph-card-project">{String(row[subtitleCol.key] ?? '—')}</div>
                      )}
                      {categoricalCols[2] && (
                        <div className="ph-type-badge">{String(row[categoricalCols[2].key] ?? '—')}</div>
                      )}
                    </div>
                    <div className="ph-card-body">
                      <div className="ph-card-specs">
                        {numericCols.slice(0, 4).map(c => {
                          const val = row[c.key]
                          if (val == null || val === '') return null
                          return (
                            <div key={c.key} className="ph-spec">
                              <span className="ph-spec-icon">📊</span>
                              <strong>{fmt(val)}</strong>
                              <span>{c.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      {numericCols[0] && row[numericCols[0].key] != null && (
                        <div className="ph-card-price">{fmt(row[numericCols[0].key])}</div>
                      )}
                    </div>
                    <div className="ph-card-footer">
                      {yearCols[0] && row[yearCols[0].key] != null && (
                        <span className="ph-delivery-info">📅 <span>{String(row[yearCols[0].key])}</span></span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="ph-list-view">
              {/* List header */}
              {(() => {
                const listCols = [
                  ...categoricalCols.slice(0, 2),
                  ...numericCols.slice(0, 3),
                  ...yearCols.slice(0, 1),
                ]
                return (
                  <>
                    <div className="ph-list-row" style={{ cursor: 'default', opacity: 0.45, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '8px 16px', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {listCols.map(col => (
                        <div key={col.key} style={{ flex: 1, minWidth: 80 }}>{col.label.toUpperCase()}</div>
                      ))}
                      <div style={{ width: 24 }} />
                    </div>
                    {pageItems.map((row, i) => {
                      const idx = (page - 1) * PAGE_SIZE + i
                      return (
                        <div key={idx} className="ph-list-row" onClick={() => setSelectedIdx(idx)}>
                          {listCols.map(col => (
                            <div key={col.key} style={{ flex: 1, minWidth: 80 }}>
                              {col.type === 'numeric' ? fmt(row[col.key]) : String(row[col.key] ?? '—')}
                            </div>
                          ))}
                          <div style={{ width: 24, textAlign: 'right', color: 'rgba(255,255,255,0.3)' }}>›</div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ph-pagination">
              <button className="ph-page-btn" onClick={() => handlePage(page - 1)} disabled={page === 1}>‹</button>
              {(() => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6))
                const end = Math.min(totalPages, start + 6)
                const btns = []
                if (start > 1) {
                  btns.push(<button key="1" className="ph-page-btn" onClick={() => handlePage(1)}>1</button>)
                  btns.push(<span key="e1" style={{ color: 'rgba(255,255,255,0.3)', padding: '0 4px' }}>…</span>)
                }
                for (let ii = start; ii <= end; ii++) {
                  btns.push(
                    <button key={ii} className={`ph-page-btn${ii === page ? ' active' : ''}`} onClick={() => handlePage(ii)}>{ii}</button>
                  )
                }
                if (end < totalPages) {
                  btns.push(<span key="e2" style={{ color: 'rgba(255,255,255,0.3)', padding: '0 4px' }}>…</span>)
                  btns.push(<button key={totalPages} className="ph-page-btn" onClick={() => handlePage(totalPages)}>{totalPages}</button>)
                }
                return btns
              })()}
              <button className="ph-page-btn" onClick={() => handlePage(page + 1)} disabled={page === totalPages}>›</button>
            </div>
          )}
        </main>

        {/* ── MODAL ── */}
        {selectedIdx !== null && selectedProperty && (
          <div className="ph-modal-overlay" onClick={() => setSelectedIdx(null)}>
            <div className="ph-modal" onClick={e => e.stopPropagation()}>
              <button className="ph-modal-close" onClick={() => setSelectedIdx(null)}>✕</button>
              <div className="ph-modal-header">
                {titleCol && (
                  <div className="ph-modal-city">{String(selectedProperty[titleCol.key] ?? '—')}</div>
                )}
                {subtitleCol && (
                  <div className="ph-modal-project">{String(selectedProperty[subtitleCol.key] ?? '—')}</div>
                )}
              </div>
              <div className="ph-modal-body">
                <dl className="ph-modal-grid">
                  {columns.map(col => {
                    const val = selectedProperty[col.key]
                    if (val === null || val === undefined || val === '') return null
                    return (
                      <div key={col.key} className="ph-modal-field">
                        <dt>{col.label}</dt>
                        <dd>{col.type === 'numeric' ? fmtFull(val) : String(val)}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
