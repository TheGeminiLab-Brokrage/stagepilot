'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './property.css'

type Property = {
  city: string
  project: string
  developer: string
  type: string
  code: string
  phase: string
  floor: string | number
  beds: number | string
  area: number | string
  garden: string | number
  roof: string | number
  finish: string
  price: number | string
  discount: number | string
  delivery: string
  delivery_year: string
  maint: number | string
  parking: number | string
  plans: string
  contact: string
  phone: string
  ppsqm: number | string
}

type Filters = {
  search: string
  city: string
  type: string
  finish: string
  beds: string
  priceMin: string
  priceMax: string
  areaMin: string
  areaMax: string
  delivery: string
  discount: string
  extras: string
}

type PriceStep = { label: string; price: number }

const PAGE_SIZE = 24

const R8_PROJECT_NORMS = [
  'diploeast','residenceeight','dejoya1','qamari','madai','layal','hava',
  'ayyam','winterpark','plato','queenland','canyon8','yaru','ramatan','ri8',
  'lumia','skycapital2','dejoya2','thecurve','anakaji','laverdenewcapital',
  'laverdecasette','floria5','theislands','ion','elitepark','roses',
  'thecityoval','menorca','moraya','lagoons','dejoya4','chapters','sagelake',
  'lightcity','upmount','orbis','defaf','lareva','ray','kardia','suli','ravia',
]

function normProject(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isR8Project(project: string): boolean {
  const propNorm = normProject(project)
  if (propNorm.length < 3) return false
  return R8_PROJECT_NORMS.some(r8 => propNorm.includes(r8) || r8.includes(propNorm))
}

const DEFAULT_FILTERS: Filters = {
  search: '', city: '', type: '', finish: '', beds: '',
  priceMin: '', priceMax: '', areaMin: '', areaMax: '',
  delivery: '', discount: '', extras: '',
}

function fmt(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(String(n))
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K'
  return num.toLocaleString()
}

function fmtFull(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(String(n))
  if (isNaN(num)) return '—'
  return num.toLocaleString('en-EG')
}

function finishClass(f: string): string {
  if (!f) return 'ph-finish-other'
  const fl = f.toLowerCase()
  if (fl.includes('fully')) return 'ph-finish-fully'
  if (fl.includes('semi')) return 'ph-finish-semi'
  if (fl.includes('core')) return 'ph-finish-core'
  return 'ph-finish-other'
}

function capitalize(s: string): string {
  if (!s) return ''
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function safeMin(arr: number[]): number {
  return arr.reduce((m, v) => (v < m ? v : m), arr[0])
}

function safeMax(arr: number[]): number {
  return arr.reduce((m, v) => (v > m ? v : m), arr[0])
}

function buildPriceSteps(data: Property[]): PriceStep[] {
  const bedGroups: Record<number, number[]> = {}
  data.forEach(r => {
    const p = parseFloat(String(r.price))
    if (!p || p <= 0) return
    const b = parseInt(String(r.beds)) || 0
    if (!bedGroups[b]) bedGroups[b] = []
    bedGroups[b].push(p)
  })
  const steps: PriceStep[] = []
  const allPrices = data.map(r => parseFloat(String(r.price))).filter(p => p > 0)
  if (allPrices.length) steps.push({ label: 'All Units · Min Price · click ›', price: safeMin(allPrices) })
  Object.keys(bedGroups).map(Number).sort((a, b) => a - b).forEach(b => {
    const minP = safeMin(bedGroups[b])
    const label = b === 0
      ? 'Studio · Min Price · click ›'
      : b >= 5 ? `${b}+ Beds · Min Price · click ›`
      : `${b} Bed${b > 1 ? 's' : ''} · Min Price · click ›`
    steps.push({ label, price: minP })
  })
  const allAreas = data.map(r => parseFloat(String(r.area))).filter(a => a > 0)
  if (allAreas.length) {
    const maxArea = safeMax(allAreas)
    const bigUnit = data.find(r => parseFloat(String(r.area)) === maxArea)
    const bigPrice = bigUnit ? parseFloat(String(bigUnit.price)) : 0
    steps.push({ label: 'Largest Unit · Price · click ›', price: bigPrice })
  }
  return steps
}

const CITY_OPTIONS = [
  { value: '6th of october', label: '6th Of October' },
  { value: 'al maadi', label: 'Al Maadi' },
  { value: 'Alexandria', label: 'Alexandria' },
  { value: 'Badr city', label: 'Badr City' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'Ein elsokhna', label: 'Ein Elsokhna' },
  { value: 'El Mokattam', label: 'El Mokattam' },
  { value: 'el mostakbal city', label: 'El Mostakbal City' },
  { value: 'elobour city', label: 'Elobour City' },
  { value: 'elshourok city', label: 'Elshourok City' },
  { value: 'Heliopolis', label: 'Heliopolis' },
  { value: 'Hurghada', label: 'Hurghada' },
  { value: 'Jirian El Shiekh Zayed', label: 'Jirian El Shiekh Zayed' },
  { value: 'Katameya', label: 'Katameya' },
  { value: 'matrouh', label: 'Matrouh' },
  { value: 'Minya Governorate', label: 'Minya Governorate' },
  { value: 'nasr city', label: 'Nasr City' },
  { value: 'new cairo', label: 'New Cairo' },
  { value: 'new capital', label: 'New Capital' },
  { value: 'new heliopolis', label: 'New Heliopolis' },
  { value: 'new zayed', label: 'New Zayed' },
  { value: 'North coast', label: 'North Coast' },
  { value: 'ras sedr', label: 'Ras Sedr' },
  { value: 'sheikh zayed city', label: 'Sheikh Zayed City' },
  { value: 'sixth settlement', label: 'Sixth Settlement' },
]

const TYPE_OPTIONS = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'beach house', label: 'Beach House' },
  { value: 'beachfront apt', label: 'Beachfront Apt' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'chalet', label: 'Chalet' },
  { value: 'condo', label: 'Condo' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'family house', label: 'Family House' },
  { value: 'garden millennial', label: 'Garden Millennial' },
  { value: 'i villa', label: 'I Villa' },
  { value: 'iv beach house', label: 'Iv Beach House' },
  { value: 'lake house', label: 'Lake House' },
  { value: 'loft', label: 'Loft' },
  { value: 'millennial', label: 'Millennial' },
  { value: 'one story', label: 'One Story' },
  { value: 'palace', label: 'Palace' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 's villa', label: 'S Villa' },
  { value: 'sky scape', label: 'Sky Scape' },
  { value: 'standalone', label: 'Standalone' },
  { value: 'studio', label: 'Studio' },
  { value: 'town house', label: 'Town House' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'townhouse corner', label: 'Townhouse Corner' },
  { value: 'townhouse middle', label: 'Townhouse Middle' },
]

const FINISH_OPTIONS = [
  { value: 'core and shell', label: 'Core And Shell' },
  { value: 'flexi', label: 'Flexi' },
  { value: 'fully finished', label: 'Fully Finished' },
  { value: 'fully finished with ac', label: 'Fully Finished With AC' },
  { value: 'fully finished with ac and kitchen cabinets', label: 'Fully Finished With AC & Kitchen' },
  { value: 'fully finished with kitchen cabinets', label: 'Fully Finished With Kitchen' },
  { value: 'fully furnished', label: 'Fully Furnished' },
  { value: 'fully furnished with ac', label: 'Fully Furnished With AC' },
  { value: 'semi finished', label: 'Semi Finished' },
]

const BEDS_OPTIONS = [
  { value: '1', label: '1 Bedroom' },
  { value: '2', label: '2 Bedrooms' },
  { value: '3', label: '3 Bedrooms' },
  { value: '4', label: '4 Bedrooms' },
  { value: '5', label: '5+ Bedrooms' },
]

const DELIVERY_OPTIONS = [
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
  { value: '2028', label: '2028' },
  { value: '2029', label: '2029' },
  { value: '2030', label: '2030' },
  { value: '2031', label: '2031+' },
]

const DISCOUNT_OPTIONS = [
  { value: '10', label: '10%+' },
  { value: '20', label: '20%+' },
  { value: '30', label: '30%+' },
  { value: '40', label: '40%+' },
]

const EXTRAS_OPTIONS = [
  { value: 'garden', label: 'Has Garden' },
  { value: 'roof', label: 'Has Roof' },
]

function Combobox({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''
  const list = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div className="ph-combo" ref={ref}>
      <input
        className="ph-input ph-combo-input"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
      />
      <span className="ph-combo-arrow">{open ? '▲' : '▼'}</span>
      {open && (
        <ul className="ph-combo-list">
          <li
            className={value === '' ? 'ph-combo-selected' : ''}
            onMouseDown={() => { onChange(''); setOpen(false); setQuery('') }}
          >
            {placeholder}
          </li>
          {list.map(o => (
            <li
              key={o.value}
              className={value === o.value ? 'ph-combo-selected' : ''}
              onMouseDown={() => { onChange(o.value); setOpen(false); setQuery('') }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PropertyDashboardClient() {
  const [rawData, setRawData] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [zone, setZone] = useState<'R' | 'R7' | 'R8'>('R')
  const [sort, setSort] = useState('price-asc')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [priceKpiState, setPriceKpiState] = useState(0)

  useEffect(() => {
    fetch('/property-data.json')
      .then(r => r.json())
      .then((data: Property[]) => { setRawData(data.filter(r => parseFloat(String(r.price)) > 0)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const setFilter = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters(f => ({ ...f, [key]: val }))
    setApplied(f => ({ ...f, [key]: val }))
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((val: string) => {
    setFilter('search', val)
  }, [setFilter])

  const applyFilters = useCallback(() => {
    setApplied(filters)
    setPage(1)
  }, [filters])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    setPage(1)
    setPriceKpiState(0)
  }, [])

  useEffect(() => {
    if (applied.city !== 'new capital') setZone('R')
  }, [applied.city])

  const filtered = useMemo(() => {
    if (!rawData.length) return []
    const f = applied
    const priceMin = parseFloat(f.priceMin) * 1e6 || 0
    const priceMax = parseFloat(f.priceMax) * 1e6 || Infinity
    const areaMin = parseFloat(f.areaMin) || 0
    const areaMax = parseFloat(f.areaMax) || Infinity
    const discountMin = parseFloat(f.discount) || 0
    const search = f.search
    return rawData.filter(r => {
      if (search && r.project !== search) return false
      if (f.city && r.city !== f.city) return false
      if (zone !== 'R' && f.city === 'new capital') {
        const inR8 = isR8Project(r.project)
        if (zone === 'R8' && !inR8) return false
        if (zone === 'R7' && inR8) return false
      }
      if (f.type && r.type !== f.type) return false
      if (f.finish && r.finish !== f.finish) return false
      if (f.beds) {
        const b = parseInt(String(r.beds)) || 0
        if (f.beds === '5' && b < 5) return false
        else if (f.beds !== '5' && b !== parseInt(f.beds)) return false
      }
      const p = parseFloat(String(r.price)) || 0
      if (p > 0 && (p < priceMin || p > priceMax)) return false
      const a = parseFloat(String(r.area)) || 0
      if (a > 0 && (a < areaMin || a > areaMax)) return false
      if (f.delivery) {
        if (f.delivery === '2031') { if (parseInt(r.delivery_year) < 2031) return false }
        else if (r.delivery_year !== f.delivery) return false
      }
      if (discountMin) { const d = parseFloat(String(r.discount)) || 0; if (d < discountMin) return false }
      if (f.extras === 'garden' && !(parseFloat(String(r.garden)) > 0)) return false
      if (f.extras === 'roof' && !(parseFloat(String(r.roof)) > 0)) return false
      return true
    })
  }, [rawData, applied, zone])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case 'price-asc':     arr.sort((a, b) => (parseFloat(String(a.price)) || Infinity) - (parseFloat(String(b.price)) || Infinity)); break
      case 'price-desc':    arr.sort((a, b) => (parseFloat(String(b.price)) || 0) - (parseFloat(String(a.price)) || 0)); break
      case 'area-desc':     arr.sort((a, b) => (parseFloat(String(b.area)) || 0) - (parseFloat(String(a.area)) || 0)); break
      case 'area-asc':      arr.sort((a, b) => (parseFloat(String(a.area)) || Infinity) - (parseFloat(String(b.area)) || Infinity)); break
      case 'ppsqm-asc':     arr.sort((a, b) => (parseFloat(String(a.ppsqm)) || Infinity) - (parseFloat(String(b.ppsqm)) || Infinity)); break
      case 'discount-desc': arr.sort((a, b) => (parseFloat(String(b.discount)) || 0) - (parseFloat(String(a.discount)) || 0)); break
    }
    return arr
  }, [filtered, sort])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isFilterActive = useMemo(() => Object.values(applied).some(v => v !== ''), [applied])
  const priceSteps = useMemo(() => isFilterActive ? buildPriceSteps(filtered) : [], [filtered, isFilterActive])
  useEffect(() => { setPriceKpiState(0) }, [priceSteps])

  const kpiAreas = useMemo(() => filtered.map(r => parseFloat(String(r.area))).filter(a => a > 0), [filtered])
  const kpiMinArea = kpiAreas.length ? safeMin(kpiAreas) : null
  const kpiMaxArea = kpiAreas.length ? safeMax(kpiAreas) : null
  const kpiProjects = useMemo(() => new Set(filtered.map(r => r.project)).size, [filtered])

  const availableProjects = useMemo(() => {
    if (!rawData.length) return []
    const f = filters
    const priceMin = parseFloat(f.priceMin) * 1e6 || 0
    const priceMax = parseFloat(f.priceMax) * 1e6 || Infinity
    const areaMin = parseFloat(f.areaMin) || 0
    const areaMax = parseFloat(f.areaMax) || Infinity
    const discountMin = parseFloat(f.discount) || 0
    const projects = new Set<string>()
    rawData.forEach(r => {
      if (f.city && r.city !== f.city) return
      if (zone !== 'R' && f.city === 'new capital') {
        const inR8 = isR8Project(r.project)
        if (zone === 'R8' && !inR8) return
        if (zone === 'R7' && inR8) return
      }
      if (f.type && r.type !== f.type) return
      if (f.finish && r.finish !== f.finish) return
      if (f.beds) {
        const b = parseInt(String(r.beds)) || 0
        if (f.beds === '5' && b < 5) return
        else if (f.beds !== '5' && b !== parseInt(f.beds)) return
      }
      const p = parseFloat(String(r.price)) || 0
      if (p > 0 && (p < priceMin || p > priceMax)) return
      const a = parseFloat(String(r.area)) || 0
      if (a > 0 && (a < areaMin || a > areaMax)) return
      if (f.delivery) {
        if (f.delivery === '2031') { if (parseInt(r.delivery_year) < 2031) return }
        else if (r.delivery_year !== f.delivery) return
      }
      if (discountMin) { const d = parseFloat(String(r.discount)) || 0; if (d < discountMin) return }
      if (f.extras === 'garden' && !(parseFloat(String(r.garden)) > 0)) return
      if (f.extras === 'roof' && !(parseFloat(String(r.roof)) > 0)) return
      projects.add(r.project)
    })
    return Array.from(projects).sort((a, b) => a.localeCompare(b))
  }, [rawData, filters, zone])
  const currentPriceStep = priceSteps[priceKpiState]
  const selectedProperty = selectedIdx !== null ? sorted[selectedIdx] : null

  useEffect(() => {
    if (selectedIdx === null) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedIdx(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx])

  const handlePage = useCallback((p: number) => {
    if (p < 1 || p > totalPages) return
    setPage(p)
    window.scrollTo(0, 0)
  }, [totalPages])

  const showStart = sorted.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const showEnd = Math.min(page * PAGE_SIZE, sorted.length)

  if (loading) {
    return (
      <div className="ph-root">
        <div className="ph-loading" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ph-spinner" />
          <p>Loading property database…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ph-root">

    <div className="ph-layout">

      {/* ── SIDEBAR ── */}
      <aside className="ph-sidebar">
        <div className="ph-filter-section">
          <h3>🔍 Project</h3>
          <Combobox
            value={filters.search}
            onChange={handleSearchChange}
            options={availableProjects.map(p => ({ value: p, label: p }))}
            placeholder={`All Projects (${availableProjects.length})`}
          />
        </div>

        <div className="ph-filter-section">
          <h3>📍 Location</h3>
          <label className="ph-filter-label">City</label>
          <Combobox
            value={filters.city}
            onChange={v => setFilter('city', v)}
            options={CITY_OPTIONS}
            placeholder="All Cities"
          />
        </div>

        <div className="ph-filter-section">
          <h3>🏠 Property</h3>
          <label className="ph-filter-label">Unit Type</label>
          <Combobox
            value={filters.type}
            onChange={v => setFilter('type', v)}
            options={TYPE_OPTIONS}
            placeholder="All Types"
          />
          <label className="ph-filter-label">Finishing</label>
          <Combobox
            value={filters.finish}
            onChange={v => setFilter('finish', v)}
            options={FINISH_OPTIONS}
            placeholder="All Finishes"
          />
          <label className="ph-filter-label">Bedrooms</label>
          <Combobox
            value={filters.beds}
            onChange={v => setFilter('beds', v)}
            options={BEDS_OPTIONS}
            placeholder="Any"
          />
        </div>

        <div className="ph-filter-section">
          <h3>💰 Price (EGP)</h3>
          <div className="ph-range-row">
            <div>
              <label className="ph-filter-label">Min (M)</label>
              <input type="number" className="ph-input" placeholder="0" min="0" step="0.5"
                value={filters.priceMin} onChange={e => setFilters(f => ({ ...f, priceMin: e.target.value }))} />
            </div>
            <div>
              <label className="ph-filter-label">Max (M)</label>
              <input type="number" className="ph-input" placeholder="385" min="0" step="0.5"
                value={filters.priceMax} onChange={e => setFilters(f => ({ ...f, priceMax: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="ph-filter-section">
          <h3>📐 Area (sqm)</h3>
          <div className="ph-range-row">
            <div>
              <label className="ph-filter-label">Min</label>
              <input type="number" className="ph-input" placeholder="0"
                value={filters.areaMin} onChange={e => setFilters(f => ({ ...f, areaMin: e.target.value }))} />
            </div>
            <div>
              <label className="ph-filter-label">Max</label>
              <input type="number" className="ph-input" placeholder="2000"
                value={filters.areaMax} onChange={e => setFilters(f => ({ ...f, areaMax: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="ph-filter-section">
          <h3>📅 Delivery</h3>
          <Combobox
            value={filters.delivery}
            onChange={v => setFilter('delivery', v)}
            options={DELIVERY_OPTIONS}
            placeholder="Any Year"
          />
        </div>

        <div className="ph-filter-section">
          <h3>🏷️ Extras</h3>
          <label className="ph-filter-label">Cash Discount</label>
          <Combobox
            value={filters.discount}
            onChange={v => setFilter('discount', v)}
            options={DISCOUNT_OPTIONS}
            placeholder="Any"
          />
          <label className="ph-filter-label">Garden / Roof</label>
          <Combobox
            value={filters.extras}
            onChange={v => setFilter('extras', v)}
            options={EXTRAS_OPTIONS}
            placeholder="Any"
          />
        </div>

        <button className="ph-btn-primary" onClick={applyFilters}>Apply Filters</button>
        <button className="ph-btn-reset" onClick={resetFilters}>↺ Reset All</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="ph-main">

        {/* KPIs */}
        <div className="ph-kpi-row">
          <div className="ph-kpi ph-kpi-energy">
            <div className="ph-kpi-icon">🏠</div>
            <div className="ph-kpi-val">{filtered.length.toLocaleString()}</div>
            <div className="ph-kpi-lbl">Units Found</div>
          </div>

          <div
            className="ph-kpi ph-kpi-gold"
            onClick={() => priceSteps.length && setPriceKpiState(s => (s + 1) % priceSteps.length)}
            style={{ cursor: priceSteps.length ? 'pointer' : 'default', userSelect: 'none' }}
            title="Click to cycle price views"
          >
            <div className="ph-kpi-icon">💰</div>
            <div className="ph-kpi-val">{currentPriceStep ? fmt(currentPriceStep.price) : '—'}</div>
            <div className="ph-kpi-lbl">{currentPriceStep ? currentPriceStep.label : 'Min Price · click ›'}</div>
          </div>

          <div className="ph-kpi ph-kpi-green">
            <div className="ph-kpi-icon">📐</div>
            <div className="ph-kpi-val">{kpiMinArea != null ? kpiMinArea + 'm²' : '—'}</div>
            <div className="ph-kpi-lbl">Min Area (sqm)</div>
          </div>

          <div className="ph-kpi ph-kpi-white">
            <div className="ph-kpi-icon">🏗</div>
            <div className="ph-kpi-val">{kpiMaxArea != null ? kpiMaxArea + 'm²' : '—'}</div>
            <div className="ph-kpi-lbl">Max Area (sqm)</div>
          </div>

          <div className="ph-kpi ph-kpi-energy">
            <div className="ph-kpi-icon">🏗️</div>
            <div className="ph-kpi-val">{kpiProjects.toLocaleString()}</div>
            <div className="ph-kpi-lbl">Projects</div>
          </div>
        </div>

        {/* Results header */}
        <div className="ph-results-header">
          <div className="ph-results-count">
            Showing <span>{sorted.length > 0 ? `${showStart}–${showEnd}` : '0'}</span> of <span>{sorted.length.toLocaleString()}</span> units
          </div>
          <div className="ph-view-controls">
            {applied.city === 'new capital' && (
              <select className="ph-sort-select" value={zone} onChange={e => { setZone(e.target.value as 'R' | 'R7' | 'R8'); setPage(1) }}>
                <option value="R">R (All)</option>
                <option value="R7">R7</option>
                <option value="R8">R8</option>
              </select>
            )}
            <select className="ph-sort-select" value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
              <option value="area-desc">Area ↓</option>
              <option value="area-asc">Area ↑</option>
              <option value="ppsqm-asc">Price/sqm ↑</option>
              <option value="discount-desc">Discount ↓</option>
            </select>
            <button className={`ph-view-btn${view === 'grid' ? ' active' : ''}`} onClick={() => setView('grid')} title="Grid view">⊞</button>
            <button className={`ph-view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')} title="List view">☰</button>
          </div>
        </div>

        {/* Results */}
        {sorted.length === 0 ? (
          <div className="ph-empty">
            <div className="ph-empty-icon">🔍</div>
            <h3>No properties found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : view === 'grid' ? (
          <div className="ph-grid-view">
            {pageItems.map((r, i) => {
              const idx = (page - 1) * PAGE_SIZE + i
              const hasGarden = parseFloat(String(r.garden)) > 0
              const hasRoof = parseFloat(String(r.roof)) > 0
              const discount = parseFloat(String(r.discount))
              return (
                <div key={idx} className="ph-property-card" onClick={() => setSelectedIdx(idx)}>
                  <div className="ph-card-top">
                    <div className="ph-city-badge">{r.city}</div>
                    <div className="ph-card-project">{r.project}</div>
                    <div className="ph-card-developer">{r.developer}</div>
                    <div className="ph-type-badge">{r.type || 'unit'}</div>
                  </div>
                  <div className="ph-card-body">
                    <div className="ph-card-specs">
                      {r.beds ? <div className="ph-spec"><span className="ph-spec-icon">🛏</span><strong>{r.beds}</strong><span>Beds</span></div> : null}
                      {r.area ? <div className="ph-spec"><span className="ph-spec-icon">📐</span><strong>{r.area}</strong><span>m²</span></div> : null}
                      {r.floor !== '' && r.floor !== undefined ? <div className="ph-spec"><span className="ph-spec-icon">🏢</span><strong>Fl. {r.floor}</strong></div> : null}
                      {hasGarden ? <div className="ph-spec"><span className="ph-spec-icon">🌿</span><strong>Garden {r.garden}m²</strong></div> : null}
                      {hasRoof ? <div className="ph-spec"><span className="ph-spec-icon">🏠</span><strong>Roof {r.roof}m²</strong></div> : null}
                    </div>
                    <div className="ph-card-price">{r.price ? 'EGP ' + fmt(r.price) : '—'}</div>
                    <div className="ph-card-price-sub">{r.ppsqm ? fmt(r.ppsqm) + ' EGP/m²' : (r.code || '')}</div>
                  </div>
                  <div className="ph-card-footer">
                    <span className={`ph-finish-badge ${finishClass(r.finish)}`}>{r.finish || '—'}</span>
                    <span className="ph-delivery-info">📅 <span>{r.delivery || '—'}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="ph-list-view">
            <div className="ph-list-row" style={{ cursor: 'default', opacity: 0.45, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', padding: '8px 16px', fontFamily: "'Space Grotesk', sans-serif" }}>
              <div className="ph-list-project">PROJECT / DEVELOPER</div>
              <div className="ph-list-city">CITY</div>
              <div className="ph-list-type">TYPE</div>
              <div className="ph-list-area">AREA</div>
              <div className="ph-list-price">PRICE (EGP)</div>
              <div className="ph-list-finish">FINISH</div>
              <div className="ph-list-delivery">DELIVERY</div>
              <div className="ph-list-action" />
            </div>
            {pageItems.map((r, i) => {
              const idx = (page - 1) * PAGE_SIZE + i
              return (
                <div key={idx} className="ph-list-row" onClick={() => setSelectedIdx(idx)}>
                  <div className="ph-list-project">
                    <div className="name">{r.project}</div>
                    <div className="dev">{r.developer}</div>
                  </div>
                  <div className="ph-list-city">{r.city}</div>
                  <div className="ph-list-type">{r.type || '—'}</div>
                  <div className="ph-list-area">{r.area ? r.area + 'm²' : '—'}</div>
                  <div className="ph-list-price">{r.price ? fmt(r.price) : '—'}</div>
                  <div className="ph-list-finish">
                    <span className={`ph-finish-badge ${finishClass(r.finish)}`}>{r.finish || '—'}</span>
                  </div>
                  <div className="ph-list-delivery">{r.delivery || '—'}</div>
                  <div className="ph-list-action">›</div>
                </div>
              )
            })}
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
              for (let i = start; i <= end; i++) {
                btns.push(
                  <button key={i} className={`ph-page-btn${i === page ? ' active' : ''}`} onClick={() => handlePage(i)}>{i}</button>
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
            {(() => {
              const r = selectedProperty
              const plans = (r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
              const contacts = (r.contact || '').split('|').map(s => s.trim()).filter(Boolean)
              const phones = (r.phone || '').split('|').map(s => s.trim()).filter(Boolean)
              return (
                <>
                  <div className="ph-modal-header">
                    <div>
                      <div style={{ fontSize: '11px', color: '#d7ff00', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '4px', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {r.city} • {capitalize(r.type)}
                      </div>
                      <div className="ph-modal-title">{r.project}</div>
                      <div className="ph-modal-sub">{r.developer}</div>
                    </div>
                    <button className="ph-modal-close" onClick={() => setSelectedIdx(null)}>×</button>
                  </div>

                  <div className="ph-modal-body">
                    <div style={{ marginBottom: '18px' }}>
                      <div className="ph-modal-price-big">{r.price ? 'EGP ' + fmtFull(r.price) : '—'}</div>
                      {r.ppsqm ? <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>{fmtFull(r.ppsqm)} EGP per m²</div> : null}
                    </div>

                    <div className="ph-modal-grid">
                      <div className="ph-modal-field"><div className="f-label">Unit Code</div><div className="f-value">{r.code || '—'}</div></div>
                      <div className="ph-modal-field"><div className="f-label">Phase / Building</div><div className="f-value">{r.phase || '—'}</div></div>
                      <div className="ph-modal-field"><div className="f-label">Floor</div><div className="f-value">{r.floor !== '' && r.floor !== undefined ? r.floor : '—'}</div></div>
                      <div className="ph-modal-field"><div className="f-label">Bedrooms</div><div className="f-value">{r.beds || '—'}</div></div>
                      <div className="ph-modal-field"><div className="f-label">Area</div><div className="f-value">{r.area ? r.area + ' m²' : '—'}</div></div>
                      {parseFloat(String(r.garden)) > 0 && (
                        <div className="ph-modal-field"><div className="f-label">Garden Area</div><div className="f-value">{r.garden} m²</div></div>
                      )}
                      {parseFloat(String(r.roof)) > 0 && (
                        <div className="ph-modal-field"><div className="f-label">Roof Area</div><div className="f-value">{r.roof} m²</div></div>
                      )}
                      <div className="ph-modal-field">
                        <div className="f-label">Finishing</div>
                        <div className="f-value"><span className={`ph-finish-badge ${finishClass(r.finish)}`}>{r.finish || '—'}</span></div>
                      </div>
                      <div className="ph-modal-field"><div className="f-label">Delivery</div><div className="f-value">{r.delivery || '—'}</div></div>
                      <div className="ph-modal-field">
                        <div className="f-label">Cash Discount</div>
                        <div className="f-value" style={{ color: '#22c55e' }}>{r.discount ? r.discount + '%' : '—'}</div>
                      </div>
                      <div className="ph-modal-field"><div className="f-label">Maintenance</div><div className="f-value">{r.maint ? r.maint + '%' : '—'}</div></div>
                      <div className="ph-modal-field"><div className="f-label">Parking</div><div className="f-value">{r.parking || '—'}</div></div>
                    </div>

                    {plans.length > 0 && (
                      <div className="ph-modal-section">
                        <h4>💳 Payment Plans</h4>
                        <div className="ph-plans-list">
                          {plans.map((p, i) => <div key={i} className="ph-plan-item">• {p}</div>)}
                        </div>
                      </div>
                    )}

                    {contacts.length > 0 && (
                      <div className="ph-modal-section">
                        <h4>📞 Sales Contacts</h4>
                        {contacts.map((c, i) => (
                          <div key={i} className="ph-contact-card">
                            <div className="ph-contact-avatar">{c.trim()[0] || '?'}</div>
                            <div>
                              <div className="ph-contact-name">{c}</div>
                              <div className="ph-contact-phone">{phones[i] || ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>

    </div>
  )
}
