import { requireAssessmentAccess, MANAGER_ROLES } from '@/lib/assessment/require-access'
import ManagerCapitalDataClient from './ManagerCapitalDataClient'

export default async function ManagerCapitalDataSelectionPage() {
  await requireAssessmentAccess(MANAGER_ROLES)
  return <ManagerCapitalDataClient />
}
