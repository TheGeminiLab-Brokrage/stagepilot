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

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'done'

export type TicketAssigneeRow = {
  id: string
  assigneeId: string
  fullName: string
  status: TicketStatus
}

export type TicketAttachmentKind = 'photo' | 'voice'

export type TicketAttachment = {
  id: string
  url: string
  kind: TicketAttachmentKind
}

export type TicketSummary = {
  id: string
  title: string
  description: string
  priority: TicketPriority
  dueDate: string | null
  createdAt: string
  createdBy: string
  mode: 'assignee' | 'owner'
  myAssigneeRowId?: string
  myStatus?: TicketStatus
  assigneeCount?: number
  doneCount?: number
  attachmentCount?: number
}

export type ChatGroupSummary = {
  id: string
  name: string
  createdBy: string
  createdAt: string
  memberCount: number
}

export type ChatGroupMessageRow = {
  id: string
  group_id: string
  sender_id: string
  body: string
  created_at: string
}

export type ChatGroupMember = {
  id: string
  full_name: string
  role: ChatRole
}
