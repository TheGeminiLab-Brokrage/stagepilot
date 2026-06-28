import * as XLSX from 'xlsx'

export type RawRow = Record<string, string | number | null>

export interface ParsedSheet {
  sheetName: string
  rows: RawRow[]
  headers: string[]
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
          const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
          if (raw.length < 2) return { sheetName, rows: [], headers: [] }

          const headers = (raw[0] as (string | null)[])
            .map(h => String(h ?? '').trim())
            .filter(Boolean)

          const rows: RawRow[] = raw.slice(1)
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
