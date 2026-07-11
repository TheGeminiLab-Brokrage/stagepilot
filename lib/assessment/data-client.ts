import type { AssessmentRegion, Session, Answer, AnswerInput } from './types'

async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function createSession(region: AssessmentRegion): Promise<string> {
  const { id } = await callApi<{ id: string }>('/api/assessment/session/start', {
    method: 'POST',
    body: JSON.stringify({ region }),
  })
  return id
}

export async function markSessionComplete(sessionId: string): Promise<void> {
  await callApi('/api/assessment/session/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

export async function saveAnswers(sessionId: string, answers: AnswerInput[]): Promise<void> {
  if (!answers.length) return
  await callApi('/api/assessment/answers', {
    method: 'POST',
    body: JSON.stringify({ sessionId, answers }),
  })
}

export async function getSessionResults(sessionId: string): Promise<{ session: Session; answers: Answer[] }> {
  return callApi(`/api/assessment/session/${sessionId}`)
}

export async function getMySessions(): Promise<{ session: Session; answers: Answer[] }[]> {
  return callApi('/api/assessment/my-sessions')
}

export interface TeamAgent {
  id: string
  full_name: string
  sessions: { session: Session; answers: Answer[] }[]
}

export async function getTeamAgents(): Promise<TeamAgent[]> {
  return callApi('/api/assessment/manager/agents')
}
