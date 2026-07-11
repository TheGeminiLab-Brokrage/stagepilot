import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import AssessmentHomeClient from './AssessmentHomeClient'

export const dynamic = 'force-dynamic'

export default async function AssessmentPage() {
  const profile = await requireAssessmentAccess(AGENT_ROLES)
  return (
    <AssessmentHomeClient
      fullName={profile.fullName}
      isManagerOrAdmin={profile.role === 'team_leader' || profile.role === 'super_admin'}
    />
  )
}
