import * as XLSX from 'xlsx'

export type RawRow = Record<string, string | number | null>

export interface ParsedSheet {
  sheetName: string
  rows: RawRow[]
  headers: string[]
}

// Merged title/logo rows appear as one filled cell + many nulls.
// The real header row is the first row (within the first 10) that has the most filled cells.
function findHeaderRow(raw: unknown[][]): number {
  const limit = Math.min(10, raw.length)
  let bestRow = 0
  let bestCount = 0
  for (let i = 0; i < limit; i++) {
    const count = (raw[i] as unknown[]).filter(
      cell => cell !== null && cell !== undefined && String(cell).trim() !== ''
    ).length
    if (count > bestCount) {
      bestCount = count
      bestRow = i
    }
  }
  return bestRow
}

// Merged data cells (e.g. Building/Floor spanning many unit rows) only store a value
// in the first cell of the merge. Use the sheet's merge map to fill the rest.
// dataStartRow must come from findHeaderRow(rawData) BEFORE this is called,
// so that merged title cells don't corrupt header detection.
function applyMerges(raw: unknown[][], ws: XLSX.WorkSheet, dataStartRow: number): unknown[][] {
  const merges = ws['!merges']
  if (!merges || merges.length === 0) return raw
  const filled = raw.map(row => [...(row as unknown[])])
  for (const { s, e } of merges) {
    if (e.r < dataStartRow) continue // merge is entirely inside the title/header area — skip
    const value = filled[s.r]?.[s.c] ?? null
    for (let r = s.r; r <= e.r; r++) {
      if (r < dataStartRow) continue // never touch header or title rows
      for (let c = s.c; c <= e.c; c++) {
        if (!filled[r] || (r === s.r && c === s.c)) continue
        filled[r][c] = value
      }
    }
  }
  return filled
}

export function parseExcelFile(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: false })

        const results: ParsedSheet[] = workbook.SheetNames.map(sheetName => {
          const ws = workbook.Sheets[sheetName]
          const rawData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
          if (rawData.length < 2) return { sheetName, rows: [], headers: [] }

          // Find header row on original data BEFORE filling merges,
          // so merged title cells don't inflate their density and get picked as headers.
          const headerRowIdx = findHeaderRow(rawData)
          const raw = applyMerges(rawData, ws, headerRowIdx + 1)

          const headers = (raw[headerRowIdx] as (string | null)[])
            .map(h => String(h ?? '').trim())
            .filter(Boolean)

          const rows: RawRow[] = raw.slice(headerRowIdx + 1)
            .filter(row => (row as unknown[]).some(cell => cell !== null && cell !== ''))
            .map(row =>
              Object.fromEntries(
                headers.map((h, i) => {
                  const cell = (row as unknown[])[i] ?? null
                  return [h, cell === '' ? null : cell as string | number | null]
                })
              )
            )

          return { sheetName, rows, headers }
        }).filter(s => s.rows.length > 0)

        resolve(results)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
