export default function Loading() {
  return (
    <div
      className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4"
      style={{ background: '#000', fontFamily: "'Montserrat', sans-serif" }}
    >
      <div
        className="w-3 h-3 rounded-full"
        style={{
          background: '#D7FF00',
          boxShadow: '0 0 16px rgba(215,255,0,0.8)',
          animation: 'orb-breathe 1s ease-in-out infinite',
        }}
      />
      <p
        className="text-xs font-semibold tracking-widest uppercase"
        style={{
          color: 'rgba(215,255,0,0.55)',
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: '0.15em',
        }}
      >
        Loading…
      </p>
    </div>
  )
}
