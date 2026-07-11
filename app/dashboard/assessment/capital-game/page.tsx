import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import CapitalGameClient from './CapitalGameClient'

export default async function CapitalGamePage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <CapitalGameClient />
}
