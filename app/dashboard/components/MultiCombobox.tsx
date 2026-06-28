'use client'

import { useState, useEffect, useRef } from 'react'

export default function MultiCombobox({ value, onChange, options, placeholder }: {
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
