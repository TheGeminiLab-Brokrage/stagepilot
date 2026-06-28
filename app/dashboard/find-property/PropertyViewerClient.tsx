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

interface ViewConfig {
  titleColumn: string
  subtitleColumn: string
  badgeColumn: string
  cardColumns: string[]
  filterColumns: string[]
  sortColumn: string
  sortDir: 'asc' | 'desc'
}

type NumericFilter = { min: string; max: string }
type FilterValue = string[] | NumericFilter
type FilterState = Record<string, FilterValue>

// Returns inline styles for status badge based on value text
function badgeStyle(value: string): React.CSSProperties {
  const v = value.toLowerCase()
  if (/avail|متاح|ready|for sale/.test(v))
    return { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
  if (/sold|مباع|closed/.test(v))
    return { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }
  if (/reserv|محجوز|hold|pending/.test(v))
    return { background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.25)' }
  if (/off.?plan|upcoming|future/.test(v))
    return { background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)' }
  return { background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.25)' }
}

function buildDefaultConfig(columns: ColumnMeta[]): ViewConfig {
  const categorical = columns.filter(c => c.type === 'categorical')
  const numeric = columns.filter(c => c.type === 'numeric')
  const year = columns.filter(c => c.type === 'year')
  return {
    titleColumn: categorical[0]?.key ?? columns[0]?.key ?? '',
    subtitleColumn: categorical[1]?.key ?? '',
    badgeColumn: categorical[2]?.key ?? '',
    cardColumns: [
      ...categorical.slice(0, 3).map(c => c.key),
      ...numeric.slice(0, 4).map(c => c.key),
      ...year.slice(0, 1).map(c => c.key),
    ],
    filterColumns: [...new Set([
      ...categorical.map(c => c.key),
      ...year.map(c => c.key),
      ...numeric.slice(0, 3).map(c => c.key),
    ])],
    sortColumn: numeric[0]?.key ?? '',
    sortDir: 'asc',
  }
}

function loadConfig(userId: string, columns: ColumnMeta[]): ViewConfig {
  try {
    const raw = localStorage.getItem(`pv_config_${userId}`)
    if (raw) return JSON.parse(raw) as ViewConfig
  } catch { /* ignore */ }
  return buildDefaultConfig(columns)
}

function saveConfig(userId: string, config: ViewConfig) {
  try {
    localStorage.setItem(`pv_config_${userId}`, JSON.stringify(config))
  } catch { /* ignore */ }
}

function emptyFilters(columns: ColumnMeta[], filterColumns: string[]): FilterState {
  return Object.fromEntries(
    columns
      .filter(c => c.type !== 'text' && filterColumns.includes(c.key))
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

// ── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  columns,
  config,
  onSave,
  onClose,
}: {
  columns: ColumnMeta[]
  config: ViewConfig
  onSave: (c: ViewConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ViewConfig>({ ...config })
  const allKeys = columns.map(c => c.key)
  const filterableKeys = columns.filter(c => c.type !== 'text').map(c => c.key)
  const numericKeys = columns.filter(c => c.type === 'numeric').map(c => c.key)

  function toggleCard(key: string) {
    setDraft(d => ({
      ...d,
      cardColumns: d.cardColumns.includes(key)
        ? d.cardColumns.filter(k => k !== key)
        : [...d.cardColumns, key],
    }))
  }

  function toggleFilter(key: string) {
    setDraft(d => ({
      ...d,
      filterColumns: d.filterColumns.includes(key)
        ? d.filterColumns.filter(k => k !== key)
        : [...d.filterColumns, key],
    }))
  }

  const inputStyle = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid rgba(215,255,0,0.2)',
    color: '#fff',
    padding: '7px 10px',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Montserrat', sans-serif",
  }

  const sectionHeadStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#d7ff00',
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid rgba(215,255,0,0.15)',
    fontFamily: "'Space Grotesk', sans-serif",
  }

  const colLabel = (key: string) => columns.find(c => c.key === key)?.label ?? key

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          maxWidth: '95vw',
          height: '100vh',
          overflowY: 'auto',
          background: '#0f0f0f',
          borderLeft: '1px solid rgba(215,255,0,0.2)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
            Configure View
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Section 1: Card Header */}
        <div>
          <p style={sectionHeadStyle}>Card Header</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                Main Title (top of card)
              </label>
              <select
                style={inputStyle}
                value={draft.titleColumn}
                onChange={e => setDraft(d => ({ ...d, titleColumn: e.target.value }))}
              >
                <option value="">— None —</option>
                {allKeys.map(k => <option key={k} value={k}>{colLabel(k)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                Location / Context (small pill above title)
              </label>
              <select
                style={inputStyle}
                value={draft.subtitleColumn}
                onChange={e => setDraft(d => ({ ...d, subtitleColumn: e.target.value }))}
              >
                <option value="">— None —</option>
                {allKeys.map(k => <option key={k} value={k}>{colLabel(k)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                Status Badge (small tag, top-right)
              </label>
              <select
                style={inputStyle}
                value={draft.badgeColumn}
                onChange={e => setDraft(d => ({ ...d, badgeColumn: e.target.value }))}
              >
                <option value="">— None —</option>
                {allKeys.map(k => <option key={k} value={k}>{colLabel(k)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Card Specs */}
        <div>
          <p style={sectionHeadStyle}>Columns shown on card</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {columns.map(col => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '5px 0' }}>
                <input
                  type="checkbox"
                  checked={draft.cardColumns.includes(col.key)}
                  onChange={() => toggleCard(col.key)}
                  style={{ accentColor: '#d7ff00', width: 15, height: 15, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>{col.label}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {col.type}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Section 3: Filter Sidebar */}
        <div>
          <p style={sectionHeadStyle}>Filter sidebar columns</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filterableKeys.map(key => {
              const col = columns.find(c => c.key === key)!
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '5px 0' }}>
                  <input
                    type="checkbox"
                    checked={draft.filterColumns.includes(key)}
                    onChange={() => toggleFilter(key)}
                    style={{ accentColor: '#d7ff00', width: 15, height: 15, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>{col.label}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {col.type}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Section 4: Default Sort */}
        <div>
          <p style={sectionHeadStyle}>Default Sort</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              style={{ ...inputStyle, flex: 2 }}
              value={draft.sortColumn}
              onChange={e => setDraft(d => ({ ...d, sortColumn: e.target.value }))}
            >
              <option value="">— No sort —</option>
              {numericKeys.map(k => <option key={k} value={k}>{colLabel(k)}</option>)}
            </select>
            <select
              style={{ ...inputStyle, flex: 1 }}
              value={draft.sortDir}
              onChange={e => setDraft(d => ({ ...d, sortDir: e.target.value as 'asc' | 'desc' }))}
            >
              <option value="asc">↑ Low → High</option>
              <option value="desc">↓ High → Low</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          <button
            onClick={() => { onSave(draft); onClose() }}
            style={{
              flex: 1, background: '#d7ff00', color: '#000', border: 'none',
              borderRadius: 10, padding: '10px 0', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Save & Apply
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '10px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PropertyViewerClient({ userId, companyId }: {
  userId: string
  companyId: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<'loading' | 'empty' | 'loaded'>('loading')
  const [sheets, setSheets] = useState<SheetRecord[]>([])
  const [columns, setColumns] = useState<ColumnMeta[]>([])
  const [rows, setRows] = useState<RawRow[]>([])
  const [config, setConfig] = useState<ViewConfig | null>(null)
  const [filters, setFilters] = useState<FilterState>({})
  const [sort, setSort] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyConfig(cfg: ViewConfig, cols: ColumnMeta[]) {
    setConfig(cfg)
    setFilters(emptyFilters(cols, cfg.filterColumns))
    setSort(cfg.sortColumn ? `${cfg.sortColumn}-${cfg.sortDir}` : '')
    setPage(1)
  }

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
      const cfg = loadConfig(userId, merged)

      setSheets(typedSheets)
      setColumns(merged)
      setRows(allRows)
      applyConfig(cfg, merged)
      setPhase('loaded')
    }
    load()
  }, [supabase, userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedIdx(null); setShowConfig(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function handleSaveConfig(newConfig: ViewConfig) {
    saveConfig(userId, newConfig)
    applyConfig(newConfig, columns)
  }

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
            .insert({ user_id: userId, company_id: companyId, file_name: displayName, row_count: sheetRows.length, columns: colMeta })
            .select('id, file_name, row_count, columns, uploaded_at')
            .single()

          if (sheetErr || !sheetRecord) { setUploadError('Failed to save sheet.'); continue }

          const CHUNK = 500
          for (let i = 0; i < sheetRows.length; i += CHUNK) {
            const chunk = sheetRows.slice(i, i + CHUNK).map(r => ({ sheet_id: sheetRecord.id, user_id: userId, company_id: companyId, data: r }))
            await supabase.from('property_rows').insert(chunk)
          }

          const newSheet = sheetRecord as SheetRecord
          setSheets(prev => {
            const next = [...prev, newSheet]
            const merged = mergeColumnMeta(next.map(s => s.columns as ColumnMeta[]))
            const cfg = loadConfig(userId, merged)
            setColumns(merged)
            applyConfig(cfg, merged)
            return next
          })
          setRows(prev => [...prev, ...sheetRows])
        }
      }
      setPhase('loaded')
    } catch (err) {
      console.error(err)
      setUploadError('Failed to parse file. Make sure it is a valid .xlsx file.')
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
      setRows([]); setColumns([]); setConfig(null); setFilters({}); setPhase('empty')
      return
    }
    const { data: propRows } = await supabase.from('property_rows').select('data').order('id', { ascending: true })
    const allRows = (propRows ?? []).map((r: { data: RawRow }) => r.data)
    const merged = mergeColumnMeta(nextSheets.map(s => s.columns as ColumnMeta[]))
    const cfg = loadConfig(userId, merged)
    setRows(allRows); setColumns(merged); applyConfig(cfg, merged)
  }

  // Derived data
  const activeFilterCols = useMemo(
    () => columns.filter(c => c.type !== 'text' && (config?.filterColumns ?? []).includes(c.key)),
    [columns, config]
  )

  const filtered = useMemo(() => filterRows(rows, filters, activeFilterCols), [rows, filters, activeFilterCols])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const dashIdx = sort.lastIndexOf('-')
    const key = sort.slice(0, dashIdx)
    const dir = sort.slice(dashIdx + 1)
    return [...filtered].sort((a, b) => {
      const av = parseFloat(String(a[key] ?? '').replace(/,/g, '')) || 0
      const bv = parseFloat(String(b[key] ?? '').replace(/,/g, '')) || 0
      return dir === 'asc' ? av - bv : bv - av
    })
  }, [filtered, sort])

  // Search applied after sort — narrows displayed results
  const afterSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !config) return sorted
    return sorted.filter(row =>
      [config.titleColumn, config.subtitleColumn, config.badgeColumn]
        .filter(Boolean)
        .some(k => String(row[k] ?? '').toLowerCase().includes(q))
    )
  }, [sorted, search, config])

  const totalPages = Math.ceil(afterSearch.length / PAGE_SIZE)
  const showStart = afterSearch.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const showEnd = Math.min(page * PAGE_SIZE, afterSearch.length)
  const pageItems = afterSearch.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handlePage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)))
    setSelectedIdx(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [totalPages])

  const numericCols = useMemo(() => columns.filter(c => c.type === 'numeric'), [columns])
  const numericSortOptions = useMemo(() =>
    numericCols.flatMap(c => [
      { value: `${c.key}-asc`, label: `${c.label} ↑` },
      { value: `${c.key}-desc`, label: `${c.label} ↓` },
    ]), [numericCols])

  // Pick the most meaningful numeric column for KPI display
  // Prefer columns whose label matches common property field keywords
  const kpiCol = useMemo(() => {
    if (numericCols.length === 0) return null
    const preferred = numericCols.find(c =>
      /price|value|area|size|sqm|sq\.?ft|m²|bedroom|bed|unit/i.test(c.label)
    )
    return preferred ?? numericCols[0]
  }, [numericCols])

  const kpiMin = useMemo(() => {
    if (!kpiCol) return null
    const vals = filtered
      .map(r => parseFloat(String(r[kpiCol.key] ?? '').replace(/,/g, '')))
      .filter(n => !isNaN(n) && isFinite(n))
    return vals.length ? Math.min(...vals) : null
  }, [kpiCol, filtered])

  const kpiMax = useMemo(() => {
    if (!kpiCol) return null
    const vals = filtered
      .map(r => parseFloat(String(r[kpiCol.key] ?? '').replace(/,/g, '')))
      .filter(n => !isNaN(n) && isFinite(n))
    return vals.length ? Math.max(...vals) : null
  }, [kpiCol, filtered])

  const selectedProperty = selectedIdx !== null ? afterSearch[selectedIdx] : null

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

  // ── EMPTY ──
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
            borderRadius: 20, padding: '72px 80px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            background: isDragging ? 'rgba(215,255,0,0.04)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s', maxWidth: 520, width: '100%',
          }}>
            <div style={{ fontSize: 60 }}>{uploading ? '⏳' : '📊'}</div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", margin: 0, textAlign: 'center' }}>
              {uploading ? 'Processing…' : 'Your Property Database'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontFamily: "'Montserrat', sans-serif", margin: 0, textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {uploading
                ? 'Parsing and uploading rows…'
                : 'Drag & drop an Excel file here to get started.\nFilters and card layout are fully configurable\nafter upload.'}
            </p>
            {!uploading && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginTop: 8, background: '#d7ff00', color: '#000', border: 'none', borderRadius: 10, padding: '10px 32px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.03em', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c8f000' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d7ff00' }}
                >
                  Browse Files
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              </>
            )}
            {uploadError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0, textAlign: 'center' }}>{uploadError}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── LOADED ──
  const cfg = config!
  const colByKey = Object.fromEntries(columns.map(c => [c.key, c]))

  // Card spec columns: cardColumns excluding title/subtitle/badge
  const specCols = cfg.cardColumns
    .filter(k => k !== cfg.titleColumn && k !== cfg.subtitleColumn && k !== cfg.badgeColumn)
    .map(k => colByKey[k])
    .filter(Boolean)

  // Separate the most price-like numeric column to render prominently (yellow, large)
  const priceSpecCol = specCols.find(c =>
    c.type === 'numeric' && /price|value|cost|total|amount/i.test(c.label)
  ) ?? specCols.find(c => c.type === 'numeric') ?? null
  const nonPriceSpecCols = specCols.filter(c => c !== priceSpecCol)

  const hasActiveFilters = activeFilterCols.some(col => {
    const f = filters[col.key]
    return f ? (Array.isArray(f) ? f.length > 0 : f.min !== '' || f.max !== '') : false
  })

  return (
    <div className="ph-root" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}>
      {/* Sheet manager bar */}
      <div style={{ background: 'rgba(215,255,0,0.04)', borderBottom: '1px solid rgba(215,255,0,0.12)', padding: '8px 16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>Sheets:</span>
        {sheets.map(sheet => (
          <span key={sheet.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(215,255,0,0.1)', color: '#d7ff00', border: '1px solid rgba(215,255,0,0.25)', borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 12, fontFamily: "'Montserrat', sans-serif" }}>
            {sheet.file_name}
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>({sheet.row_count.toLocaleString()} rows)</span>
            <button onClick={() => deleteSheet(sheet.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 15, marginLeft: 2 }} title="Remove">×</button>
          </span>
        ))}
        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: '1px dashed rgba(215,255,0,0.3)', color: 'rgba(215,255,0,0.7)', borderRadius: 20, padding: '3px 12px', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
          + Add more data
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

        {/* Configure button */}
        <button
          onClick={() => setShowConfig(true)}
          style={{ marginLeft: 'auto', background: 'rgba(215,255,0,0.1)', border: '1px solid rgba(215,255,0,0.3)', color: '#d7ff00', borderRadius: 8, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ⚙ Configure View
        </button>

        {uploading && <span style={{ color: 'rgba(215,255,0,0.6)', fontSize: 12 }}>Uploading…</span>}
        {uploadError && <span style={{ color: '#ef4444', fontSize: 12 }}>{uploadError}</span>}
      </div>

      <div className="ph-layout">
        {/* ── SIDEBAR ── */}
        <aside className="ph-sidebar">
          {/* Search box — always shown at top */}
          <div style={{ gridColumn: '1 / -1', marginBottom: 4 }}>
            <div className="ph-search-wrap">
              <svg className="ph-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="ph-input ph-combo-input"
                placeholder="Search properties…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setPage(1) }}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                >✕</button>
              )}
            </div>
          </div>

          {activeFilterCols.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '20px 0', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Montserrat', sans-serif", margin: 0 }}>No filters selected.</p>
              <button onClick={() => setShowConfig(true)} style={{ marginTop: 10, background: 'none', border: 'none', color: 'rgba(215,255,0,0.6)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Montserrat', sans-serif" }}>
                Configure View →
              </button>
            </div>
          ) : (
            <>
              {activeFilterCols.map(col => {
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
                          <input type="number" className="ph-input" placeholder={col.min != null ? String(Math.floor(col.min)) : '0'} value={currentVal.min}
                            onChange={e => { setFilters(f => ({ ...f, [col.key]: { ...(f[col.key] as NumericFilter), min: e.target.value } })); setPage(1) }} />
                        </div>
                        <div>
                          <label className="ph-filter-label">Max</label>
                          <input type="number" className="ph-input" placeholder={col.max != null ? String(Math.ceil(col.max)) : ''} value={currentVal.max}
                            onChange={e => { setFilters(f => ({ ...f, [col.key]: { ...(f[col.key] as NumericFilter), max: e.target.value } })); setPage(1) }} />
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              })}
              <button className="ph-btn-reset" style={{ gridColumn: '1 / -1' }} onClick={() => { setFilters(emptyFilters(columns, cfg.filterColumns)); setPage(1) }}>
                ↺ Reset All Filters
              </button>
            </>
          )}
        </aside>

        {/* ── MAIN ── */}
        <main className="ph-main">
          {/* KPIs */}
          <div className="ph-kpi-row">
            {/* Total in dataset */}
            <div className="ph-kpi ph-kpi-energy">
              <div className="ph-kpi-icon">🏢</div>
              <div className="ph-kpi-val">{rows.length.toLocaleString()}</div>
              <div className="ph-kpi-lbl">Total Properties</div>
            </div>

            {/* Matching current filters */}
            <div className="ph-kpi ph-kpi-gold">
              <div className="ph-kpi-icon">✓</div>
              <div className="ph-kpi-val" style={{ color: hasActiveFilters || search ? '#d7ff00' : 'rgba(255,255,255,0.5)' }}>
                {afterSearch.length.toLocaleString()}
              </div>
              <div className="ph-kpi-lbl">{hasActiveFilters || search ? 'Matching' : 'Showing'}</div>
            </div>

            {/* Key numeric range — only if column exists and has variance */}
            {kpiCol && kpiMin !== null && kpiMax !== null && kpiMin !== kpiMax && (
              <div className="ph-kpi ph-kpi-gold">
                <div className="ph-kpi-icon">📐</div>
                <div className="ph-kpi-val">{fmt(kpiMin)}</div>
                <div className="ph-kpi-lbl">From · {kpiCol.label}</div>
              </div>
            )}
            {kpiCol && kpiMin !== null && kpiMax !== null && kpiMin !== kpiMax && (
              <div className="ph-kpi ph-kpi-gold">
                <div className="ph-kpi-icon">📐</div>
                <div className="ph-kpi-val">{fmt(kpiMax)}</div>
                <div className="ph-kpi-lbl">Up to · {kpiCol.label}</div>
              </div>
            )}
          </div>

          {/* Results header */}
          <div className="ph-results-header">
            <div className="ph-results-count">
              Showing <span>{afterSearch.length > 0 ? `${showStart}–${showEnd}` : '0'}</span> of <span>{afterSearch.length.toLocaleString()}</span> properties
            </div>
            <div className="ph-view-controls">
              {numericSortOptions.length > 0 && (
                <select className="ph-sort-select" value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}>
                  {numericSortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              <button className={`ph-view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
              <button className={`ph-view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
            </div>
          </div>

          {/* Results */}
          {afterSearch.length === 0 ? (
            <div className="ph-empty">
              <div className="ph-empty-icon">🔍</div>
              <h3>No properties found</h3>
              <p>{search ? `No results for "${search}"` : 'Try adjusting your filters'}</p>
              {(hasActiveFilters || search) && (
                <button
                  className="ph-btn-reset"
                  style={{ marginTop: 16, display: 'inline-block', width: 'auto', padding: '7px 20px' }}
                  onClick={() => { setFilters(emptyFilters(columns, cfg.filterColumns)); setSearch(''); setPage(1) }}
                >
                  ↺ Clear all filters
                </button>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="ph-grid-view">
              {pageItems.map((row, i) => {
                const idx = (page - 1) * PAGE_SIZE + i
                const titleVal = cfg.titleColumn ? String(row[cfg.titleColumn] ?? '') : ''
                const subtitleVal = cfg.subtitleColumn ? String(row[cfg.subtitleColumn] ?? '') : ''
                const badgeVal = cfg.badgeColumn ? String(row[cfg.badgeColumn] ?? '') : ''
                const showBadge = badgeVal && badgeVal !== '—'
                return (
                  <div key={idx} className="ph-property-card" onClick={() => setSelectedIdx(idx)}>
                    <div className="ph-card-top">
                      {showBadge && (
                        <div className="ph-type-badge" style={badgeStyle(badgeVal)}>{badgeVal}</div>
                      )}
                      {subtitleVal && subtitleVal !== '—' && (
                        <div className="ph-city-badge">{subtitleVal}</div>
                      )}
                      {titleVal && titleVal !== '—' && (
                        <div className="ph-card-project">{titleVal}</div>
                      )}
                    </div>
                    <div className="ph-card-body">
                      <div className="ph-card-specs">
                        {nonPriceSpecCols.slice(0, 4).map(col => {
                          const val = row[col.key]
                          if (val == null || val === '') return null
                          return (
                            <div key={col.key} className="ph-spec">
                              <strong>{col.type === 'numeric' ? fmt(val) : String(val)}</strong>
                              <span>{col.label}</span>
                            </div>
                          )
                        })}
                      </div>
                      {priceSpecCol && (() => {
                        const pv = row[priceSpecCol.key]
                        if (pv == null || pv === '') return null
                        return (
                          <>
                            <div className="ph-card-price">{fmt(pv)}</div>
                            <div className="ph-card-price-sub">{priceSpecCol.label}</div>
                          </>
                        )
                      })()}
                    </div>
                    <div className="ph-card-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cfg.cardColumns
                        .filter(k => !nonPriceSpecCols.find(c => c.key === k) && k !== priceSpecCol?.key && k !== cfg.titleColumn && k !== cfg.subtitleColumn && k !== cfg.badgeColumn)
                        .slice(0, 2)
                        .map(k => {
                          const col = colByKey[k]
                          const val = row[k]
                          if (!col || val == null || val === '' || String(val) === '—') return null
                          return (
                            <span key={k} className="ph-delivery-info">
                              <span style={{ opacity: 0.5, fontSize: 10 }}>{col.label}: </span>
                              <span>{String(val)}</span>
                            </span>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // List view
            (() => {
              const listCols = cfg.cardColumns.map(k => colByKey[k]).filter(Boolean).slice(0, 7)
              return (
                <div className="ph-list-view">
                  <div className="ph-list-row" style={{ cursor: 'default', opacity: 0.45, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '8px 16px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    {listCols.map(col => <div key={col.key} style={{ flex: 1, minWidth: 80 }}>{col.label.toUpperCase()}</div>)}
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
                </div>
              )
            })()
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
                  btns.push(<button key={ii} className={`ph-page-btn${ii === page ? ' active' : ''}`} onClick={() => handlePage(ii)}>{ii}</button>)
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

        {/* ── DETAIL MODAL ── */}
        {selectedIdx !== null && selectedProperty && (
          <div className="ph-modal-overlay" onClick={() => setSelectedIdx(null)}>
            <div className="ph-modal" onClick={e => e.stopPropagation()}>
              <button className="ph-modal-close" onClick={() => setSelectedIdx(null)}>✕</button>
              <div className="ph-modal-header">
                <div>
                  {cfg.subtitleColumn && (() => {
                    const sv = String(selectedProperty[cfg.subtitleColumn] ?? '')
                    if (!sv || sv === '—') return null
                    return (
                      <div style={{ fontSize: 11, color: '#d7ff00', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {sv}
                      </div>
                    )
                  })()}
                  {cfg.titleColumn && (
                    <div className="ph-modal-title">{String(selectedProperty[cfg.titleColumn] ?? '—')}</div>
                  )}
                  {cfg.badgeColumn && (() => {
                    const bv = String(selectedProperty[cfg.badgeColumn] ?? '')
                    if (!bv || bv === '—') return null
                    return (
                      <span
                        style={{
                          ...badgeStyle(bv),
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 20,
                          marginTop: 8,
                          fontFamily: "'Space Grotesk', sans-serif",
                          textTransform: 'capitalize',
                        }}
                      >{bv}</span>
                    )
                  })()}
                </div>
              </div>
              <div className="ph-modal-body">
                {priceSpecCol && (() => {
                  const pv = selectedProperty[priceSpecCol.key]
                  if (pv == null || pv === '') return null
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div className="ph-modal-price-big">{fmtFull(pv)}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>{priceSpecCol.label}</div>
                    </div>
                  )
                })()}
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

      {/* ── CONFIG PANEL ── */}
      {showConfig && (
        <ConfigPanel
          columns={columns}
          config={cfg}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
