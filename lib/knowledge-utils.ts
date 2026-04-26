export interface KnowledgeEntry {
  category: string
  title: string
  content: string
}

export const CLINIC_SEARCH_TOOL = {
  functionDeclarations: [
    {
      name: 'search_clinic_projects',
      description:
        'Search TGL clinic projects by name, developer, location, size, price range, or delivery timeline. Call this whenever the agent or conversation references a specific project or asks about project options.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search term — project name, developer, location (e.g. التسعين), feature (e.g. zero down, ready), or price range (e.g. under 5M)',
          },
        },
        required: ['query'],
      },
    },
  ],
}

export function buildKnowledgeBlock(entries: KnowledgeEntry[]): string {
  const facts = entries.filter((e) => e.category === 'product_fact')
  const questions = entries.filter((e) => e.category === 'common_question')

  const parts: string[] = []

  if (facts.length > 0) {
    parts.push('# Product Knowledge\n\n' + facts.map((e) => `${e.title}: ${e.content}`).join('\n'))
  }

  if (questions.length > 0) {
    parts.push(
      '# Common Client Questions\n\nReal questions real clients ask. Use these naturally when roleplaying as a buyer — weave them into the conversation at appropriate moments.\n\n' +
        questions.map((e, i) => `${i + 1}. ${e.content}`).join('\n')
    )
  }

  return parts.join('\n\n---\n\n')
}

export function formatProjectResults(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return 'No matching projects found in the TGL portfolio.'
  return entries.map((e) => e.content).join('\n')
}
