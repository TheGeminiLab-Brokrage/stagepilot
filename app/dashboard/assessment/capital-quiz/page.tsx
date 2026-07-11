import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import CapitalQuizClient from './CapitalQuizClient'

export default async function CapitalQuizPage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <CapitalQuizClient />
}
