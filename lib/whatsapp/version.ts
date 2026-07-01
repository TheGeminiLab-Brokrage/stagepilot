// Module-level cache: Vercel warm instances reuse this; cold starts re-fetch.
let _version: [number, number, number] | null = null
let _fetchedAt = 0

export async function getBaileysVersion(): Promise<[number, number, number]> {
  if (_version && Date.now() - _fetchedAt < 3_600_000) return _version
  const { fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys')
  const { version } = await fetchLatestBaileysVersion()
  _version = version
  _fetchedAt = Date.now()
  return version
}
