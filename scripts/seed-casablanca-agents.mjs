#!/usr/bin/env node
// Run: node scripts/seed-casablanca-agents.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mvgmhasgwzybwvwyruac.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z21oYXNnd3p5Ynd2d3lydWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzMjI5MiwiZXhwIjoyMDk3MDA4MjkyfQ.nLAden0IU65UBhgdC79EGFtV-2Z7iAfcDrSID93wWEc'
const COMPANY_ID = '99128fef-60d3-44d9-b213-d7909a3a7499'
const PASSWORD = '12345678'

const AGENTS = [
  { fullName: 'Shahd',   email: 'shahd@Casablanca.com' },
  { fullName: 'Karen',   email: 'Karen@Casablanca.com' },
  { fullName: 'Mayar',   email: 'Mayar@Casablanca.com' },
  { fullName: 'Bakar',   email: 'Bakar@Casablanca.com' },
  { fullName: 'Tolbah',  email: 'Tolbah@Casablanca.com' },
  { fullName: 'Hamato',  email: 'Hamato@Casablanca.com' },
  { fullName: 'Mahmoud', email: 'Mahmoud@Casablanca.com' },
  { fullName: 'Tena',    email: 'Tena@Casablanca.com' },
  { fullName: 'Yassen',  email: 'Yassen@Casablanca.com' },
  { fullName: 'Eyad',    email: 'Eyad@Casablanca.com' },
]

const client = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

for (const { fullName, email } of AGENTS) {
  const { data: newUser, error: authError } = await client.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })

  if (authError || !newUser.user) {
    console.error(`✗ ${fullName} (${email}): ${authError?.message ?? 'unknown auth error'}`)
    continue
  }

  const { error: profileError } = await client.from('profiles').insert({
    id: newUser.user.id,
    company_id: COMPANY_ID,
    full_name: fullName,
    role: 'agent',
    team_name: null,
  })

  if (profileError) {
    await client.auth.admin.deleteUser(newUser.user.id)
    console.error(`✗ ${fullName} (${email}): profile insert failed — ${profileError.message} (auth user rolled back)`)
    continue
  }

  console.log(`✓ ${fullName} (${email}) — id: ${newUser.user.id}`)
}
