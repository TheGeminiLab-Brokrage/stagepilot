import { requireAssessmentAccess, AGENT_ROLES } from '@/lib/assessment/require-access'
import SectionQuizClient from './SectionQuizClient'

export default async function SectionQuizPage() {
  await requireAssessmentAccess(AGENT_ROLES)
  return <SectionQuizClient />
}
