import { requireAssessmentAccess, MANAGER_ROLES } from '@/lib/assessment/require-access'
import ManagerAgentClient from './ManagerAgentClient'

export default async function ManagerAgentDetailPage() {
  const profile = await requireAssessmentAccess(MANAGER_ROLES)
  return <ManagerAgentClient isAdmin={profile.role === 'super_admin'} />
}
