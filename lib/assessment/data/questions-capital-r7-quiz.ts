import type { Question } from '@/lib/assessment/data/questions';

// TODO: Replace with real R7 quiz questions.
export const CAPITAL_R7_QUESTIONS: Question[] = [
  {
    id: 'cap-r7-q1',
    type: 'mcq',
    section: 'new_capital_r7',
    question: 'What is the total area of R7 district in the New Administrative Capital?',
    options: ['1500 feddan', '1200 feddan', '1800 feddan', '2000 feddan'],
    answer: '1500 feddan',
    tip: 'R7 covers approximately 1500 feddan.',
  },
  {
    id: 'cap-r7-q2',
    type: 'mcq',
    section: 'new_capital_r7',
    question: 'Which major road runs along the northern boundary of R7?',
    options: ['محور بن زايد الجنوبي', 'المحور المركزي', 'طريق السخنة', 'شارع التسعين'],
    answer: 'محور بن زايد الجنوبي',
    tip: 'The northern axis is محور بن زايد الجنوبي (Ben Zayed South Axis).',
  },
  {
    id: 'cap-r7-q3',
    type: 'mcq',
    section: 'new_capital_r7',
    question: 'Which zone type is located on the western edge of R7?',
    options: ['مدينة المعارض', 'الحي الدبلوماسي', 'المنطقة الحكومية', 'المنطقة التجارية'],
    answer: 'مدينة المعارض',
    tip: 'مدينة المعارض (Exhibition City) is located on the western edge of R7.',
  },
];
