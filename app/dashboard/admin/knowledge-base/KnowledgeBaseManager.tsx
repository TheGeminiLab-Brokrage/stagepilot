'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      className="inline-flex items-center"
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect()
        if (r) setRect({ top: r.top, left: r.left, width: r.width })
      }}
      onMouseLeave={() => setRect(null)}
      style={{ cursor: 'default' }}
    >
      {children}
      {rect && (
        <span
          className="pointer-events-none text-xs rounded-lg px-3 py-2"
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left + rect.width / 2,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            background: '#1c1c1c',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'rgba(255,255,255,0.8)',
            whiteSpace: 'normal',
            width: '220px',
            lineHeight: '1.55',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function InfoIcon({ tip }: { tip: string }) {
  return (
    <Tooltip text={tip}>
      <span
        className="ml-1 inline-flex items-center justify-center rounded-full text-xs font-bold"
        style={{
          width: '14px',
          height: '14px',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '9px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        i
      </span>
    </Tooltip>
  )
}

type Category = 'clinic_project' | 'product_fact' | 'common_question'
type MainTab = Category | 'sheet_connections'

interface Entry {
  id: string
  category: Category
  title: string
  content: string
  scenario_ids: string[] | null
  tags: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ClinicFields {
  developer: string
  projectName: string
  location: string
  size: string
  price: string
  pricePerSqm: string
  delivery: string
  down: string
  install: string
}

const SCENARIOS = [
  { id: 'dr_yasmine',            label: 'Dr. Yasmine' },
  { id: 'dr_mariam',             label: 'Dr. Mariam' },
  { id: 'mohammed_tgl',          label: 'محمد — TGL Strategist' },
  { id: 'mohammed_madinet_masr', label: 'محمد — Madinet Masr' },
  { id: 'mona_hassan',           label: 'منى حسن' },
  { id: 'ali',                   label: 'علي' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  clinic_project: 'Clinic Projects',
  product_fact: 'Product Facts',
  common_question: 'Common Questions',
}

const VISIBLE_TABS: Category[] = ['product_fact', 'common_question']

const CATEGORY_TIPS: Record<Category, string> = {
  clinic_project: 'Real project data the AI searches in real time during a session — not baked into the prompt. Managed via Google Sheets.',
  product_fact: 'Injected into the AI\'s memory at session start. Use for pricing rules, policies, or facts that apply across conversations.',
  common_question: 'Injected into buyer-persona prompts so the AI-as-client asks realistic questions during practice sessions.',
}

function parseClinicContent(content: string): ClinicFields {
  const parts = content.split(' | ')
  return {
    developer: parts[0] ?? '',
    projectName: parts[1] ?? '',
    location: parts[2] ?? '',
    size: parts[3] ?? '',
    price: parts[4] ?? '',
    pricePerSqm: parts[5] ?? '',
    delivery: (parts[6] ?? '').replace('Delivery: ', ''),
    down: (parts[7] ?? '').replace('Down: ', ''),
    install: (parts[8] ?? '').replace('Install: ', ''),
  }
}

function buildClinicContent(f: ClinicFields): string {
  return [
    f.developer,
    f.projectName,
    f.location,
    f.size,
    f.price,
    f.pricePerSqm,
    `Delivery: ${f.delivery}`,
    `Down: ${f.down}`,
    `Install: ${f.install}`,
  ].join(' | ')
}

const emptyClinic: ClinicFields = {
  developer: '', projectName: '', location: '', size: '', price: '', pricePerSqm: '', delivery: '', down: '', install: '',
}

// ─── Sheet Connections ──────────────────────────────────────────────────────

interface SheetConnection {
  id: string
  name: string
  sheet_id: string
  tab_name: string
  scenario_ids: string[]
  category: Category
  column_mapping: Record<string, string>
  is_active: boolean
  last_synced_at: string | null
  last_sync_result: { synced: number; skipped: number; deactivated: number; error?: string } | null
  created_at: string
}

const CLINIC_FIELDS: { key: string; label: string }[] = [
  { key: 'developer', label: 'Developer' },
  { key: 'projectName', label: 'Project Name' },
  { key: 'location', label: 'Location' },
  { key: 'size', label: 'Size' },
  { key: 'price', label: 'Price' },
  { key: 'pricePerSqm', label: 'Price/m²' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'down', label: 'Down Payment' },
  { key: 'install', label: 'Installments' },
]

const TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'content', label: 'Content' },
]

function categoryFields(cat: Category) {
  return cat === 'clinic_project' ? CLINIC_FIELDS : TEXT_FIELDS
}

function SheetConnectionsPanel() {
  const [connections, setConnections] = useState<SheetConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Wizard state
  const [step, setStep] = useState(1)
  const [wizardName, setWizardName] = useState('')
  const [wizardUrl, setWizardUrl] = useState('')
  const [wizardTabs, setWizardTabs] = useState<string[]>([])
  const [wizardTab, setWizardTab] = useState('')
  const [wizardCategory, setWizardCategory] = useState<Category>('clinic_project')
  const [wizardScenarios, setWizardScenarios] = useState<string[]>([])
  const [wizardHeaderRow, setWizardHeaderRow] = useState(1)
  const [wizardHeaders, setWizardHeaders] = useState<string[]>([])
  const [wizardMapping, setWizardMapping] = useState<Record<string, string>>({})
  const [wizardServiceEmail, setWizardServiceEmail] = useState('')
  const [wizardError, setWizardError] = useState('')
  const [wizardLoading, setWizardLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/sheet-connections')
      .then((r) => r.json())
      .then((d) => setConnections(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const openModal = () => {
    setStep(1)
    setWizardName('')
    setWizardUrl('')
    setWizardTabs([])
    setWizardTab('')
    setWizardCategory('clinic_project')
    setWizardScenarios([])
    setWizardHeaderRow(1)
    setWizardHeaders([])
    setWizardMapping({})
    setWizardServiceEmail('')
    setWizardError('')
    setShowModal(true)
  }

  const fetchTabs = async () => {
    setWizardLoading(true)
    setWizardError('')
    try {
      const res = await fetch('/api/admin/sheet-connections/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_url: wizardUrl }),
      })
      const data = await res.json()
      if (data.error) { setWizardError(data.error); return }
      setWizardServiceEmail(data.service_account_email ?? '')
      setWizardTabs(data.tabs ?? [])
      if (data.tabs?.length === 1) setWizardTab(data.tabs[0])
      setStep(2)
    } finally {
      setWizardLoading(false)
    }
  }

  const fetchHeaders = async () => {
    setWizardLoading(true)
    setWizardError('')
    try {
      const res = await fetch('/api/admin/sheet-connections/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet_url: wizardUrl, tab_name: wizardTab, header_row: wizardHeaderRow }),
      })
      const data = await res.json()
      if (data.error) { setWizardError(data.error); return }
      setWizardHeaders(data.headers ?? [])
      setWizardMapping({})
      setStep(3)
    } finally {
      setWizardLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/sheet-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizardName,
          sheet_url: wizardUrl,
          tab_name: wizardTab,
          header_row: wizardHeaderRow,
          scenario_ids: wizardScenarios,
          category: wizardCategory,
          column_mapping: wizardMapping,
        }),
      })
      const data = await res.json()
      if (data.error) { setWizardError(data.error); return }
      setConnections((prev) => [data, ...prev])
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async (id: string) => {
    setSyncing(id)
    try {
      const res = await fetch(`/api/admin/sheet-connections/${id}/sync`, { method: 'POST' })
      const result = await res.json()
      setConnections((prev) =>
        prev.map((c) => c.id === id ? { ...c, last_synced_at: new Date().toISOString(), last_sync_result: result } : c)
      )
    } finally {
      setSyncing(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this sheet connection? Entries synced from it will be marked inactive.')) return
    setDeleting(id)
    try {
      await fetch(`/api/admin/sheet-connections/${id}`, { method: 'DELETE' })
      setConnections((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleToggle = async (conn: SheetConnection) => {
    setConnections((prev) => prev.map((c) => c.id === conn.id ? { ...c, is_active: !conn.is_active } : c))
    const res = await fetch(`/api/admin/sheet-connections/${conn.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !conn.is_active }),
    })
    const updated = await res.json()
    setConnections((prev) => prev.map((c) => c.id === conn.id ? updated : c))
  }

  const inputStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }
  const accentStyle = { background: '#D7FF00', color: '#000', fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer' as const }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Connect existing Google Sheets — data syncs automatically every 15 min.</p>
        <button onClick={openModal} className="px-4 py-2 rounded-lg text-xs font-bold" style={accentStyle}>
          + Connect Sheet
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)' }}>
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-600">Loading…</div>
        ) : connections.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-600">
            No sheets connected yet. Click &ldquo;+ Connect Sheet&rdquo; to link your first Google Sheet.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgba(215,255,0,0.12)] text-xs uppercase tracking-wide" style={{ color: 'rgba(215,255,0,0.4)' }}>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Tab</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold">Last Sync</th>
                <th className="text-center px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {connections.map((conn, i) => {
                const syncRes = conn.last_sync_result
                return (
                  <tr key={conn.id} className="hover:bg-[rgba(215,255,0,0.04)] transition-colors" style={{ borderBottom: i < connections.length - 1 ? '1px solid rgba(215,255,0,0.06)' : 'none' }}>
                    <td className="px-4 py-3 font-medium text-white">{conn.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono">{conn.tab_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                        {CATEGORY_LABELS[conn.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {conn.last_synced_at ? (
                        <div>
                          <span className="text-gray-400">{new Date(conn.last_synced_at).toLocaleString()}</span>
                          {syncRes && (
                            <div className="mt-0.5" style={{ color: syncRes.error ? 'rgba(239,68,68,0.7)' : 'rgba(215,255,0,0.55)' }}>
                              {syncRes.error ? `Error: ${syncRes.error.slice(0, 60)}` : `↑ ${syncRes.synced} synced · ↓ ${syncRes.deactivated} removed`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(conn)}
                        className="w-8 h-4 rounded-full transition-all relative"
                        style={{ background: conn.is_active ? 'rgba(215,255,0,0.3)' : 'rgba(255,255,255,0.1)', cursor: 'pointer' }}
                      >
                        <span
                          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                          style={{ left: conn.is_active ? '18px' : '2px', background: conn.is_active ? '#D7FF00' : 'rgba(255,255,255,0.3)' }}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                        className="text-xs px-2 py-1 rounded mr-1 transition-all disabled:opacity-40"
                        style={{ color: 'rgba(215,255,0,0.6)', background: 'rgba(215,255,0,0.05)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.05)')}
                      >
                        {syncing === conn.id ? '⟳ Syncing…' : '⟳ Sync'}
                      </button>
                      <button
                        onClick={() => handleDelete(conn.id)}
                        disabled={deleting === conn.id}
                        className="text-xs px-2 py-1 rounded transition-all disabled:opacity-40"
                        style={{ color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.05)', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.05)')}
                      >
                        {deleting === conn.id ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Connect Sheet Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-lg rounded-xl p-6 overflow-y-auto" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}>
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-5">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{
                      background: step >= s ? '#D7FF00' : 'rgba(255,255,255,0.08)',
                      color: step >= s ? '#000' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {s}
                  </span>
                  {s < 3 && <div className="w-6 h-px" style={{ background: step > s ? '#D7FF00' : 'rgba(255,255,255,0.1)' }} />}
                </div>
              ))}
              <span className="ml-2 text-xs text-gray-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {step === 1 ? 'Sheet URL' : step === 2 ? 'Tab & Settings' : 'Column Mapping'}
              </span>
            </div>

            {/* Step 1: URL + name */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Connection Name</label>
                  <input
                    value={wizardName}
                    onChange={(e) => setWizardName(e.target.value)}
                    placeholder="e.g. Clinic Listings Q2 2026"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Google Sheet URL</label>
                  <input
                    value={wizardUrl}
                    onChange={(e) => setWizardUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                {wizardServiceEmail && (
                  <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(215,255,0,0.04)', border: '1px solid rgba(215,255,0,0.15)', color: 'rgba(215,255,0,0.7)' }}>
                    <p className="font-semibold mb-1">Share your sheet with this email:</p>
                    <p className="font-mono break-all" style={{ color: '#D7FF00' }}>{wizardServiceEmail}</p>
                    <p className="mt-1 text-gray-500">In Google Sheets → Share → paste the email above → Viewer access is enough.</p>
                  </div>
                )}
                {wizardError && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}>
                    {wizardError}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-xs text-gray-400" style={inputStyle}>Cancel</button>
                  <button
                    onClick={fetchTabs}
                    disabled={!wizardUrl || !wizardName || wizardLoading}
                    className="px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={accentStyle}
                  >
                    {wizardLoading ? 'Fetching…' : 'Next →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Tab, category, scenarios */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sheet Tab</label>
                  <select
                    value={wizardTab}
                    onChange={(e) => setWizardTab(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="">Select tab…</option>
                    {wizardTabs.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Header Row <span className="text-gray-600">(which row has the column names?)</span></label>
                  <input
                    type="number"
                    min={1}
                    value={wizardHeaderRow}
                    onChange={(e) => setWizardHeaderRow(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Data Category</label>
                  <div className="flex gap-2">
                    {(['clinic_project', 'product_fact', 'common_question'] as Category[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setWizardCategory(cat)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: wizardCategory === cat ? 'rgba(215,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                          border: wizardCategory === cat ? '1px solid rgba(215,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                          color: wizardCategory === cat ? '#D7FF00' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Assign to Scenarios <span className="text-gray-600">(leave empty for all)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS.map((s) => {
                      const sel = wizardScenarios.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setWizardScenarios((p) => sel ? p.filter((id) => id !== s.id) : [...p, s.id])}
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            background: sel ? 'rgba(215,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                            border: sel ? '1px solid rgba(215,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            color: sel ? '#D7FF00' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {wizardError && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}>
                    {wizardError}
                  </p>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-xs text-gray-400" style={inputStyle}>← Back</button>
                  <button
                    onClick={fetchHeaders}
                    disabled={!wizardTab || wizardLoading}
                    className="px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={accentStyle}
                  >
                    {wizardLoading ? 'Loading headers…' : 'Next →'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Column mapping */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Map each field to the matching column in your sheet. Leave a field blank to skip it.
                </p>
                <div className="space-y-2">
                  {categoryFields(wizardCategory).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
                      <select
                        value={wizardMapping[key] ?? ''}
                        onChange={(e) => setWizardMapping((p) => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                        style={inputStyle}
                      >
                        <option value="" style={{ color: '#000' }}>— skip —</option>
                        {wizardHeaders.map((h) => <option key={h} value={h} style={{ color: '#000' }}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {wizardError && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}>
                    {wizardError}
                  </p>
                )}
                <div className="flex justify-between gap-2 pt-2">
                  <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg text-xs text-gray-400" style={inputStyle}>← Back</button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={accentStyle}
                  >
                    {saving ? 'Saving & Syncing…' : 'Save & Sync Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function KnowledgeBaseManager({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [activeTab, setActiveTab] = useState<MainTab>('product_fact')
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formScenarioIds, setFormScenarioIds] = useState<string[]>([])
  const [formClinic, setFormClinic] = useState<ClinicFields>(emptyClinic)
  const [formIsActive, setFormIsActive] = useState(true)

  const filtered = entries.filter((e) => activeTab !== 'sheet_connections' && e.category === activeTab)

  const openAdd = () => {
    if (activeTab === 'sheet_connections') return
    setEditingEntry(null)
    setFormTitle('')
    setFormContent('')
    setFormScenarioIds([])
    setFormClinic(emptyClinic)
    setFormIsActive(true)
    setShowModal(true)
  }

  const openEdit = (entry: Entry) => {
    setEditingEntry(entry)
    setFormTitle(entry.title)
    setFormContent(entry.content)
    setFormScenarioIds(entry.scenario_ids ?? [])
    setFormClinic(entry.category === 'clinic_project' ? parseClinicContent(entry.content) : emptyClinic)
    setFormIsActive(entry.is_active)
    setShowModal(true)
  }

  const handleSave = useCallback(async () => {
    if (activeTab === 'sheet_connections') return
    setSaving(true)
    const content = activeTab === 'clinic_project' ? buildClinicContent(formClinic) : formContent
    const title = activeTab === 'clinic_project' ? formClinic.projectName || formTitle : formTitle
    const body = {
      category: activeTab,
      title,
      content,
      scenario_ids: formScenarioIds.length > 0 ? formScenarioIds : null,
      is_active: formIsActive,
    }

    try {
      if (editingEntry) {
        const res = await fetch(`/api/admin/knowledge-entries/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const updated = await res.json()
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? updated : e)))
      } else {
        const res = await fetch('/api/admin/knowledge-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const created = await res.json()
        setEntries((prev) => [...prev, created])
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }, [activeTab, editingEntry, formTitle, formContent, formClinic, formScenarioIds, formIsActive])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this entry? The AI will no longer use it.')) return
    setDeleting(id)
    try {
      await fetch(`/api/admin/knowledge-entries/${id}`, { method: 'DELETE' })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setDeleting(null)
    }
  }, [])

  const handleToggleActive = useCallback(async (entry: Entry) => {
    setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, is_active: !e.is_active } : e))
    const res = await fetch(`/api/admin/knowledge-entries/${entry.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !entry.is_active }),
    })
    const updated = await res.json()
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
  }, [])

  const tabCounts = {
    clinic_project: entries.filter((e) => e.category === 'clinic_project').length,
    product_fact: entries.filter((e) => e.category === 'product_fact').length,
    common_question: entries.filter((e) => e.category === 'common_question').length,
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {VISIBLE_TABS.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className="px-4 py-2.5 text-xs font-semibold uppercase transition-all flex items-center gap-1"
            style={{
              letterSpacing: '0.07em',
              fontFamily: "'Space Grotesk', sans-serif",
              color: activeTab === cat ? '#D7FF00' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === cat ? '2px solid #D7FF00' : '2px solid transparent',
              background: 'transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
            }}
          >
            {CATEGORY_LABELS[cat]}
            <span
              className="ml-1 px-1.5 py-0.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            >
              {tabCounts[cat]}
            </span>
            <InfoIcon tip={CATEGORY_TIPS[cat]} />
          </button>
        ))}
        <button
          onClick={() => setActiveTab('sheet_connections')}
          className="px-4 py-2.5 text-xs font-semibold uppercase transition-all flex items-center gap-1.5"
          style={{
            letterSpacing: '0.07em',
            fontFamily: "'Space Grotesk', sans-serif",
            color: activeTab === 'sheet_connections' ? '#D7FF00' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === 'sheet_connections' ? '2px solid #D7FF00' : '2px solid transparent',
            background: 'transparent',
            marginBottom: '-1px',
            cursor: 'pointer',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Google Sheets
          <InfoIcon tip="Connect existing Google Sheets to automatically populate the knowledge base. Each sheet tab can be assigned to specific scenarios. Syncs every 15 minutes." />
        </button>
      </div>

      {/* Sheet Connections panel */}
      {activeTab === 'sheet_connections' && <SheetConnectionsPanel />}

      {/* Knowledge entries UI — hidden when Google Sheets tab is active */}
      {activeTab !== 'sheet_connections' && <>

      {/* Table header + Add button */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          {activeTab === 'product_fact' && 'Injected into the system prompt at session start.'}
          {activeTab === 'common_question' && 'Injected into buyer persona prompts — the AI uses these as realistic client questions.'}
        </p>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: '#D7FF00',
            color: '#000',
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: 'pointer',
          }}
        >
          + Add Entry
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)' }}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-600">
            No {CATEGORY_LABELS[activeTab].toLowerCase()} yet. Click &ldquo;+ Add Entry&rdquo; to add the first one.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[rgba(215,255,0,0.12)] text-xs uppercase tracking-wide" style={{ color: 'rgba(215,255,0,0.4)' }}>
                <th className="text-left px-4 py-3 font-semibold">Title</th>
                <th className="text-left px-4 py-3 font-semibold">Content</th>
                <th className="text-left px-4 py-3 font-semibold">
                  <span className="flex items-center gap-0.5">
                    Scenarios
                    <InfoIcon tip="Which practice sessions include this entry. 'All' = no restriction, every session gets it. Restricted entries only appear in the selected personas." />
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-semibold">
                  <span className="flex items-center justify-center gap-0.5">
                    Active
                    <InfoIcon tip="On = AI uses this entry in sessions. Off = stored but never shown to the AI. Toggle to pause without deleting." />
                  </span>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  className="hover:bg-[rgba(215,255,0,0.04)] transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(215,255,0,0.06)' : 'none' }}
                >
                  <td className="px-4 py-3 font-medium text-white" style={{ maxWidth: '160px' }}>
                    {entry.title}
                  </td>
                  <td className="px-4 py-3 text-gray-400" style={{ maxWidth: '260px' }}>
                    <span className="block truncate">{entry.content}</span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.scenario_ids && entry.scenario_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.scenario_ids.map((id) => (
                          <span
                            key={id}
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              background: 'rgba(215,255,0,0.08)',
                              border: '1px solid rgba(215,255,0,0.25)',
                              color: 'rgba(215,255,0,0.7)',
                            }}
                          >
                            {SCENARIOS.find((s) => s.id === id)?.label ?? id}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        All
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      className="w-8 h-4 rounded-full transition-all relative"
                      style={{
                        background: entry.is_active ? 'rgba(215,255,0,0.3)' : 'rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                        style={{
                          left: entry.is_active ? '18px' : '2px',
                          background: entry.is_active ? '#D7FF00' : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(entry)}
                      className="text-xs px-2 py-1 rounded mr-1 transition-all"
                      style={{ color: 'rgba(215,255,0,0.6)', background: 'rgba(215,255,0,0.05)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.05)')}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                      className="text-xs px-2 py-1 rounded transition-all disabled:opacity-40"
                      style={{ color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.05)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.05)')}
                    >
                      {deleting === entry.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl p-6 overflow-y-auto"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh' }}
          >
            <h2 className="text-sm font-semibold text-white mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {editingEntry ? 'Edit Entry' : `Add ${CATEGORY_LABELS[activeTab]}`}
            </h2>

            {activeTab === 'clinic_project' ? (
              <div className="space-y-3">
                {[
                  { key: 'developer', label: 'Developer', placeholder: 'e.g. Albostany' },
                  { key: 'projectName', label: 'Project Name', placeholder: 'e.g. Nova Square' },
                  { key: 'location', label: 'Location', placeholder: 'e.g. النرجس الجديدة - محور جمال عبد الناصر' },
                  { key: 'size', label: 'Size', placeholder: 'e.g. 34 m²' },
                  { key: 'price', label: 'Price', placeholder: 'e.g. from 5,737,866 EGP' },
                  { key: 'pricePerSqm', label: 'Price/m²', placeholder: 'e.g. 168,800 EGP/m²' },
                  { key: 'delivery', label: 'Delivery', placeholder: 'e.g. 3 yrs' },
                  { key: 'down', label: 'Down Payment', placeholder: 'e.g. 10%' },
                  { key: 'install', label: 'Installments', placeholder: 'e.g. 6 yrs' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input
                      value={formClinic[key as keyof ClinicFields]}
                      onChange={(e) => setFormClinic((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                ))}
                <div className="mt-2 p-3 rounded-lg text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  Preview: <span className="text-gray-400">{buildClinicContent(formClinic)}</span>
                </div>
                <div className="mt-1">
                  <label className="flex items-center text-xs text-gray-500 mb-2">
                    Applies to Scenarios
                    <InfoIcon tip="Leave empty = this project is searchable in every session. Select specific personas to restrict it to only those sessions." />
                    <span className="ml-1 text-gray-600">(leave empty for all)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS.map((s) => {
                      const selected = formScenarioIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setFormScenarioIds((prev) =>
                              selected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            )
                          }
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            background: selected ? 'rgba(215,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                            border: selected ? '1px solid rgba(215,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            color: selected ? '#D7FF00' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={activeTab === 'common_question' ? 'e.g. What are the payment phases?' : 'e.g. Maintenance fee policy'}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {activeTab === 'common_question' ? 'Question (as the client would ask it)' : 'Content'}
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={4}
                    placeholder={
                      activeTab === 'common_question'
                        ? 'e.g. بالنسبة للتسليم، إيه الفرق بين الفيزة الأولى والتانية؟'
                        : 'e.g. Maintenance is 10% of unit price, charged annually.'
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs text-gray-500 mb-2">
                    Applies to Scenarios
                    <InfoIcon tip="Leave empty = this entry is available in every session. Select specific personas to restrict it to only those sessions." />
                    <span className="ml-1 text-gray-600">(leave empty for all)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS.map((s) => {
                      const selected = formScenarioIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setFormScenarioIds((prev) =>
                              selected ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            )
                          }
                          className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            background: selected ? 'rgba(215,255,0,0.15)' : 'rgba(255,255,255,0.05)',
                            border: selected ? '1px solid rgba(215,255,0,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            color: selected ? '#D7FF00' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="accent-yellow-300"
                />
                Active (visible to AI)
                <InfoIcon tip="Uncheck to temporarily hide this entry from the AI without deleting it. Useful for testing or seasonal content." />
              </label>
              <div className="flex-1" />
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs text-gray-400 transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                style={{ background: '#D7FF00', color: '#000', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {saving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </>
  )
}
