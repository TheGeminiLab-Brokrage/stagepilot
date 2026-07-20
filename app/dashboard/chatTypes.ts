export type ChatRole = 'agent' | 'team_leader' | 'super_admin'

export type ChatContact = {
  id: string
  full_name: string
  role: ChatRole
  team_name: string | null
}

export type ChatAttachmentKind = 'voice' | 'image' | 'sticker'

export const QUICK_REACT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export type ReactionEmoji = typeof QUICK_REACT_EMOJIS[number]

// message_id -> emoji -> user ids who reacted with that emoji. Kept as
// client-side component state built from a bulk fetch + realtime events,
// not embedded on ChatMessageRow/ChatGroupMessageRow (those stay pure
// mirrors of their DB rows).
export type ReactionMap = Record<string, Partial<Record<ReactionEmoji, string[]>>>

export type ChatReactionRow = {
  id: string
  message_id: string
  user_id: string
  emoji: ReactionEmoji
  created_at: string
}

// Real-estate + funny sticker pack, rendered from public/stickers/{slug}.png.
export const STICKER_CATALOG = [
  'sold-sign',
  'keys-handoff',
  'house-heart',
  'deal-closed-handshake',
  'moving-boxes',
  'for-sale-sign',
  'open-house-balloon',
  'mind-blown',
  'fire-hot-listing',
  'popcorn-watching',
  'thumbs-up-confetti',
  'party-popper-closing',
  'coffee-monday',
  'sleeping-tired-agent',
  'money-rain',
  'trophy-top-agent',
] as const
export type StickerSlug = typeof STICKER_CATALOG[number]

export type ChatMessageRow = {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  created_at: string
  read_at: string | null
  attachment_path: string | null
  attachment_kind: ChatAttachmentKind | null
  attachment_duration_seconds: number | null
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

export type TicketSummaryAssignee = {
  id: string
  fullName: string
  teamName: string | null
  status?: TicketStatus
  completedAt?: string | null
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
  assignees?: TicketSummaryAssignee[]
  creatorName?: string
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
  attachment_path: string | null
  attachment_kind: ChatAttachmentKind | null
  attachment_duration_seconds: number | null
}

export type ChatGroupMember = {
  id: string
  full_name: string
  role: ChatRole
}
