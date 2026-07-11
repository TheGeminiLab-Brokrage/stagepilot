'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/language-context'
import { QUICK_REACT_EMOJIS, type ReactionEmoji } from './chatTypes'

export default function QuickReactPopover({
  position,
  onPick,
  onClose,
}: {
  position: { top: number; left: number }
  onPick: (emoji: ReactionEmoji) => void
  onClose: () => void
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={t('chatQuickReactPopoverAria')}
      className="flex items-center gap-1 px-2 py-1.5 rounded-full"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        background: '#111',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 80,
      }}
    >
      {QUICK_REACT_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="text-lg leading-none px-1 py-0.5 rounded-full transition-transform"
          style={{ transform: 'scale(1)' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {emoji}
        </button>
      ))}
    </div>,
    document.body
  )
}
