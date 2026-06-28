export function fmt(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(String(n))
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K'
  return num.toLocaleString()
}

export function fmtFull(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = parseFloat(String(n))
  if (isNaN(num)) return '—'
  return num.toLocaleString('en-EG')
}

export function capitalize(s: string): string {
  if (!s) return ''
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

export function safeMin(arr: number[]): number {
  return arr.reduce((m, v) => (v < m ? v : m), arr[0])
}

export function safeMax(arr: number[]): number {
  return arr.reduce((m, v) => (v > m ? v : m), arr[0])
}
