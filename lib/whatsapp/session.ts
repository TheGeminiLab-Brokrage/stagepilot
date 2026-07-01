import { createAdminClient } from '@/lib/supabase/admin'

// Loads Baileys auth credentials from Supabase and returns the state object
// that makeWASocket expects. Signal keys are kept in memory — sufficient for
// text messaging (Baileys re-negotiates sessions automatically as needed).
export async function createSupabaseAuthState(agentId: string) {
  const { initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys')
  const admin = createAdminClient()

  const { data } = await admin
    .from('whatsapp_baileys_sessions')
    .select('creds_json')
    .eq('agent_id', agentId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creds: any = data?.creds_json
    ? JSON.parse(JSON.stringify(data.creds_json), BufferJSON.reviver)
    : initAuthCreds()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keys: Record<string, Record<string, any>> = {}

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
      },
    },
  }

  const saveCreds = async () => {
    await admin.from('whatsapp_baileys_sessions').upsert(
      {
        agent_id: agentId,
        creds_json: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id' }
    )
  }

  return { state, saveCreds }
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
