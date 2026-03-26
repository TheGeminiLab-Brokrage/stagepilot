'use client'

export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-5 max-w-lg">
        <h2 className="text-red-400 font-semibold mb-2">Dashboard error</h2>
        <p className="text-red-300 text-sm font-mono break-all">{error.message}</p>
        {error.digest && (
          <p className="text-gray-600 text-xs mt-2">Digest: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
