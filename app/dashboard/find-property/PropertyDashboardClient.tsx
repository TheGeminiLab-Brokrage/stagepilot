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

export default function PropertyDashboardClient() {
  const [rawData, setRawData] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState('price-asc')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [priceKpiState, setPriceKpiState] = useState(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fetch('/property-data.json')
      .then(r => r.json())
      .then((data: Property[]) => { setRawData(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSearchChange = useCallback((val: string) => {
    setFilters(f => ({ ...f, search: val }))
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setApplied(f => ({ ...f, search: val }))
      setPage(1)
    }, 300)
  }, [])

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

  const filtered = useMemo(() => {
    if (!rawData.length) return []
    const f = applied
    const priceMin = parseFloat(f.priceMin) * 1e6 || 0
    const priceMax = parseFloat(f.priceMax) * 1e6 || Infinity
    const areaMin = parseFloat(f.areaMin) || 0
    const areaMax = parseFloat(f.areaMax) || Infinity
    const discountMin = parseFloat(f.discount) || 0
    const search = f.search.toLowerCase().trim()
    return rawData.filter(r => {
      if (search && !r.project.toLowerCase().includes(search) && !r.developer.toLowerCase().includes(search) && !r.city.toLowerCase().includes(search)) return false
      if (f.city && r.city !== f.city) return false
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
  }, [rawData, applied])

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
      <div className="ph-loading" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ph-spinner" />
        <p>Loading property database…</p>
      </div>
    )
  }

  return (
    <div className="ph-layout">

      {/* ── SIDEBAR ── */}
      <aside className="ph-sidebar">
        <div className="ph-filter-section">
          <h3>🔍 Search</h3>
          <div className="ph-search-wrap">
            <svg className="ph-search-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="ph-input"
              placeholder="Project name, developer…"
              value={filters.search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="ph-filter-section">
          <h3>📍 Location</h3>
          <label className="ph-filter-label">City</label>
          <select className="ph-select" value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}>
            <option value="">All Cities</option>
            <option value="6th of october">6th Of October</option>
            <option value="Alexandria">Alexandria</option>
            <option value="Badr city">Badr City</option>
            <option value="Dubai">Dubai</option>
            <option value="Ein elsokhna">Ein Elsokhna</option>
            <option value="El Mokattam">El Mokattam</option>
            <option value="Heliopolis">Heliopolis</option>
            <option value="Hurghada">Hurghada</option>
            <option value="Jirian El Shiekh Zayed">Jirian El Shiekh Zayed</option>
            <option value="Katameya">Katameya</option>
            <option value="Minya Governorate">Minya Governorate</option>
            <option value="North coast">North Coast</option>
            <option value="al maadi">Al Maadi</option>
            <option value="el mostakbal city">El Mostakbal City</option>
            <option value="elobour city">Elobour City</option>
            <option value="elshourok city">Elshourok City</option>
            <option value="matrouh">Matrouh</option>
            <option value="nasr city">Nasr City</option>
            <option value="new cairo">New Cairo</option>
            <option value="new capital">New Capital</option>
            <option value="new heliopolis">New Heliopolis</option>
            <option value="new zayed">New Zayed</option>
            <option value="ras sedr">Ras Sedr</option>
            <option value="sheikh zayed city">Sheikh Zayed City</option>
            <option value="sixth settlement">Sixth Settlement</option>
          </select>
        </div>

        <div className="ph-filter-section">
          <h3>🏠 Property</h3>
          <label className="ph-filter-label">Unit Type</label>
          <select className="ph-select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            <option value="apartment">Apartment</option>
            <option value="beach house">Beach House</option>
            <option value="beachfront apt">Beachfront Apt</option>
            <option value="cabin">Cabin</option>
            <option value="chalet">Chalet</option>
            <option value="condo">Condo</option>
            <option value="duplex">Duplex</option>
            <option value="family house">Family House</option>
            <option value="garden millennial">Garden Millennial</option>
            <option value="i villa">I Villa</option>
            <option value="iv beach house">Iv Beach House</option>
            <option value="lake house">Lake House</option>
            <option value="loft">Loft</option>
            <option value="millennial">Millennial</option>
            <option value="one story">One Story</option>
            <option value="palace">Palace</option>
            <option value="penthouse">Penthouse</option>
            <option value="s villa">S Villa</option>
            <option value="sky scape">Sky Scape</option>
            <option value="standalone">Standalone</option>
            <option value="studio">Studio</option>
            <option value="town house">Town House</option>
            <option value="townhouse">Townhouse</option>
            <option value="townhouse corner">Townhouse Corner</option>
            <option value="townhouse middle">Townhouse Middle</option>
          </select>
          <label className="ph-filter-label">Finishing</label>
          <select className="ph-select" value={filters.finish} onChange={e => setFilters(f => ({ ...f, finish: e.target.value }))}>
            <option value="">All Finishes</option>
            <option value="core and shell">Core And Shell</option>
            <option value="flexi">Flexi</option>
            <option value="fully finished">Fully Finished</option>
            <option value="fully finished with ac">Fully Finished With AC</option>
            <option value="fully finished with ac and kitchen cabinets">Fully Finished With AC &amp; Kitchen</option>
            <option value="fully finished with kitchen cabinets">Fully Finished With Kitchen</option>
            <option value="fully furnished">Fully Furnished</option>
            <option value="fully furnished with ac">Fully Furnished With AC</option>
            <option value="semi finished">Semi Finished</option>
          </select>
          <label className="ph-filter-label">Bedrooms</label>
          <select className="ph-select" value={filters.beds} onChange={e => setFilters(f => ({ ...f, beds: e.target.value }))}>
            <option value="">Any</option>
            <option value="1">1 Bedroom</option>
            <option value="2">2 Bedrooms</option>
            <option value="3">3 Bedrooms</option>
            <option value="4">4 Bedrooms</option>
            <option value="5">5+ Bedrooms</option>
          </select>
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
          <select className="ph-select" value={filters.delivery} onChange={e => setFilters(f => ({ ...f, delivery: e.target.value }))}>
            <option value="">Any Year</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
            <option value="2029">2029</option>
            <option value="2030">2030</option>
            <option value="2031">2031+</option>
          </select>
        </div>

        <div className="ph-filter-section">
          <h3>🏷️ Extras</h3>
          <label className="ph-filter-label">Cash Discount</label>
          <select className="ph-select" value={filters.discount} onChange={e => setFilters(f => ({ ...f, discount: e.target.value }))}>
            <option value="">Any</option>
            <option value="10">10%+</option>
            <option value="20">20%+</option>
            <option value="30">30%+</option>
            <option value="40">40%+</option>
          </select>
          <label className="ph-filter-label">Garden / Roof</label>
          <select className="ph-select" value={filters.extras} onChange={e => setFilters(f => ({ ...f, extras: e.target.value }))}>
            <option value="">Any</option>
            <option value="garden">Has Garden</option>
            <option value="roof">Has Roof</option>
          </select>
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
                  {discount >= 20 && <div className="ph-discount-ribbon">{discount}% OFF</div>}
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
  )
}
