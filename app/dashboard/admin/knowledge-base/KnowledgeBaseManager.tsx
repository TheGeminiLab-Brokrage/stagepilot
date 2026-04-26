'use client'

import { useState, useCallback } from 'react'

type Category = 'clinic_project' | 'product_fact' | 'common_question'

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
  { id: 'dr_yasmine', label: 'Dr. Yasmine' },
  { id: 'eng_khaled', label: 'Eng. Khaled' },
  { id: 'mrs_nadia', label: 'Mrs. Nadia' },
  { id: 'dr_mariam', label: 'Dr. Mariam' },
  { id: 'mr_tarek', label: 'Mr. Tarek' },
  { id: 'general_knowledge_clinics', label: 'General Knowledge' },
  { id: 'sales_knowledge_assistant_demo', label: 'Sales Knowledge Demo' },
]

const CATEGORY_LABELS: Record<Category, string> = {
  clinic_project: 'Clinic Projects',
  product_fact: 'Product Facts',
  common_question: 'Common Questions',
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

export default function KnowledgeBaseManager({ initialEntries }: { initialEntries: Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [activeTab, setActiveTab] = useState<Category>('clinic_project')
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

  const filtered = entries.filter((e) => e.category === activeTab)

  const openAdd = () => {
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
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className="px-4 py-2.5 text-xs font-semibold uppercase transition-all"
            style={{
              letterSpacing: '0.07em',
              fontFamily: "'Space Grotesk', sans-serif",
              color: activeTab === cat ? '#D7FF00' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === cat ? '2px solid #D7FF00' : '2px solid transparent',
              background: 'transparent',
              marginBottom: '-1px',
            }}
          >
            {CATEGORY_LABELS[cat]}
            <span
              className="ml-2 px-1.5 py-0.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            >
              {tabCounts[cat]}
            </span>
          </button>
        ))}
      </div>

      {/* Table header + Add button */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          {activeTab === 'clinic_project' && 'Searched in real-time by the AI during sessions.'}
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
          }}
        >
          + Add Entry
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-600">
            No {CATEGORY_LABELS[activeTab].toLowerCase()} yet. Click &ldquo;+ Add Entry&rdquo; to add the first one.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Content</th>
                {activeTab !== 'clinic_project' && (
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Scenarios</th>
                )}
                <th className="text-center px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr
                  key={entry.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <td className="px-4 py-3 font-medium text-white" style={{ maxWidth: '160px' }}>
                    {entry.title}
                  </td>
                  <td className="px-4 py-3 text-gray-400" style={{ maxWidth: '260px' }}>
                    <span className="block truncate">{entry.content}</span>
                  </td>
                  {activeTab !== 'clinic_project' && (
                    <td className="px-4 py-3 text-gray-500">
                      {entry.scenario_ids && entry.scenario_ids.length > 0
                        ? entry.scenario_ids.map((id) => SCENARIOS.find((s) => s.id === id)?.label ?? id).join(', ')
                        : 'All'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      className="w-8 h-4 rounded-full transition-all relative"
                      style={{
                        background: entry.is_active ? 'rgba(215,255,0,0.3)' : 'rgba(255,255,255,0.1)',
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
                      style={{ color: 'rgba(215,255,0,0.6)', background: 'rgba(215,255,0,0.05)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.05)')}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                      className="text-xs px-2 py-1 rounded transition-all disabled:opacity-40"
                      style={{ color: 'rgba(239,68,68,0.7)', background: 'rgba(239,68,68,0.05)' }}
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
                  <label className="block text-xs text-gray-500 mb-2">Applies to Scenarios (leave empty for all)</label>
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
    </>
  )
}
