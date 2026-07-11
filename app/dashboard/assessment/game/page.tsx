import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import GameClient from './GameClient'

export default async function GamePage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <GameClient />
}
