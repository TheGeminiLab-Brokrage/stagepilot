import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import QuizClient from './QuizClient'

export default async function QuizPage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <QuizClient />
}
