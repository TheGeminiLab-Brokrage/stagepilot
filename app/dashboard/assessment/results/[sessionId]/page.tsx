import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import ResultsClient from './ResultsClient'

export default async function ResultsPage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <ResultsClient />
}
