export type Part2QuestionType =
  | 'freetext'
  | 'truefalse'
  | 'multiselect'
  | 'mcq'
  | 'dynamicpricegroup'
  | 'dualinput';

export interface Part2Question {
  id: string;
  type: Part2QuestionType;
  question: string;
  options?: string[];
  labelPrefix?: string; // prefix for dynamicpricegroup input labels (default: 'سعر')
}

// Same 10 questions for every zone — answers vary per zone.
// Q4 (dynamicpricegroup) renders one text input per unit type selected in Q3.
export const PART2_QUESTIONS: Part2Question[] = [
  {
    id: 'p2-q1',
    type: 'freetext',
    question: 'ما هي سابقة أعمال المطور العقاري للمشروع؟',
  },
  {
    id: 'p2-q2',
    type: 'truefalse',
    question: 'هل توجد فيلات داخل المشروع؟',
  },
  {
    id: 'p2-q3',
    type: 'multiselect',
    question: 'ما أنواع الوحدات المتاحة داخل المشروع؟',
    options: [
      'ستوديو',
      'شقة غرفة نوم واحدة',
      'شقة غرفتي نوم',
      'شقة 3 غرف نوم',
      'تاون هاوس',
      'توين هاوس',
      'فيلا مستقلة',
      'دوبلكس',
    ],
  },
  {
    id: 'p2-q3b',
    type: 'dynamicpricegroup',
    question: 'ما هي أقل مساحة متاحة ؟',
    labelPrefix: 'مساحة',
  },
  {
    id: 'p2-q4',
    type: 'dynamicpricegroup',
    question: 'ما السعر الابتدائي لكل نوع وحدة تم اختياره في السؤال السابق؟',
  },
  {
    id: 'p2-q5',
    type: 'mcq',
    question: 'ما نوع التشطيب المتوفر في المشروع؟',
    options: ['تشطيب كامل', 'نصف تشطيب', 'طوب أحمر'],
  },
  {
    id: 'p2-q6',
    type: 'dualinput',
    question: 'ما أطول فترة سداد متاحة في المشروع؟',
    options: ['مقدم', 'عدد السنوات'],
  },
  {
    id: 'p2-q7',
    type: 'dualinput',
    question: 'ما أقل مقدم متاح ضمن أنظمة السداد الخاصة بالمشروع؟',
    options: ['مقدم', 'عدد السنوات'],
  },
  {
    id: 'p2-q8',
    type: 'freetext',
    question: 'ما موعد استلام الوحدات في المشروع؟',
  },
  {
    id: 'p2-q9',
    type: 'truefalse',
    question: 'هل توجد أعمال إنشاءات جارية حاليًا داخل المشروع؟',
  },
  {
    id: 'p2-q10',
    type: 'multiselect',
    question: 'ما المستندات القانونية الصادرة للمشروع؟',
    options: [
      'إخطار التخصيص',
      'محضر استلام الأرض',
      'القرار الوزاري',
      'رخصة الحفر',
      'رخصة البناء',
      'لا يوجد أي مستندات صادرة حتى الآن',
    ],
  },
];
