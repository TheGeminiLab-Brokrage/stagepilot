'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import MultiCombobox from '@/app/dashboard/components/MultiCombobox'
import { parseExcelFile, type RawRow } from '@/lib/excel-parser'
import { analyzeColumns, mergeColumnMeta, type ColumnMeta } from '@/lib/column-analyzer'
import { fmt, fmtFull } from '@/lib/property-utils'
import { generateViewerMessage, colEmoji } from '@/lib/property-message'
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
  msgPriceCol?: string
  msgAreaCol?: string
  msgPlansCol?: string
}

type NumericFilter = { min: string; max: string }
type FilterValue = string[] | NumericFilter
type FilterState = Record<string, FilterValue>

function plansColKey(columns: ColumnMeta[], cfg: ViewConfig | null): string | undefined {
  return cfg?.msgPlansCol ?? columns.find(c => /plan|payment|خطة|دفع/i.test(c.key + ' ' + c.label))?.key
}

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
  const filterableKeys = columns.filter(c => c.type !== 'text').map(c => c.key)
  const numericKeys = columns.filter(c => c.type === 'numeric').map(c => c.key)

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
            ⚙️ Configure View
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Section 1: Card Header */}
        <div>
          <p style={sectionHeadStyle}>🃏 Card Header</p>
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
                {columns.map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
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
                {columns.map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
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
                {columns.map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Filter Sidebar */}
        <div>
          <p style={sectionHeadStyle}>🔧 Filter Sidebar Columns</p>
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

        {/* Section 3: Default Sort */}
        <div>
          <p style={sectionHeadStyle}>🔃 Default Sort</p>
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

        {/* Section 4: Message Template */}
        <div>
          <p style={sectionHeadStyle}>💬 Message Template</p>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif", lineHeight: 1.5 }}>
            Help the message generator identify key columns. Auto-detected if left blank.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                💰 Price Column
              </label>
              <select
                style={inputStyle}
                value={draft.msgPriceCol ?? ''}
                onChange={e => setDraft(d => ({ ...d, msgPriceCol: e.target.value || undefined }))}
              >
                <option value="">— Auto-detect —</option>
                {columns.filter(c => c.type === 'numeric').map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                📐 Area Column
              </label>
              <select
                style={inputStyle}
                value={draft.msgAreaCol ?? ''}
                onChange={e => setDraft(d => ({ ...d, msgAreaCol: e.target.value || undefined }))}
              >
                <option value="">— Auto-detect —</option>
                {columns.filter(c => c.type === 'numeric').map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 4, fontFamily: "'Montserrat', sans-serif" }}>
                ✅ Payment Plans Column
              </label>
              <select
                style={inputStyle}
                value={draft.msgPlansCol ?? ''}
                onChange={e => setDraft(d => ({ ...d, msgPlansCol: e.target.value || undefined }))}
              >
                <option value="">— Auto-detect —</option>
                {columns.map(c => <option key={c.key} value={c.key}>{colLabel(c.key)}</option>)}
              </select>
            </div>
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
  const [rowSheetIds, setRowSheetIds] = useState<string[]>([])
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set())
  const [tabsBySheetId, setTabsBySheetId] = useState<Record<string, string[]>>({})
  const [selectedTabsBySheetId, setSelectedTabsBySheetId] = useState<Record<string, Set<string>>>({})
  const [openTabDropdownId, setOpenTabDropdownId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [config, setConfig] = useState<ViewConfig | null>(null)
  const [filters, setFilters] = useState<FilterState>({})
  const [sort, setSort] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [modalFields, setModalFields] = useState<string[]>([])
  const [modalPlans, setModalPlans] = useState<string[]>([])
  const [copiedModal, setCopiedModal] = useState(false)
  const [previewLines, setPreviewLines] = useState<string[] | null>(null)
  const [previewCopied, setPreviewCopied] = useState(false)
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
        .select('sheet_id, data')
        .order('id', { ascending: true })

      const typedSheets = sheetRows as SheetRecord[]
      const merged = mergeColumnMeta(typedSheets.map(s => s.columns as ColumnMeta[]))
      const allRows = (propRows ?? []).map((r: { sheet_id: string; data: RawRow }) => r.data)
      const allSheetIds = (propRows ?? []).map((r: { sheet_id: string; data: RawRow }) => r.sheet_id)
      const cfg = loadConfig(userId, merged)

      const tabsMap: Record<string, string[]> = {}
      ;(propRows ?? []).forEach((r: { sheet_id: string; data: RawRow }) => {
        const tab = r.data?.__tab
        if (tab && typeof tab === 'string') {
          if (!tabsMap[r.sheet_id]) tabsMap[r.sheet_id] = []
          if (!tabsMap[r.sheet_id].includes(tab)) tabsMap[r.sheet_id].push(tab)
        }
      })

      setSheets(typedSheets)
      setColumns(merged)
      setRows(allRows)
      setRowSheetIds(allSheetIds)
      setTabsBySheetId(tabsMap)
      applyConfig(cfg, merged)
      setPhase('loaded')
    }
    load()
  }, [supabase, userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedIdx(null); setShowConfig(false); setOpenTabDropdownId(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!openTabDropdownId) return
    function handleClick(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-tab-dropdown]')) {
        setOpenTabDropdownId(null)
        setDropdownPos(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openTabDropdownId])

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
        // Merge all worksheet tabs into one combined record per file
        const allHeaders = Array.from(new Set(parsed.flatMap(s => s.headers)))
        const hasMultipleTabs = parsed.length > 1
        const allRows = parsed.flatMap(s =>
          hasMultipleTabs ? s.rows.map(r => ({ ...r, __tab: s.sheetName })) : s.rows
        )
        if (allRows.length === 0) {
          setUploadError(`"${file.name}" has no readable rows. Make sure headers are in the first row of the sheet.`)
          continue
        }
        const colMeta = analyzeColumns(allRows, allHeaders)

        const { data: sheetRecord, error: sheetErr } = await supabase
          .from('property_sheets')
          .insert({ user_id: userId, company_id: companyId, file_name: file.name, row_count: allRows.length, columns: colMeta })
          .select('id, file_name, row_count, columns, uploaded_at')
          .single()

        if (sheetErr || !sheetRecord) { setUploadError('Failed to save sheet.'); continue }

        const CHUNK = 500
        for (let i = 0; i < allRows.length; i += CHUNK) {
          const chunk = allRows.slice(i, i + CHUNK).map(r => ({ sheet_id: sheetRecord.id, user_id: userId, company_id: companyId, data: r }))
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
        setRows(prev => [...prev, ...allRows])
        setRowSheetIds(prev => [...prev, ...Array(allRows.length).fill(sheetRecord.id)])
        if (hasMultipleTabs) {
          setTabsBySheetId(prev => ({ ...prev, [sheetRecord.id]: parsed.map(s => s.sheetName) }))
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

  function handleDirectCopy(e: ReactMouseEvent, row: RawRow, idx: number) {
    e.stopPropagation()
    if (!config) return
    const pk = plansColKey(columns, config)
    const allKeys = columns
      .filter(c => c.key !== pk)
      .filter(c => { const v = row[c.key]; return v != null && v !== '' && String(v) !== '—' })
      .map(c => c.key)
    const selectedKeys = [...allKeys, ...(pk && row[pk] ? [pk] : [])]
    const msg = generateViewerMessage(row, columns, config, selectedKeys)
    setPreviewLines(msg.split('\n'))
    setPreviewCopied(false)
  }

  // Initialise modal field/plan selection whenever a new card is opened
  useEffect(() => {
    if (selectedIdx === null) { setModalFields([]); setModalPlans([]); setCopiedModal(false); return }
    const row = afterSearch[selectedIdx]
    if (!row) return
    const pk = plansColKey(columns, config)
    const allNonEmpty = columns
      .filter(col => col.key !== pk)
      .filter(col => { const v = row[col.key]; return v != null && v !== '' && String(v) !== '—' })
      .map(col => col.key)
    setModalFields(allNonEmpty)
    const plansStr = pk ? String(row[pk] ?? '') : ''
    setModalPlans(plansStr.split('|').map(s => s.trim()).filter(Boolean))
    setCopiedModal(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx])

  function handleCopyModal() {
    if (selectedIdx === null || !config) return
    const row = afterSearch[selectedIdx]
    if (!row) return
    const pk = plansColKey(columns, config)
    const selectedKeys = [
      ...modalFields,
      ...(pk && modalPlans.length > 0 ? [pk] : []),
    ]
    const msg = generateViewerMessage(row, columns, config, selectedKeys)
    setPreviewLines(msg.split('\n'))
    setPreviewCopied(false)
  }

  function toggleSheet(sheetId: string) {
    setSelectedSheetIds(prev => {
      const next = new Set(prev)
      if (next.has(sheetId)) next.delete(sheetId); else next.add(sheetId)
      return next
    })
    setPage(1)
  }

  function toggleTab(sheetId: string, tabName: string) {
    setSelectedTabsBySheetId(prev => {
      const current = new Set(prev[sheetId] ?? [])
      if (current.has(tabName)) current.delete(tabName); else current.add(tabName)
      return { ...prev, [sheetId]: current }
    })
    setPage(1)
  }

  async function deleteSheet(sheetId: string) {
    await supabase.from('property_sheets').delete().eq('id', sheetId)
    const nextSheets = sheets.filter(s => s.id !== sheetId)
    setSheets(nextSheets)
    setSelectedSheetIds(prev => { const n = new Set(prev); n.delete(sheetId); return n })
    setTabsBySheetId(prev => { const n = { ...prev }; delete n[sheetId]; return n })
    setSelectedTabsBySheetId(prev => { const n = { ...prev }; delete n[sheetId]; return n })
    if (openTabDropdownId === sheetId) { setOpenTabDropdownId(null); setDropdownPos(null) }
    if (nextSheets.length === 0) {
      setRows([]); setRowSheetIds([]); setColumns([]); setConfig(null); setFilters({}); setPhase('empty')
      return
    }
    const { data: propRows } = await supabase.from('property_rows').select('sheet_id, data').order('id', { ascending: true })
    const allRows = (propRows ?? []).map((r: { sheet_id: string; data: RawRow }) => r.data)
    const allSheetIds = (propRows ?? []).map((r: { sheet_id: string; data: RawRow }) => r.sheet_id)
    const merged = mergeColumnMeta(nextSheets.map(s => s.columns as ColumnMeta[]))
    const cfg = loadConfig(userId, merged)
    setRows(allRows); setRowSheetIds(allSheetIds); setColumns(merged); applyConfig(cfg, merged)
  }

  // Derived data
  const activeFilterCols = useMemo(
    () => columns.filter(c => c.type !== 'text' && (config?.filterColumns ?? []).includes(c.key)),
    [columns, config]
  )

  const visibleRows = useMemo(() => {
    const hasSheetFilter = selectedSheetIds.size > 0
    const hasTabFilter = Object.values(selectedTabsBySheetId).some(s => s.size > 0)
    if (!hasSheetFilter && !hasTabFilter) return rows
    return rows.filter((row, i) => {
      const sheetId = rowSheetIds[i]
      const selectedTabs = selectedTabsBySheetId[sheetId]
      // Tab filter takes precedence: if specific tabs are checked for this file, apply them
      if (selectedTabs && selectedTabs.size > 0) {
        const tab = row.__tab as string | undefined
        return tab ? selectedTabs.has(tab) : true
      }
      // Otherwise fall back to whole-file toggle
      return selectedSheetIds.has(sheetId)
    })
  }, [rows, rowSheetIds, selectedSheetIds, selectedTabsBySheetId])

  const filtered = useMemo(() => filterRows(visibleRows, filters, activeFilterCols), [visibleRows, filters, activeFilterCols])

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
            border: `2px dashed ${isDragging ? '#d7ff00' : 'rgba(215,255,0,0.25)'}`,
            borderRadius: 20, padding: '64px 80px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            background: isDragging ? 'rgba(215,255,0,0.04)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.2s', maxWidth: 520, width: '100%',
          }}>
            {uploading ? (
              <div className="ph-spinner" style={{ marginBottom: 4 }} />
            ) : (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(215,255,0,0.5)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            )}
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

  // All columns except the header slots — shown automatically based on data
  const specCols = columns
    .filter(c => c.key !== cfg.titleColumn && c.key !== cfg.subtitleColumn && c.key !== cfg.badgeColumn)

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
      {/* Toolbar bar */}
      <div style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 20, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'rgba(215,255,0,0.35)'; b.style.color = 'rgba(215,255,0,0.8)' }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'rgba(255,255,255,0.12)'; b.style.color = 'rgba(255,255,255,0.5)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          📂 Add Sheet
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

        <button
          onClick={() => setShowConfig(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid rgba(215,255,0,0.25)', color: 'rgba(215,255,0,0.8)', borderRadius: 20, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, transition: 'all 0.15s' }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(215,255,0,0.08)'; b.style.borderColor = 'rgba(215,255,0,0.5)' }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'none'; b.style.borderColor = 'rgba(215,255,0,0.25)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>
          </svg>
          ⚙️ Configure View
        </button>

        {sheets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', paddingLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: 4 }}>
            {sheets.map(sheet => {
              const tabs = tabsBySheetId[sheet.id] ?? []
              const isMultiTab = tabs.length > 1
              const selectedTabs = selectedTabsBySheetId[sheet.id]
              const selectedTabCount = selectedTabs?.size ?? 0
              const isToggled = selectedSheetIds.has(sheet.id)
              const isActive = isToggled || selectedTabCount > 0
              const hasAnyFilter = selectedSheetIds.size > 0 || Object.values(selectedTabsBySheetId).some(s => s.size > 0)
              const isDropdownOpen = openTabDropdownId === sheet.id

              return (
                <span
                  key={sheet.id}
                  data-tab-dropdown
                  style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column' }}
                >
                  <span
                    onClick={() => toggleSheet(sheet.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: isActive ? 'rgba(215,255,0,0.06)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isActive ? 'rgba(215,255,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 20, padding: '3px 8px 3px 10px', fontSize: 11,
                      color: isActive ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.6)',
                      whiteSpace: 'nowrap', fontFamily: "'Space Grotesk', sans-serif",
                      cursor: 'pointer', transition: 'all 0.15s',
                      opacity: hasAnyFilter && !isActive ? 0.4 : 1,
                    }}
                  >
                    {sheet.file_name}
                    {isMultiTab && selectedTabCount > 0 && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'rgba(215,255,0,0.15)', color: 'rgba(215,255,0,0.9)', fontWeight: 700 }}>
                        {selectedTabCount}/{tabs.length}
                      </span>
                    )}
                    {isMultiTab && (
                      <button
                        data-tab-dropdown
                        onClick={e => {
                          e.stopPropagation()
                          if (isDropdownOpen) {
                            setOpenTabDropdownId(null)
                            setDropdownPos(null)
                          } else {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                            setDropdownPos({ top: rect.bottom + 6, left: rect.left })
                            setOpenTabDropdownId(sheet.id)
                          }
                        }}
                        title="Filter by sheet tab"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', color: isActive ? 'rgba(215,255,0,0.6)' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.7)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? 'rgba(215,255,0,0.6)' : 'rgba(255,255,255,0.4)' }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteSheet(sheet.id) }}
                      title={`Remove ${sheet.file_name}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'rgba(215,255,0,0.4)' : 'rgba(255,255,255,0.35)', padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isActive ? 'rgba(215,255,0,0.4)' : 'rgba(255,255,255,0.35)' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </span>

                </span>
              )
            })}
          </div>
        )}

        {(uploading || uploadError) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            {uploading && <>
              <div style={{ width: 12, height: 12, border: '2px solid rgba(215,255,0,0.2)', borderTopColor: '#d7ff00', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ color: 'rgba(215,255,0,0.6)' }}>Uploading…</span>
            </>}
            {uploadError && <span style={{ color: '#ef4444' }}>{uploadError}</span>}
          </span>
        )}
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
              <div className="ph-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <div className="ph-kpi-val">{rows.length.toLocaleString()}</div>
              <div className="ph-kpi-lbl">🏠 Total Properties</div>
            </div>

            {/* Matching current filters */}
            <div className="ph-kpi ph-kpi-gold">
              <div className="ph-kpi-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="ph-kpi-val" style={{ color: hasActiveFilters || search ? '#d7ff00' : 'rgba(255,255,255,0.5)' }}>
                {afterSearch.length.toLocaleString()}
              </div>
              <div className="ph-kpi-lbl">{hasActiveFilters || search ? '✅ Matching' : '📋 Showing'}</div>
            </div>

            {/* Key numeric range — only if column exists and has variance */}
            {kpiCol && kpiMin !== null && kpiMax !== null && kpiMin !== kpiMax && (
              <div className="ph-kpi ph-kpi-gold">
                <div className="ph-kpi-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="20" x2="12" y2="4"/><polyline points="6 10 12 4 18 10"/>
                  </svg>
                </div>
                <div className="ph-kpi-val">{fmt(kpiMin)}</div>
                <div className="ph-kpi-lbl">📉 From · {kpiCol.label}</div>
              </div>
            )}
            {kpiCol && kpiMin !== null && kpiMax !== null && kpiMin !== kpiMax && (
              <div className="ph-kpi ph-kpi-gold">
                <div className="ph-kpi-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="4" x2="12" y2="20"/><polyline points="18 14 12 20 6 14"/>
                  </svg>
                </div>
                <div className="ph-kpi-val">{fmt(kpiMax)}</div>
                <div className="ph-kpi-lbl">📈 Up to · {kpiCol.label}</div>
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
              <h3>🏚️ No properties found</h3>
              <p>{search ? `😕 No results for "${search}"` : '🔧 Try adjusting your filters'}</p>
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
                  <div key={idx}>
                    <div className="ph-property-card" onClick={() => setSelectedIdx(idx)} style={{ position: 'relative' }}>
                      <div className="ph-card-top" style={{ background: 'linear-gradient(180deg, rgba(215,255,0,0.04) 0%, transparent 100%)' }}>
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
                            const display = col.type === 'numeric' ? fmt(val) : String(val ?? '')
                            if (!display || display === '—') return null
                            return (
                              <div key={col.key} className="ph-spec">
                                <span className="ph-spec-icon">{colEmoji(col)}</span>
                                <strong>{display}</strong>
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
                      <div className="ph-card-footer">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {columns
                            .filter(c => !nonPriceSpecCols.find(s => s.key === c.key) && c.key !== priceSpecCol?.key && c.key !== cfg.titleColumn && c.key !== cfg.subtitleColumn && c.key !== cfg.badgeColumn)
                            .slice(0, 3)
                            .map(col => {
                              const val = row[col.key]
                              if (val == null || val === '' || String(val) === '—') return null
                              return (
                                <span key={col.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontFamily: "'Montserrat', sans-serif" }}>
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{col.label}</span>
                                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>{String(val)}</span>
                                </span>
                              )
                            })}
                        </div>
                        <button
                          className={`ph-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                          onClick={e => handleDirectCopy(e, row, idx)}
                          title="Copy marketing message"
                        >
                          {copiedIdx === idx ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // List view
            (() => {
              const listCols = columns.slice(0, 7)
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
              {/* Header: subtitle in yellow caps + title + badge on left, close on right */}
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
                      <span style={{ ...badgeStyle(bv), display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginTop: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {bv}
                      </span>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                  <button
                    className={`ph-copy-modal-btn${copiedModal ? ' copied' : ''}`}
                    onClick={handleCopyModal}
                  >
                    {copiedModal ? '✓ Copied!' : '📋 Copy Message'}
                  </button>
                  <button className="ph-modal-close" onClick={() => setSelectedIdx(null)}>×</button>
                </div>
              </div>

              <div className="ph-modal-body">
                {/* Price shown prominently at top */}
                {priceSpecCol && (() => {
                  const pv = selectedProperty[priceSpecCol.key]
                  const pf = fmtFull(pv)
                  if (!pv || pf === '—') return null
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div className="ph-modal-price-big">{pf}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>{priceSpecCol.label}</div>
                    </div>
                  )
                })()}

                {/* Fields grid — all fields get a checkbox */}
                {(() => {
                  const pk = plansColKey(columns, config)
                  const plansFromRow = pk ? String(selectedProperty[pk] ?? '').split('|').map(s => s.trim()).filter(Boolean) : []
                  return (
                    <>
                      <div className="ph-modal-grid">
                        {columns
                          .filter(col => col.key !== priceSpecCol?.key && col.key !== pk)
                          .map(col => {
                            const val = selectedProperty[col.key]
                            const display = col.type === 'numeric' ? fmtFull(val) : String(val ?? '')
                            if (!display || display === '—') return null
                            return (
                              <div key={col.key} className="ph-modal-field ph-modal-field-selectable">
                                <input
                                  type="checkbox"
                                  className="ph-modal-field-check"
                                  checked={modalFields.includes(col.key)}
                                  onChange={() => setModalFields(prev =>
                                    prev.includes(col.key) ? prev.filter(x => x !== col.key) : [...prev, col.key]
                                  )}
                                />
                                <div className="f-label">{col.label}</div>
                                <div className="f-value">{display}</div>
                              </div>
                            )
                          })}
                      </div>
                      {plansFromRow.length > 0 && (
                        <div className="ph-modal-section">
                          <h4>💳 Payment Plans</h4>
                          <div className="ph-modal-plan-check">
                            {plansFromRow.map((p, i) => (
                              <label key={i} className="ph-modal-plan-option">
                                <input
                                  type="checkbox"
                                  checked={modalPlans.includes(p)}
                                  onChange={() => setModalPlans(prev =>
                                    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                  )}
                                />
                                <span>{p}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MESSAGE PREVIEW OVERLAY ── */}
      {previewLines && (
        <div className="msg-preview-overlay" onClick={() => setPreviewLines(null)}>
          <div className="msg-preview-panel" onClick={e => e.stopPropagation()}>
            <div className="msg-preview-header">
              <span>تعديل الرسالة</span>
              <button className="msg-preview-close" onClick={() => setPreviewLines(null)}>×</button>
            </div>
            <div className="msg-preview-lines">
              {previewLines.map((line, i) => (
                <div key={i} className="msg-preview-row">
                  <span
                    className="msg-preview-drag"
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', String(i)) }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const from = parseInt(e.dataTransfer.getData('text/plain'))
                      if (isNaN(from) || from === i) return
                      setPreviewLines(prev => {
                        if (!prev) return prev
                        const next = [...prev]
                        const [moved] = next.splice(from, 1)
                        next.splice(i, 0, moved)
                        return next
                      })
                    }}
                    title="اسحب لإعادة الترتيب"
                  >⠿</span>
                  <input
                    className={`msg-preview-line${line === '' ? ' msg-preview-line-blank' : ''}`}
                    value={line}
                    onChange={e => setPreviewLines(prev => prev!.map((l, j) => j === i ? e.target.value : l))}
                    placeholder="— فاصل —"
                    dir="auto"
                  />
                  <button
                    className="msg-preview-del"
                    onClick={() => setPreviewLines(prev => prev!.filter((_, j) => j !== i))}
                    title="حذف السطر"
                  >×</button>
                </div>
              ))}
              <button
                className="msg-preview-add"
                onClick={() => setPreviewLines(prev => [...(prev ?? []), ''])}
              >+ إضافة سطر</button>
            </div>
            <div className="msg-preview-footer">
              <button
                className={`msg-preview-copy-btn${previewCopied ? ' copied' : ''}`}
                onClick={() => {
                  navigator.clipboard.writeText(previewLines.join('\n')).then(() => {
                    setPreviewCopied(true)
                    setTimeout(() => {
                      setPreviewLines(null)
                      setPreviewCopied(false)
                    }, 900)
                  })
                }}
              >
                {previewCopied ? '✓ تم النسخ' : '📋 نسخ الرسالة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIG PANEL ── */}
      {showConfig && (
        <ConfigPanel
          columns={columns}
          config={cfg}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}

      {/* ── TAB DROPDOWN PORTAL — rendered at body level to escape overflow:auto clipping ── */}
      {openTabDropdownId && dropdownPos && typeof document !== 'undefined' && createPortal(
        <div
          data-tab-dropdown
          style={{
            position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999,
            background: 'rgba(12,12,12,0.98)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '4px 0', minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {(tabsBySheetId[openTabDropdownId] ?? []).map(tab => {
            const checked = selectedTabsBySheetId[openTabDropdownId]?.has(tab) ?? false
            return (
              <label
                key={tab}
                data-tab-dropdown
                onClick={() => toggleTab(openTabDropdownId, tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                  color: checked ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.7)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.background = 'transparent' }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `1px solid ${checked ? 'rgba(215,255,0,0.7)' : 'rgba(255,255,255,0.2)'}`,
                  background: checked ? 'rgba(215,255,0,0.15)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(215,255,0,0.9)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </span>
                {tab}
              </label>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
