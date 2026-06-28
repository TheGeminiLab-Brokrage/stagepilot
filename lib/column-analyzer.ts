import type { RawRow } from './excel-parser'

export type ColumnType = 'categorical' | 'numeric' | 'year' | 'text'

export interface ColumnMeta {
  key: string
  label: string
  type: ColumnType
  uniqueValues?: string[]
  min?: number
  max?: number
  years?: number[]
}

const YEAR_REGEX = /^(19|20)\d{2}$/
const CATEGORICAL_MAX_UNIQUE = 30

export function analyzeColumns(rows: RawRow[], headers: string[]): ColumnMeta[] {
  return headers.map(key => {
    const rawValues = rows.map(r => r[key]).filter(v => v !== null && v !== '')
    if (rawValues.length === 0) return { key, label: key, type: 'text' as ColumnType }

    const asStrings = rawValues.map(v => String(v).trim())

    // Year detection: all values are 4-digit years
    if (asStrings.every(s => YEAR_REGEX.test(s))) {
      const years = [...new Set(asStrings.map(Number))].sort((a, b) => a - b)
      return { key, label: key, type: 'year', years }
    }

    // Numeric detection: all values parse as float
    const asNums = rawValues.map(v => parseFloat(String(v).replace(/,/g, '')))
    if (asNums.every(n => !isNaN(n))) {
      return {
        key,
        label: key,
        type: 'numeric',
        min: Math.min(...asNums),
        max: Math.max(...asNums),
      }
    }

    // Categorical: low unique count
    const unique = [...new Set(asStrings)].sort()
    if (unique.length <= CATEGORICAL_MAX_UNIQUE) {
      return { key, label: key, type: 'categorical', uniqueValues: unique }
    }

    return { key, label: key, type: 'text' }
  })
}

// Merges column metadata from multiple sheets. Union of all keys;
// type conflicts resolved by priority: numeric > year > categorical > text.
export function mergeColumnMeta(metaArrays: ColumnMeta[][]): ColumnMeta[] {
  const TYPE_PRIORITY: Record<ColumnType, number> = {
    numeric: 4, year: 3, categorical: 2, text: 1,
  }
  const map = new Map<string, ColumnMeta>()

  for (const metas of metaArrays) {
    for (const col of metas) {
      const existing = map.get(col.key)
      if (!existing) {
        map.set(col.key, { ...col })
        continue
      }
      if (TYPE_PRIORITY[col.type] > TYPE_PRIORITY[existing.type]) {
        map.set(col.key, { ...col })
      } else if (col.type === existing.type) {
        // Merge ranges / value sets
        if (col.type === 'numeric' && existing.type === 'numeric') {
          map.set(col.key, {
            ...existing,
            min: Math.min(existing.min!, col.min!),
            max: Math.max(existing.max!, col.max!),
          })
        } else if (col.type === 'year' && existing.type === 'year') {
          const merged = [...new Set([...(existing.years ?? []), ...(col.years ?? [])])].sort((a, b) => a - b)
          map.set(col.key, { ...existing, years: merged })
        } else if (col.type === 'categorical' && existing.type === 'categorical') {
          const merged = [...new Set([...(existing.uniqueValues ?? []), ...(col.uniqueValues ?? [])])].sort()
          if (merged.length <= CATEGORICAL_MAX_UNIQUE) {
            map.set(col.key, { ...existing, uniqueValues: merged })
          } else {
            map.set(col.key, { key: col.key, label: col.label, type: 'text' })
          }
        }
      }
    }
  }

  return [...map.values()]
}
