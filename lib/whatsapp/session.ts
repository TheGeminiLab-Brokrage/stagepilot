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

export async function hasSession(agentId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('whatsapp_baileys_sessions')
    .select('agent_id')
    .eq('agent_id', agentId)
    .single()
  return !!data
}

export async function clearSession(agentId: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('whatsapp_baileys_sessions').delete().eq('agent_id', agentId)
}
