export default function Loading() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="animate-spin">
            <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
              <circle cx="12" cy="12" r="8" />
            </svg>
          </div>
        </div>
        <p className="text-gray-400 text-sm">Loading practice session...</p>
      </div>
    </div>
  )
}
