export type AssessmentRegion = 'north_coast' | 'capital_r8' | 'capital_r7';

export interface Session {
  id: string;
  user_id: string;
  full_name: string;
  region: AssessmentRegion;
  started_at: string;
  completed_at: string | null;
}

export interface Answer {
  id: string;
  session_id: string;
  phase: string;
  question_id: string;
  answer_given: string | null;
  correct: boolean | null;
  created_at: string;
}

export interface AnswerInput {
  phase: string;
  question_id: string;
  answer_given: string | null;
  correct: boolean;
}
