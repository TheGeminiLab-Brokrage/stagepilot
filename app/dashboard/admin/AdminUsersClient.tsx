'use client'

import { useState, useMemo } from 'react'
import UserTable from './UserTable'
import CreateUserForm from './CreateUserForm'
import AdminSectionTitle from './AdminSectionTitle'

type Profile = {
  id: string
  full_name: string
  role: string
  team_name: string | null
  created_at: string
}

interface Props {
  initialProfiles: Profile[]
  initialEmailMap: Record<string, string>
  currentUserId: string
}

export default function AdminUsersClient({ initialProfiles, initialEmailMap, currentUserId }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [emailMap, setEmailMap] = useState<Record<string, string>>(initialEmailMap)

  const teamLeaders = useMemo(
    () => profiles.filter(p => p.role === 'team_leader').map(p => p.full_name),
    [profiles]
  )

  function handleUserCreated(profile: Profile, email: string) {
    setProfiles(prev => [...prev, profile])
    setEmailMap(prev => ({ ...prev, [profile.id]: email }))
  }

  function handleRemoveProfile(id: string) {
    setProfiles(prev => prev.filter(p => p.id !== id))
  }

  function handleUpdateTeamProfile(id: string, team: string | null) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, team_name: team } : p))
  }

  return (
    <>
      {/* User list */}
      <div style={{ borderRadius: 12, background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          <UserTable
            profiles={profiles}
            emailMap={emailMap}
            currentUserId={currentUserId}
            teamLeaders={teamLeaders}
            onRemoveProfile={handleRemoveProfile}
            onUpdateTeamProfile={handleUpdateTeamProfile}
          />
        </div>
      </div>

      {/* Create user form */}
      <div style={{ borderRadius: 12, background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', padding: '20px 24px', marginBottom: '2rem' }}>
        <AdminSectionTitle
          titleKey="adminAddNewUser"
          headingLevel="h2"
          headingClass="text-white font-medium mb-4"
        />
        <CreateUserForm
          teamLeaders={teamLeaders}
          onCreated={handleUserCreated}
        />
      </div>
    </>
  )
}
