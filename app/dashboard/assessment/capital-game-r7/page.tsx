import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import CapitalGameR7Client from './CapitalGameR7Client'

export default async function CapitalGameR7Page() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <CapitalGameR7Client />
}
