import { requireAssessmentAccess, MANAGER_ROLES } from '@/lib/assessment/require-access'
import ManagerClient from './ManagerClient'

export default async function ManagerPage() {
  const profile = await requireAssessmentAccess(MANAGER_ROLES)
  return <ManagerClient isAdmin={profile.role === 'super_admin'} />
}
