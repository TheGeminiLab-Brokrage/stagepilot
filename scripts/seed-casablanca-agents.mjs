#!/usr/bin/env node
// Run: node scripts/seed-casablanca-agents.mjs

import { createClient } from '@supabase/supabase-js'

// Credentials come from env — never hardcode the service-role key in a committed file.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... COMPANY_ID=... SEED_PASSWORD=... node scripts/seed-casablanca-agents.mjs
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COMPANY_ID = process.env.COMPANY_ID
const PASSWORD = process.env.SEED_PASSWORD
if (!SUPABASE_URL || !SERVICE_KEY || !COMPANY_ID || !PASSWORD) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / COMPANY_ID / SEED_PASSWORD env vars')
  process.exit(1)
}

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
