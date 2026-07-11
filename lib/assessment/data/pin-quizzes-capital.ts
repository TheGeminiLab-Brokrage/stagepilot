import type { PinQuizData } from '@/lib/assessment/data/pin-quizzes';

// Capital pin quizzes reuse the PinQuizData type so PinQuizPanel works unchanged.
// focusPoint is unused for image maps — set to dummy values.
// masterPlanImage paths should be placed in public/capital-masterplans/.
// Questions will be filled in by the user in a future session.

export const CAPITAL_PIN_QUIZZES: PinQuizData[] = [
  {
    landmarkId: 'cap-A1',
    masterPlanImage: '/assessment/capital-masterplans/a1.jpg',
    focusPoint: { lat: 0, lng: 0, zoom: 0 },
    questions: [
      { id: 'cap-a1-q1', type: 'freetext', section: 'new_capital', question: 'Who is the developer of this project?', answer: '', tip: '' },
    ],
  },
  {
    landmarkId: 'cap-A2',
    masterPlanImage: '/assessment/capital-masterplans/a2.jpg',
    focusPoint: { lat: 0, lng: 0, zoom: 0 },
    questions: [
      { id: 'cap-a2-q1', type: 'freetext', section: 'new_capital', question: 'Who is the developer of this project?', answer: '', tip: '' },
    ],
  },
  {
    landmarkId: 'cap-K1',
    masterPlanImage: '/assessment/capital-masterplans/k1.jpg',
    focusPoint: { lat: 0, lng: 0, zoom: 0 },
    questions: [
      { id: 'cap-k1-q1', type: 'freetext', section: 'new_capital', question: 'Who is the developer of this project?', answer: '', tip: '' },
    ],
  },
  {
    landmarkId: 'cap-K2',
    masterPlanImage: '/assessment/capital-masterplans/k2.jpg',
    focusPoint: { lat: 0, lng: 0, zoom: 0 },
    questions: [
      { id: 'cap-k2-q1', type: 'freetext', section: 'new_capital', question: 'Who is the developer of this project?', answer: '', tip: '' },
    ],
  },
];

export function getCapitalPinQuiz(zoneId: string): PinQuizData | undefined {
  return CAPITAL_PIN_QUIZZES.find(q => q.landmarkId === zoneId);
}
