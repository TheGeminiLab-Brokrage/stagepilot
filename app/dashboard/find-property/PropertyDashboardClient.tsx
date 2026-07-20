'use client'

import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import './property.css'
import { generatePropertyMessage } from '@/lib/property-message'
import { useUndoStack, setWithUndo } from '@/lib/use-undo-stack'
import { useT } from '@/lib/language-context'

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
  search: string[]
  city: string[]
  type: string[]
  finish: string[]
  beds: string[]
  priceMin: string
  priceMax: string
  areaMin: string
  areaMax: string
  delivery: string[]
  discount: string[]
  extras: string[]
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
  search: [], city: [], type: [], finish: [], beds: [],
  priceMin: '', priceMax: '', areaMin: '', areaMax: '',
  delivery: [], discount: [], extras: [],
}

type SavedSelection = { fields: string[]; plans: string[] }

function unitKey(r: Property): string {
  return `${r.project}::${r.code}::${r.phase}::${r.floor}`
}

function loadSelection(userId: string, key: string): SavedSelection | null {
  try {
    const raw = localStorage.getItem(`pv_dashboard_selection_${userId}`)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, SavedSelection>
    return map[key] ?? null
  } catch {
    return null
  }
}

function saveSelection(userId: string, key: string, fields: string[], plans: string[]) {
  try {
    const raw = localStorage.getItem(`pv_dashboard_selection_${userId}`)
    const map = raw ? (JSON.parse(raw) as Record<string, SavedSelection>) : {}
    map[key] = { fields, plans }
    localStorage.setItem(`pv_dashboard_selection_${userId}`, JSON.stringify(map))
  } catch { /* ignore */ }
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

const FIELD_LABELS: Record<string, string> = {
  code: 'كود الوحدة',
  phase: 'المرحلة / المبنى',
  floor: 'الدور',
  area: 'المساحة',
  price: 'السعر',
  discount: 'خصم الكاش',
  delivery: 'التسليم',
  maint: 'الصيانة',
  parking: 'موقف السيارة',
}

function getAvailableFields(r: Property): string[] {
  const f: string[] = []
  if (r.code) f.push('code')
  if (r.phase) f.push('phase')
  if (r.floor !== '' && r.floor !== undefined) f.push('floor')
  if (r.area) f.push('area')
  if (r.price) f.push('price')
  if (parseFloat(String(r.discount)) > 0) f.push('discount')
  if (r.delivery) f.push('delivery')
  if (parseFloat(String(r.maint)) > 0) f.push('maint')
  if (r.parking && String(r.parking) !== '—') f.push('parking')
  return f
}

function fieldValueLabel(r: Property, field: string): string {
  switch (field) {
    case 'code':     return String(r.code)
    case 'phase':    return String(r.phase)
    case 'floor':    return String(r.floor)
    case 'area':     return `${r.area} م²`
    case 'price':    return `${parseFloat(String(r.price)).toLocaleString('en-EG')} ج`
    case 'discount': return parseFloat(String(r.discount)) > 99
                       ? `${parseFloat(String(r.discount)).toLocaleString('en-EG')} ج`
                       : `${r.discount}%`
    case 'delivery': return String(r.delivery)
    case 'maint':    return `${r.maint}%`
    case 'parking':  return String(r.parking)
    default:         return ''
  }
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
  { value: '2025', label: 'By 2025' },
  { value: '2026', label: 'By 2026' },
  { value: '2027', label: 'By 2027' },
  { value: '2028', label: 'By 2028' },
  { value: '2029', label: 'By 2029' },
  { value: '2030', label: 'By 2030' },
  { value: '2031', label: 'By 2031+' },
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

function MultiCombobox({ value, onChange, options, placeholder }: {
  value: string[]
  onChange: (v: string[]) => void
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

  const displayValue =
    value.length === 0 ? '' :
    value.length === 1 ? (options.find(o => o.value === value[0])?.label ?? value[0]) :
    `${value.length} selected`

  const list = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(v: string) {
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v]
    onChange(next)
  }

  return (
    <div className="ph-combo" ref={ref}>
      <input
        className="ph-input ph-combo-input"
        value={open ? query : displayValue}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
      />
      <span className="ph-combo-arrow">{open ? '▲' : '▼'}</span>
      {open && (
        <ul className="ph-combo-list">
          <li
            className={value.length === 0 ? 'ph-combo-selected' : ''}
            onMouseDown={() => { onChange([]); setOpen(false); setQuery('') }}
          >
            {placeholder}
          </li>
          {list.map(o => (
            <li
              key={o.value}
              className={value.includes(o.value) ? 'ph-combo-selected' : ''}
              onMouseDown={e => { e.preventDefault(); toggle(o.value) }}
            >
              {value.includes(o.value) ? '✓ ' : ''}{o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PropertyDashboardClient({ userId }: { userId: string }) {
  const t = useT()
  const [rawData, setRawData] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [zone, setZone] = useState<'R' | 'R7' | 'R8'>('R')
  const [sort, setSort] = useState('price-asc')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [priceKpiState, setPriceKpiState] = useState(0)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedModal, setCopiedModal] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<number | null>(null)
  const [pickerPlans, setPickerPlans] = useState<string[]>([])
  const [pickerFields, setPickerFields] = useState<string[]>([])
  const [modalPlanSelected, setModalPlanSelected] = useState<string[]>([])
  const [modalFields, setModalFields] = useState<string[]>([])
  const [previewLines, setPreviewLines] = useState<string[] | null>(null)
  const [previewCopied, setPreviewCopied] = useState(false)
  const { record, undo } = useUndoStack()

  // The dataset is ~13.5 MB, so repeat visits serve instantly from the browser
  // Cache API while a silent background fetch keeps the copy fresh.
  const loadData = useCallback(() => {
    setLoading(true)
    setLoadError(false)

    const clean = (data: Property[]) => data.filter(r => parseFloat(String(r.price)) > 0)

    const fromNetwork = async (): Promise<Property[]> => {
      const r = await fetch('/property-data.json')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if ('caches' in window) {
        try {
          const cache = await caches.open('sp-property-v1')
          await cache.put('/property-data.json', r.clone())
        } catch { /* private mode or quota — network copy still works */ }
      }
      return r.json()
    }

    ;(async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('sp-property-v1')
          const hit = await cache.match('/property-data.json')
          if (hit) {
            setRawData(clean(await hit.json()))
            setLoading(false)
            // Refresh silently in the background so tomorrow's visit is current
            fromNetwork().then(fresh => setRawData(clean(fresh))).catch(() => {})
            return
          }
        }
        setRawData(clean(await fromNetwork()))
        setLoading(false)
      } catch {
        setLoadError(true)
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const setFilter = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters(f => ({ ...f, [key]: val }))
    setApplied(f => ({ ...f, [key]: val }))
    setPage(1)
  }, [])

  const handleSearchChange = useCallback((vals: string[]) => {
    setFilter('search', vals)
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

  // ── Saved searches (localStorage, max 20) ──
  type SavedSearch = { name: string; filters: Filters; zone: 'R' | 'R7' | 'R8'; sort: string }
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [savedOpen, setSavedOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sp_saved_searches')
      if (raw) setSavedSearches(JSON.parse(raw))
    } catch { /* corrupt storage — start fresh */ }
  }, [])

  const persistSaved = useCallback((next: SavedSearch[]) => {
    setSavedSearches(next)
    try { localStorage.setItem('sp_saved_searches', JSON.stringify(next)) } catch { /* storage full */ }
  }, [])

  const saveCurrentSearch = useCallback(() => {
    const name = window.prompt('Name this search (e.g. "3-bed under 8M, R7"):')?.trim()
    if (!name) return
    const entry: SavedSearch = { name, filters, zone, sort }
    persistSaved([entry, ...savedSearches.filter(s => s.name !== name)].slice(0, 20))
  }, [filters, zone, sort, savedSearches, persistSaved])

  const applySavedSearch = useCallback((s: SavedSearch) => {
    setFilters(s.filters)
    setApplied(s.filters)
    setZone(s.zone)
    setSort(s.sort)
    setPage(1)
    setSavedOpen(false)
  }, [])

  useEffect(() => {
    if (!applied.city.includes('new capital')) setZone('R')
  }, [applied.city])

  const filtered = useMemo(() => {
    if (!rawData.length) return []
    const f = applied
    const priceMin = parseFloat(f.priceMin) * 1e6 || 0
    const priceMax = parseFloat(f.priceMax) * 1e6 || Infinity
    const areaMin = parseFloat(f.areaMin) || 0
    const areaMax = parseFloat(f.areaMax) || Infinity
    return rawData.filter(r => {
      if (f.search.length && !f.search.includes(r.project)) return false
      if (f.city.length && !f.city.includes(r.city)) return false
      if (zone !== 'R' && f.city.includes('new capital')) {
        const inR8 = isR8Project(r.project)
        if (zone === 'R8' && !inR8) return false
        if (zone === 'R7' && inR8) return false
      }
      if (f.type.length && !f.type.includes(r.type)) return false
      if (f.finish.length && !f.finish.includes(r.finish)) return false
      if (f.beds.length) {
        const b = parseInt(String(r.beds)) || 0
        const key = b >= 5 ? '5' : String(b)
        if (!f.beds.includes(key)) return false
      }
      const p = parseFloat(String(r.price)) || 0
      if (p > 0 && (p < priceMin || p > priceMax)) return false
      const a = parseFloat(String(r.area)) || 0
      if (a > 0 && (a < areaMin || a > areaMax)) return false
      if (f.delivery.length) {
        const maxSelected = Math.max(...f.delivery.map(y => parseInt(y)))
        const rawYr = parseInt(r.delivery_year)
        if (rawYr >= 2020 && rawYr <= 2050 && maxSelected < 2031 && rawYr > maxSelected) return false
      }
      if (f.discount.length) {
        const d = parseFloat(String(r.discount)) || 0
        if (!f.discount.some(thr => d >= parseInt(thr))) return false
      }
      if (f.extras.length) {
        const hasGarden = parseFloat(String(r.garden)) > 0
        const hasRoof = parseFloat(String(r.roof)) > 0
        if (!f.extras.some(e => (e === 'garden' && hasGarden) || (e === 'roof' && hasRoof))) return false
      }
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

  const isFilterActive = useMemo(() =>
    Object.values(applied).some(v => Array.isArray(v) ? v.length > 0 : v !== ''),
  [applied])
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
    const projects = new Set<string>()
    rawData.forEach(r => {
      if (f.city.length && !f.city.includes(r.city)) return
      if (zone !== 'R' && f.city.includes('new capital')) {
        const inR8 = isR8Project(r.project)
        if (zone === 'R8' && !inR8) return
        if (zone === 'R7' && inR8) return
      }
      if (f.type.length && !f.type.includes(r.type)) return
      if (f.finish.length && !f.finish.includes(r.finish)) return
      if (f.beds.length) {
        const b = parseInt(String(r.beds)) || 0
        const key = b >= 5 ? '5' : String(b)
        if (!f.beds.includes(key)) return
      }
      const p = parseFloat(String(r.price)) || 0
      if (p > 0 && (p < priceMin || p > priceMax)) return
      const a = parseFloat(String(r.area)) || 0
      if (a > 0 && (a < areaMin || a > areaMax)) return
      if (f.delivery.length) {
        const maxSelected = Math.max(...f.delivery.map(y => parseInt(y)))
        const rawYr = parseInt(r.delivery_year)
        if (rawYr >= 2020 && rawYr <= 2050 && maxSelected < 2031 && rawYr > maxSelected) return
      }
      if (f.discount.length) {
        const d = parseFloat(String(r.discount)) || 0
        if (!f.discount.some(thr => d >= parseInt(thr))) return
      }
      if (f.extras.length) {
        const hasGarden = parseFloat(String(r.garden)) > 0
        const hasRoof = parseFloat(String(r.roof)) > 0
        if (!f.extras.some(e => (e === 'garden' && hasGarden) || (e === 'roof' && hasRoof))) return
      }
      projects.add(r.project)
    })
    return Array.from(projects).sort((a, b) => a.localeCompare(b))
  }, [rawData, filters, zone])

  const facetCounts = useMemo(() => {
    const f = filters
    const priceMin = parseFloat(f.priceMin) * 1e6 || 0
    const priceMax = parseFloat(f.priceMax) * 1e6 || Infinity
    const areaMin = parseFloat(f.areaMin) || 0
    const areaMax = parseFloat(f.areaMax) || Infinity

    function passes(r: Property, skip: string): boolean {
      const p = parseFloat(String(r.price)) || 0
      const a = parseFloat(String(r.area)) || 0
      const b = parseInt(String(r.beds)) || 0
      if (skip !== 'city' && f.city.length && !f.city.includes(r.city)) return false
      if (skip !== 'search' && f.search.length && !f.search.includes(r.project)) return false
      if (skip !== 'type' && f.type.length && !f.type.includes(r.type)) return false
      if (skip !== 'finish' && f.finish.length && !f.finish.includes(r.finish)) return false
      if (skip !== 'beds' && f.beds.length) {
        const key = b >= 5 ? '5' : String(b)
        if (!f.beds.includes(key)) return false
      }
      if (p > 0 && (p < priceMin || p > priceMax)) return false
      if (a > 0 && (a < areaMin || a > areaMax)) return false
      if (skip !== 'delivery' && f.delivery.length) {
        const maxSelected = Math.max(...f.delivery.map(y => parseInt(y)))
        const rawYr = parseInt(r.delivery_year)
        if (rawYr >= 2020 && rawYr <= 2050 && maxSelected < 2031 && rawYr > maxSelected) return false
      }
      if (skip !== 'discount' && f.discount.length) {
        const d = parseFloat(String(r.discount)) || 0
        if (!f.discount.some(thr => d >= parseInt(thr))) return false
      }
      if (skip !== 'extras' && f.extras.length) {
        const hasGarden = parseFloat(String(r.garden)) > 0
        const hasRoof = parseFloat(String(r.roof)) > 0
        if (!f.extras.some(e => (e === 'garden' && hasGarden) || (e === 'roof' && hasRoof))) return false
      }
      if (zone !== 'R' && f.city.includes('new capital')) {
        const inR8 = isR8Project(r.project)
        if (zone === 'R8' && !inR8) return false
        if (zone === 'R7' && inR8) return false
      }
      return true
    }

    const city: Record<string, number> = {}
    const type: Record<string, number> = {}
    const finish: Record<string, number> = {}
    const beds: Record<string, number> = {}
    const delivery: Record<string, number> = {}
    const discount: Record<string, number> = {}
    const extras: Record<string, number> = {}

    rawData.forEach(r => {
      if (passes(r, 'city')) city[r.city] = (city[r.city] || 0) + 1
      if (passes(r, 'type')) type[r.type] = (type[r.type] || 0) + 1
      if (passes(r, 'finish')) finish[r.finish] = (finish[r.finish] || 0) + 1
      if (passes(r, 'beds')) {
        const b = parseInt(String(r.beds)) || 0
        const key = b >= 5 ? '5' : String(b)
        beds[key] = (beds[key] || 0) + 1
      }
      if (passes(r, 'delivery')) {
        const yr = r.delivery_year
        const key = parseInt(yr) >= 2031 ? '2031' : yr
        delivery[key] = (delivery[key] || 0) + 1
      }
      if (passes(r, 'discount')) {
        const d = parseFloat(String(r.discount)) || 0
        for (const threshold of ['10', '20', '30', '40']) {
          if (d >= parseInt(threshold)) discount[threshold] = (discount[threshold] || 0) + 1
        }
      }
      if (passes(r, 'extras')) {
        if (parseFloat(String(r.garden)) > 0) extras['garden'] = (extras['garden'] || 0) + 1
        if (parseFloat(String(r.roof)) > 0) extras['roof'] = (extras['roof'] || 0) + 1
      }
    })

    const deliveryCumulative: Record<string, number> = {}
    let runningTotal = 0
    for (const opt of DELIVERY_OPTIONS) {
      runningTotal += delivery[opt.value] || 0
      deliveryCumulative[opt.value] = runningTotal
    }

    return { city, type, finish, beds, delivery: deliveryCumulative, discount, extras }
  }, [rawData, filters, zone])

  const currentPriceStep = priceSteps[priceKpiState]
  const selectedProperty = selectedIdx !== null ? sorted[selectedIdx] : null

  useEffect(() => {
    if (selectedIdx === null) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedIdx(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement && active.classList.contains('msg-preview-line')) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  useEffect(() => { setCopiedModal(false) }, [selectedIdx])

  useEffect(() => {
    if (selectedIdx === null) { setModalPlanSelected([]); setModalFields([]); return }
    const prop = sorted[selectedIdx]
    if (!prop) return
    const allPlans = String(prop.plans || '').split('|').map(s => s.trim()).filter(Boolean)
    const availableFields = getAvailableFields(prop)
    const saved = loadSelection(userId, unitKey(prop))
    if (saved) {
      setModalPlanSelected(saved.plans.filter(p => allPlans.includes(p)))
      setModalFields(saved.fields.filter(f => availableFields.includes(f)))
    } else {
      setModalPlanSelected(allPlans)
      setModalFields(availableFields)
    }
  }, [selectedIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback((e: ReactMouseEvent, r: Property, idx: number) => {
    e.stopPropagation()
    if (pickerOpen === idx) {
      setPickerOpen(null)
    } else {
      setPickerOpen(idx)
      setPickerPlans(String(r.plans || '').split('|').map(s => s.trim()).filter(Boolean))
      setPickerFields(getAvailableFields(r))
    }
  }, [pickerOpen])

  const handlePickerCopy = useCallback((e: ReactMouseEvent, r: Property, idx: number) => {
    e.stopPropagation()
    const fields = Object.fromEntries(
      ['code','phase','floor','area','price','discount','delivery','maint','parking'].map(k => [k, pickerFields.includes(k)])
    ) as Record<string, boolean>
    const msg = generatePropertyMessage(r, pickerPlans, fields)
    setPickerOpen(null)
    setPreviewLines(msg.split('\n'))
    setPreviewCopied(false)
  }, [pickerPlans, pickerFields])

  const handleCopyModal = useCallback((r: Property) => {
    const fields = Object.fromEntries(
      ['code','phase','floor','area','price','discount','delivery','maint','parking'].map(k => [k, modalFields.includes(k)])
    ) as Record<string, boolean>
    const msg = generatePropertyMessage(r, modalPlanSelected, fields)
    setPreviewLines(msg.split('\n'))
    setPreviewCopied(false)
  }, [modalPlanSelected, modalFields])

  const updateModalFields = useCallback((next: string[]) => {
    setWithUndo(record, setModalFields, modalFields, next)
    if (selectedProperty) saveSelection(userId, unitKey(selectedProperty), next, modalPlanSelected)
  }, [record, modalFields, modalPlanSelected, selectedProperty, userId])

  const updateModalPlans = useCallback((next: string[]) => {
    setWithUndo(record, setModalPlanSelected, modalPlanSelected, next)
    if (selectedProperty) saveSelection(userId, unitKey(selectedProperty), modalFields, next)
  }, [record, modalPlanSelected, modalFields, selectedProperty, userId])

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

  if (loadError) {
    return (
      <div className="ph-root">
        <div className="ph-loading" style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <p>Couldn&apos;t load the property database. Check your connection and try again.</p>
          <button
            onClick={loadData}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#D7FF00', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Retry
          </button>
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
          <MultiCombobox
            value={filters.search}
            onChange={handleSearchChange}
            options={availableProjects.map(p => ({ value: p, label: p }))}
            placeholder={`All Projects (${availableProjects.length})`}
          />
        </div>

        <div className="ph-filter-section">
          <h3>📍 Location</h3>
          <label className="ph-filter-label">City</label>
          <MultiCombobox
            value={filters.city}
            onChange={v => setFilter('city', v)}
            options={CITY_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.city[o.value] || 0})` }))}
            placeholder="All Cities"
          />
        </div>

        <div className="ph-filter-section">
          <h3>🏠 Property</h3>
          <label className="ph-filter-label">Unit Type</label>
          <MultiCombobox
            value={filters.type}
            onChange={v => setFilter('type', v)}
            options={TYPE_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.type[o.value] || 0})` }))}
            placeholder="All Types"
          />
          <label className="ph-filter-label">Finishing</label>
          <MultiCombobox
            value={filters.finish}
            onChange={v => setFilter('finish', v)}
            options={FINISH_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.finish[o.value] || 0})` }))}
            placeholder="All Finishes"
          />
          <label className="ph-filter-label">Bedrooms</label>
          <MultiCombobox
            value={filters.beds}
            onChange={v => setFilter('beds', v)}
            options={BEDS_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.beds[o.value] || 0})` }))}
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
          <MultiCombobox
            value={filters.delivery}
            onChange={v => setFilter('delivery', v)}
            options={DELIVERY_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.delivery[o.value] || 0})` }))}
            placeholder="Any Year"
          />
        </div>

        <div className="ph-filter-section">
          <h3>🏷️ Extras</h3>
          <label className="ph-filter-label">Cash Discount</label>
          <MultiCombobox
            value={filters.discount}
            onChange={v => setFilter('discount', v)}
            options={DISCOUNT_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.discount[o.value] || 0})` }))}
            placeholder="Any"
          />
          <label className="ph-filter-label">Garden / Roof</label>
          <MultiCombobox
            value={filters.extras}
            onChange={v => setFilter('extras', v)}
            options={EXTRAS_OPTIONS.map(o => ({ value: o.value, label: `${o.label} (${facetCounts.extras[o.value] || 0})` }))}
            placeholder="Any"
          />
        </div>

        <button className="ph-btn-primary" onClick={applyFilters}>Apply Filters</button>
        <button className="ph-btn-reset" onClick={resetFilters}>↺ Reset All</button>

        {/* Saved searches */}
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ph-btn-reset" style={{ flex: 1 }} onClick={saveCurrentSearch}>★ Save Search</button>
            <button className="ph-btn-reset" style={{ flex: 1 }} onClick={() => setSavedOpen(o => !o)}>
              Saved ({savedSearches.length}) {savedOpen ? '▾' : '▸'}
            </button>
          </div>
          {savedOpen && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {savedSearches.length === 0 && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>No saved searches yet — set your filters, then ★ Save.</span>
              )}
              {savedSearches.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    onClick={() => applySavedSearch(s)}
                    style={{ flex: 1, textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(215,255,0,0.25)', background: 'rgba(215,255,0,0.08)', color: '#D7FF00', fontSize: 12, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => persistSaved(savedSearches.filter(x => x.name !== s.name))}
                    title="Delete saved search"
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
            {applied.city.includes('new capital') && (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="ph-delivery-info">📅 <span>{r.delivery || '—'}</span></span>
                      <div style={{ position: 'relative' }}>
                        <button
                          className={`ph-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                          onClick={e => handleCopy(e, r, idx)}
                          title="نسخ الرسالة التسويقية"
                        >
                          {copiedIdx === idx ? '✓' : '📋'}
                        </button>
                        {pickerOpen === idx && (() => {
                          const allPlans = String(r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
                          const avFields = getAvailableFields(r)
                          return (
                            <>
                              <div className="ph-picker-backdrop" onClick={e => { e.stopPropagation(); setPickerOpen(null) }} />
                              <div className="ph-plan-picker" onClick={e => e.stopPropagation()}>
                                <div className="ph-picker-title">محتوى الرسالة</div>
                                {avFields.length > 0 && (
                                  <>
                                    <div className="ph-picker-section-row">
                                      <div className="ph-picker-section">تفاصيل</div>
                                      <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerFields, pickerFields, avFields)}>{t('pvSelectAll')}</button>
                                      <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerFields, pickerFields, [])}>{t('pvDeselectAll')}</button>
                                    </div>
                                    {avFields.map(field => (
                                      <label key={field} className="ph-picker-option">
                                        <input
                                          type="checkbox"
                                          checked={pickerFields.includes(field)}
                                          onChange={() => setWithUndo(record, setPickerFields, pickerFields,
                                            pickerFields.includes(field) ? pickerFields.filter(f => f !== field) : [...pickerFields, field]
                                          )}
                                        />
                                        <span>{FIELD_LABELS[field]}: {fieldValueLabel(r, field)}</span>
                                      </label>
                                    ))}
                                  </>
                                )}
                                {allPlans.length > 0 && (
                                  <>
                                    <div className="ph-picker-section-row">
                                      <div className="ph-picker-section">أنظمة السداد</div>
                                      <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerPlans, pickerPlans, allPlans)}>{t('pvSelectAll')}</button>
                                      <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerPlans, pickerPlans, [])}>{t('pvDeselectAll')}</button>
                                    </div>
                                    {allPlans.map((plan, pi) => (
                                      <label key={pi} className="ph-picker-option">
                                        <input
                                          type="checkbox"
                                          checked={pickerPlans.includes(plan)}
                                          onChange={() => setWithUndo(record, setPickerPlans, pickerPlans,
                                            pickerPlans.includes(plan) ? pickerPlans.filter(p => p !== plan) : [...pickerPlans, plan]
                                          )}
                                        />
                                        <span>{plan}</span>
                                      </label>
                                    ))}
                                  </>
                                )}
                                <button className="ph-picker-copy-btn" onClick={e => handlePickerCopy(e, r, idx)}>
                                  نسخ
                                </button>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
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
                  <div className="ph-list-action">
                    <div style={{ position: 'relative' }}>
                      <button
                        className={`ph-copy-btn${copiedIdx === idx ? ' copied' : ''}`}
                        onClick={e => handleCopy(e, r, idx)}
                        title="نسخ الرسالة التسويقية"
                      >
                        {copiedIdx === idx ? '✓' : '📋'}
                      </button>
                      {pickerOpen === idx && (() => {
                        const allPlans = String(r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
                        const avFields = getAvailableFields(r)
                        return (
                          <>
                            <div className="ph-picker-backdrop" onClick={e => { e.stopPropagation(); setPickerOpen(null) }} />
                            <div className="ph-plan-picker" onClick={e => e.stopPropagation()}>
                              <div className="ph-picker-title">محتوى الرسالة</div>
                              {avFields.length > 0 && (
                                <>
                                  <div className="ph-picker-section-row">
                                    <div className="ph-picker-section">تفاصيل</div>
                                    <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerFields, pickerFields, avFields)}>{t('pvSelectAll')}</button>
                                    <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerFields, pickerFields, [])}>{t('pvDeselectAll')}</button>
                                  </div>
                                  {avFields.map(field => (
                                    <label key={field} className="ph-picker-option">
                                      <input
                                        type="checkbox"
                                        checked={pickerFields.includes(field)}
                                        onChange={() => setWithUndo(record, setPickerFields, pickerFields,
                                          pickerFields.includes(field) ? pickerFields.filter(f => f !== field) : [...pickerFields, field]
                                        )}
                                      />
                                      <span>{FIELD_LABELS[field]}: {fieldValueLabel(r, field)}</span>
                                    </label>
                                  ))}
                                </>
                              )}
                              {allPlans.length > 0 && (
                                <>
                                  <div className="ph-picker-section-row">
                                    <div className="ph-picker-section">أنظمة السداد</div>
                                    <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerPlans, pickerPlans, allPlans)}>{t('pvSelectAll')}</button>
                                    <button type="button" className="ph-picker-select-all" onClick={() => setWithUndo(record, setPickerPlans, pickerPlans, [])}>{t('pvDeselectAll')}</button>
                                  </div>
                                  {allPlans.map((plan, pi) => (
                                    <label key={pi} className="ph-picker-option">
                                      <input
                                        type="checkbox"
                                        checked={pickerPlans.includes(plan)}
                                        onChange={() => setWithUndo(record, setPickerPlans, pickerPlans,
                                          pickerPlans.includes(plan) ? pickerPlans.filter(p => p !== plan) : [...pickerPlans, plan]
                                        )}
                                      />
                                      <span>{plan}</span>
                                    </label>
                                  ))}
                                </>
                              )}
                              <button className="ph-picker-copy-btn" onClick={e => handlePickerCopy(e, r, idx)}>
                                نسخ
                              </button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <span>›</span>
                  </div>
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
              const plans = String(r.plans || '').split('|').map(s => s.trim()).filter(Boolean)
              const contacts = String(r.contact || '').split('|').map(s => s.trim()).filter(Boolean)
              const phones = String(r.phone || '').split('|').map(s => s.trim()).filter(Boolean)
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
                      <button
                        className={`ph-copy-modal-btn${copiedModal ? ' copied' : ''}`}
                        onClick={() => handleCopyModal(r)}
                      >
                        {copiedModal ? '✓ تم النسخ' : '📋 نسخ الرسالة'}
                      </button>
                      <button className="ph-modal-close" onClick={() => setSelectedIdx(null)}>×</button>
                    </div>
                  </div>

                  <div className="ph-modal-body">
                    <div style={{ marginBottom: '18px' }}>
                      <div className="ph-modal-price-big">{r.price ? 'EGP ' + fmtFull(r.price) : '—'}</div>
                      {r.ppsqm ? <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>{fmtFull(r.ppsqm)} EGP per m²</div> : null}
                    </div>

                    <div className="ph-modal-select-all-row">
                      <button type="button" className="ph-picker-select-all" onClick={() => updateModalFields(getAvailableFields(r))}>{t('pvSelectAll')}</button>
                      <button type="button" className="ph-picker-select-all" onClick={() => updateModalFields([])}>{t('pvDeselectAll')}</button>
                    </div>
                    <div className="ph-modal-grid">
                      {/* Checkable fields */}
                      {(['code','phase','floor'] as const).map(field => {
                        const val = field === 'floor'
                          ? (r.floor !== '' && r.floor !== undefined ? r.floor : null)
                          : r[field]
                        if (!val) return null
                        const label = field === 'code' ? 'Unit Code' : field === 'phase' ? 'Phase / Building' : 'Floor'
                        return (
                          <label key={field} className="ph-modal-field ph-modal-field-selectable">
                            <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes(field)}
                              onChange={() => updateModalFields(modalFields.includes(field) ? modalFields.filter(x => x !== field) : [...modalFields, field])} />
                            <div className="f-label">{label}</div>
                            <div className="f-value">{val}</div>
                          </label>
                        )
                      })}
                      {/* Always-in-header fields — no checkbox */}
                      <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Bedrooms</div><div className="f-value">{r.beds || '—'}</div></div>
                      {/* Area */}
                      {r.area ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('area')}
                            onChange={() => updateModalFields(modalFields.includes('area') ? modalFields.filter(x => x !== 'area') : [...modalFields, 'area'])} />
                          <div className="f-label">Area</div>
                          <div className="f-value">{r.area} m²</div>
                        </label>
                      ) : null}
                      {parseFloat(String(r.garden)) > 0 && (
                        <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Garden Area</div><div className="f-value">{r.garden} m²</div></div>
                      )}
                      {parseFloat(String(r.roof)) > 0 && (
                        <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Roof Area</div><div className="f-value">{r.roof} m²</div></div>
                      )}
                      {/* Always-in-header — no checkbox */}
                      <div className="ph-modal-field ph-modal-field-fixed">
                        <div className="f-label">Finishing</div>
                        <div className="f-value"><span className={`ph-finish-badge ${finishClass(r.finish)}`}>{r.finish || '—'}</span></div>
                      </div>
                      {/* Checkable detail fields */}
                      {r.delivery ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('delivery')}
                            onChange={() => updateModalFields(modalFields.includes('delivery') ? modalFields.filter(x => x !== 'delivery') : [...modalFields, 'delivery'])} />
                          <div className="f-label">Delivery</div>
                          <div className="f-value">{r.delivery}</div>
                        </label>
                      ) : <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Delivery</div><div className="f-value">—</div></div>}
                      {parseFloat(String(r.discount)) > 0 ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('discount')}
                            onChange={() => updateModalFields(modalFields.includes('discount') ? modalFields.filter(x => x !== 'discount') : [...modalFields, 'discount'])} />
                          <div className="f-label">Cash Discount</div>
                          <div className="f-value" style={{ color: '#22c55e' }}>{parseFloat(String(r.discount)) > 99 ? 'EGP ' + fmtFull(r.discount) : r.discount + '%'}</div>
                        </label>
                      ) : <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Cash Discount</div><div className="f-value" style={{ color: '#22c55e' }}>—</div></div>}
                      {parseFloat(String(r.maint)) > 0 ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('maint')}
                            onChange={() => updateModalFields(modalFields.includes('maint') ? modalFields.filter(x => x !== 'maint') : [...modalFields, 'maint'])} />
                          <div className="f-label">Maintenance</div>
                          <div className="f-value">{r.maint}%</div>
                        </label>
                      ) : <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Maintenance</div><div className="f-value">—</div></div>}
                      {r.parking && String(r.parking) !== '—' ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('parking')}
                            onChange={() => updateModalFields(modalFields.includes('parking') ? modalFields.filter(x => x !== 'parking') : [...modalFields, 'parking'])} />
                          <div className="f-label">Parking</div>
                          <div className="f-value">{r.parking}</div>
                        </label>
                      ) : <div className="ph-modal-field ph-modal-field-fixed"><div className="f-label">Parking</div><div className="f-value">—</div></div>}
                      {/* Price — checkable, shown in grid for completeness */}
                      {r.price ? (
                        <label className="ph-modal-field ph-modal-field-selectable">
                          <input type="checkbox" className="ph-modal-field-check" checked={modalFields.includes('price')}
                            onChange={() => updateModalFields(modalFields.includes('price') ? modalFields.filter(x => x !== 'price') : [...modalFields, 'price'])} />
                          <div className="f-label">Price (EGP)</div>
                          <div className="f-value">{fmtFull(r.price)}</div>
                        </label>
                      ) : null}
                    </div>

                    {plans.length > 0 && (
                      <div className="ph-modal-section">
                        <h4>💳 Payment Plans</h4>
                        <div className="ph-modal-select-all-row">
                          <button type="button" className="ph-picker-select-all" onClick={() => updateModalPlans(plans)}>{t('pvSelectAll')}</button>
                          <button type="button" className="ph-picker-select-all" onClick={() => updateModalPlans([])}>{t('pvDeselectAll')}</button>
                        </div>
                        <div className="ph-modal-plan-check">
                          {plans.map((p, i) => (
                            <label key={i} className="ph-modal-plan-option">
                              <input
                                type="checkbox"
                                checked={modalPlanSelected.includes(p)}
                                onChange={() => updateModalPlans(
                                  modalPlanSelected.includes(p) ? modalPlanSelected.filter(x => x !== p) : [...modalPlanSelected, p]
                                )}
                              />
                              <span>{p}</span>
                            </label>
                          ))}
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

    </div>
  )
}
