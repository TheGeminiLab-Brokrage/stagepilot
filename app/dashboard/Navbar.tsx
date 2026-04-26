'use client'

interface NavbarProps {
  role: string
  fullName: string | null | undefined
  rightSlot?: React.ReactNode
}

export default function Navbar({ role, fullName, rightSlot }: NavbarProps) {
  const navLinks =
    role === 'trainee'
      ? [{ href: '/dashboard/practice', label: 'AI Practice' }]
      : role === 'exam'
      ? [{ href: '/dashboard/exam', label: 'الامتحان' }]
      : [
          { href: '/dashboard', label: role === 'agent' ? 'My Calls' : 'Team Calls' },
          ...(role === 'agent' ? [{ href: '/dashboard/upload', label: 'Upload Call' }] : []),
          ...(role === 'super_admin' ? [
            { href: '/dashboard/admin', label: 'Admin' },
            { href: '/dashboard/admin/knowledge-base', label: 'Knowledge Base' },
          ] : []),
        ]

  return (
    <header
      style={{
        borderBottom: '1px solid rgba(215,255,0,0.15)',
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="flex items-center">
            <img
              src="/tgl-logo-white.png"
              alt="TGL"
              className="h-7 w-auto"
              style={{ filter: 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))' }}
              onMouseEnter={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1.1) drop-shadow(0 0 14px rgba(215,255,0,0.6))')}
              onMouseLeave={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))')}
            />
          </a>

          <nav className="flex gap-1">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md transition-all"
                style={{
                  color: role === 'trainee' ? 'rgba(215,255,0,0.7)' : 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.08em',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.color = '#D7FF00'
                  el.style.background = 'rgba(215,255,0,0.08)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.color = (role === 'trainee' || role === 'exam') ? 'rgba(215,255,0,0.7)' : 'rgba(255,255,255,0.45)'
                  el.style.background = 'transparent'
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Montserrat', sans-serif" }}>
            {fullName}
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-semibold capitalize"
              style={{
                background: 'rgba(215,255,0,0.1)',
                color: 'rgba(215,255,0,0.7)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {role.replace('_', ' ')}
            </span>
          </span>
          {rightSlot}
        </div>
      </div>
    </header>
  )
}
