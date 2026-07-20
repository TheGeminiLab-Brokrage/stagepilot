import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/cron/task-reminders
// Vercel Cron fires this daily at 06:00 UTC (~8-9 AM Cairo). Sends each agent
// one in-portal chat message summarizing their tasks due within 24h and any
// overdue ones. Overdue tasks repeat daily until done. Messages are grouped
// per (ticket creator → assignee) pair so they arrive from the leader who
// assigned the work, via the existing chat system.
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('ticket_assignees')
    .select('assignee_id, ticket:tickets!ticket_assignees_ticket_id_fkey(id, title, due_date, created_by, company_id)')
    .eq('status', 'open')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const dayAhead = now + 24 * 60 * 60 * 1000

  type TicketRef = { id: string; title: string; due_date: string | null; created_by: string; company_id: string }
  const dueItems: { assignee_id: string; ticket: TicketRef; overdue: boolean }[] = []

  for (const r of rows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (Array.isArray(r.ticket) ? r.ticket[0] : r.ticket) as any as TicketRef | null
    if (!t?.due_date) continue
    const due = new Date(t.due_date).getTime()
    if (due <= dayAhead) {
      dueItems.push({ assignee_id: r.assignee_id as string, ticket: t, overdue: due < now })
    }
  }

  if (dueItems.length === 0) return NextResponse.json({ sent: 0 })

  // One message per (creator → assignee) pair, listing all their relevant tasks
  const groups = new Map<string, { creator: string; assignee: string; company: string; lines: string[] }>()
  for (const item of dueItems) {
    const key = `${item.ticket.created_by}→${item.assignee_id}`
    if (!groups.has(key)) {
      groups.set(key, { creator: item.ticket.created_by, assignee: item.assignee_id, company: item.ticket.company_id, lines: [] })
    }
    const dueDate = new Date(item.ticket.due_date!)
    const when = dueDate.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' })
    groups.get(key)!.lines.push(
      item.overdue ? `• "${item.ticket.title}" — OVERDUE (was due ${when})` : `• "${item.ticket.title}" — due ${when}`
    )
  }

  let sent = 0
  for (const g of groups.values()) {
    // Self-assigned tasks don't need a reminder from yourself
    if (g.creator === g.assignee) continue
    const body = `⏰ Task reminder — you have ${g.lines.length} task${g.lines.length === 1 ? '' : 's'} needing attention:\n${g.lines.join('\n')}`
    const { error: insertErr } = await admin.from('chat_messages').insert({
      company_id: g.company,
      sender_id: g.creator,
      recipient_id: g.assignee,
      body,
    })
    if (!insertErr) sent++
  }

  return NextResponse.json({ sent, groups: groups.size, items: dueItems.length })
}
