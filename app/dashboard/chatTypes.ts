export type ChatRole = 'agent' | 'team_leader' | 'super_admin'

export type ChatContact = {
  id: string
  full_name: string
  role: ChatRole
  team_name: string | null
}

export type ChatMessageRow = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
  read_at: string | null
}

export type TaskListSummary = {
  id: string
  title: string
  createdAt: string
  itemsTotal: number
  itemsRemaining: number
  mode: 'recipient' | 'owner'
}
