import { requireAssessmentAccess, ADMIN_ROLES } from '@/lib/assessment/require-access'
import AdminZoneAnswersClient from './AdminZoneAnswersClient'

export default async function AdminZoneAnswersPage() {
  await requireAssessmentAccess(ADMIN_ROLES)
  return <AdminZoneAnswersClient />
}
