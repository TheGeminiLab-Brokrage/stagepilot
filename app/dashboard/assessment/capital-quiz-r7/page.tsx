import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import CapitalQuizR7Client from './CapitalQuizR7Client'

export default async function CapitalQuizR7Page() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <CapitalQuizR7Client />
}
