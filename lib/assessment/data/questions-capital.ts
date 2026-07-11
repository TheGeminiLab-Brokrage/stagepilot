import type { Question } from '@/lib/assessment/data/questions';

// General knowledge questions about the New Administrative Capital.
// These are placeholders — real questions will be provided by the user.
export const CAPITAL_QUESTIONS: Question[] = [
  {
    id: 'cap-q1',
    type: 'mcq',
    section: 'new_capital',
    question: 'What is the total area of the New Administrative Capital?',
    options: ['170,000 feddan', '200,000 feddan', '140,000 feddan', '250,000 feddan'],
    answer: '170,000 feddan',
    tip: 'The New Administrative Capital covers approximately 170,000 feddan.',
  },
  {
    id: 'cap-q2',
    type: 'mcq',
    section: 'new_capital',
    question: 'Which company is responsible for developing the New Administrative Capital?',
    options: ['ACUD', 'SODIC', 'Mountain View', 'Emaar'],
    answer: 'ACUD',
    tip: 'ACUD (Administrative Capital for Urban Development) is the master developer.',
  },
  {
    id: 'cap-q3',
    type: 'mcq',
    section: 'new_capital',
    question: 'What is the name of the main road running along the northern edge of the district shown in the map?',
    options: ['محور بن زايد الجنوبي', 'المحور المركزي', 'طريق السخنة', 'شارع التسعين'],
    answer: 'محور بن زايد الجنوبي',
    tip: 'The road labeled on the map is محور بن زايد الجنوبي (Ben Zayed South Axis).',
  },
];

export const CAPITAL_QUESTIONS_BY_SECTION: Record<string, Question[]> = {
  new_capital: CAPITAL_QUESTIONS,
};
