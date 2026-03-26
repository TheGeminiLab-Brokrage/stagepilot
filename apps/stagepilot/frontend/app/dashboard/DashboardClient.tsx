'use client'

import { useState } from 'react'
import FilterBar from './FilterBar'
import CallsTable, { type Call } from './CallsTable'

export default function DashboardClient({
  calls,
  isLeader,
  currentUserId,
}: {
  calls: Call[]
  isLeader: boolean
  currentUserId: string
}) {
  const [filtered, setFiltered] = useState<Call[]>(calls)

  return (
    <>
      <FilterBar calls={calls} isLeader={isLeader} onFiltered={setFiltered} />
      <CallsTable calls={filtered} isLeader={isLeader} currentUserId={currentUserId} />
    </>
  )
}
