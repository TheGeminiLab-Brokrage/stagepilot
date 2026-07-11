import { requireAssessmentAccess, MANAGER_ROLES } from '@/lib/assessment/require-access'
import ManagerCapitalDataMapClient from './ManagerCapitalDataMapClient'

export default async function ManagerCapitalDataMapPage() {
  await requireAssessmentAccess(MANAGER_ROLES)
  return <ManagerCapitalDataMapClient />
}
