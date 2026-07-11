import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import CapitalSelectionClient from './CapitalSelectionClient'

export default async function CapitalSelectionPage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <CapitalSelectionClient />
}
