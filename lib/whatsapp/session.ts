import { createAdminClient } from '@/lib/supabase/admin'

// Loads Baileys auth credentials AND signal keys from Supabase.
// Both are persisted together so the send route can reconnect without
// re-negotiating the Signal session from scratch on every request.
export async function createSupabaseAuthState(agentId: string) {
  const { initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys')
  const admin = createAdminClient()

  const { data } = await admin
    .from('whatsapp_baileys_sessions')
    .select('creds_json, keys_json')
    .eq('agent_id', agentId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creds: any = data?.creds_json
    ? JSON.parse(JSON.stringify(data.creds_json), BufferJSON.reviver)
    : initAuthCreds()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keys: Record<string, Record<string, any>> = data?.keys_json
    ? JSON.parse(JSON.stringify(data.keys_json), BufferJSON.reviver)
    : {}

  // Single upsert keeps creds + keys in sync with one DB round-trip
  async function save() {
    await admin.from('whatsapp_baileys_sessions').upsert(
      {
        agent_id: agentId,
        creds_json: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys_json: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id' }
    )
  }

  const state = {
    creds,
    keys: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: async (type: string, ids: string[]): Promise<Record<string, any>> =>
        Object.fromEntries(ids.map(id => [id, keys[type]?.[id]])),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: async (data: Record<string, Record<string, any>>) => {
        for (const [type, typeData] of Object.entries(data)) {
          keys[type] = { ...(keys[type] ?? {}), ...typeData }
        }
        await save()
      },
    },
  }

  return { state, saveCreds: save }
}

export async function getSessionInfo(agentId: string): Promise<{ connected: boolean; phone: string | null }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('whatsapp_baileys_sessions')
    .select('creds_json')
    .eq('agent_id', agentId)
    .single()

  // A row with no authenticated identity is not a live session
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meId: string | undefined = (data?.creds_json as any)?.me?.id
  if (!meId) return { connected: false, phone: null }

  // meId format: "201234567890:12@s.whatsapp.net" — strip device suffix
  const phone = meId.split('@')[0]?.split(':')[0] ?? null
  return { connected: true, phone }
}

export async function hasSession(agentId: string): Promise<boolean> {
  return (await getSessionInfo(agentId)).connected
}

export async function clearSession(agentId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('whatsapp_baileys_sessions').delete().eq('agent_id', agentId)
}
