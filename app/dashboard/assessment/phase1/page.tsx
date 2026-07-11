import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import Phase1Client from './Phase1Client'

export default async function Phase1Page() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <Phase1Client />
}
