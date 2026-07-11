import { SECTIONS } from '@/lib/assessment/data/landmarks';
import { QUESTIONS } from '@/lib/assessment/data/questions';
import { PIN_QUIZZES } from '@/lib/assessment/data/pin-quizzes';
import type { Answer } from '@/lib/assessment/types';

export interface AnswerRow {
  id?: string;
  questionLabel: string;
  given: string | null;
  correct: boolean | null;
  correctAnswer: string;
}

export interface SubGroup {
  key: string;
  label: string;
  rows: AnswerRow[];
  score: { correct: number; total: number };
}

export interface PhaseGroup {
  key: string;
  label: string;
  rows: AnswerRow[];
  score: { correct: number; total: number };
  subGroups?: SubGroup[];
}

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const PHASE0_LABELS: Record<string, string> = {};
SECTIONS.forEach((s, i) => { PHASE0_LABELS[`zone-${i + 1}`] = s.label; });

const LANDMARK_LABELS: Record<string, string> = {};
SECTIONS.forEach(s => s.landmarks.forEach(lm => { LANDMARK_LABELS[lm.id] = lm.label; }));

export const QUESTION_MAP: Record<string, typeof QUESTIONS[0]> = {};
QUESTIONS.forEach(q => { QUESTION_MAP[q.id] = q; });

const PIN_QUESTION_LABELS: Record<string, string> = {};
const PIN_CORRECT_ANSWERS: Record<string, string> = {};
PIN_QUIZZES.forEach(pq => pq.questions.forEach(q => {
  PIN_QUESTION_LABELS[q.id] = q.question;
  if (q.type === 'multiselect' && Array.isArray(q.answer)) {
    PIN_CORRECT_ANSWERS[q.id] = (q.answer as string[]).join(', ');
  } else if (q.type === 'freetext' || q.type === 'pricegroup') {
    PIN_CORRECT_ANSWERS[q.id] = '';
  } else {
    PIN_CORRECT_ANSWERS[q.id] = q.answer as string;
  }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatAnswerGiven(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join(', ');
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(' | ');
    }
  } catch { /* plain string */ }
  return raw;
}

export function scoreRows(rows: AnswerRow[]): { correct: number; total: number } {
  const scorable = rows.filter(r => r.correct !== null);
  return { correct: scorable.filter(r => r.correct === true).length, total: scorable.length };
}

export function buildAnswerReview(answers: Answer[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];

  const p0 = answers.filter(a => a.phase === 'phase0');
  if (p0.length > 0) {
    const rows: AnswerRow[] = p0.map(a => ({
      questionLabel: PHASE0_LABELS[a.question_id] ?? a.question_id,
      given: a.answer_given,
      correct: a.correct,
      correctAnswer: PHASE0_LABELS[a.question_id] ?? a.question_id,
    }));
    groups.push({ key: 'phase0', label: 'Overview Map', rows, score: scoreRows(rows) });
  }

  for (const section of SECTIONS) {
    const phaseKey = `phase1_${section.id}`;
    const sa = answers.filter(a => a.phase === phaseKey);
    const ma = answers.filter(a => a.phase === `phase1_mini_${section.id}`);
    if (sa.length === 0 && ma.length === 0) continue;

    const rows: AnswerRow[] = sa.map(a => ({
      questionLabel: LANDMARK_LABELS[a.question_id] ?? a.question_id,
      given: a.answer_given,
      correct: a.correct,
      correctAnswer: LANDMARK_LABELS[a.question_id] ?? a.question_id,
    }));

    const subGroups: SubGroup[] = [];
    for (const pq of PIN_QUIZZES) {
      if (!section.landmarks.some(lm => lm.id === pq.landmarkId)) continue;
      const pa = answers.filter(a => a.phase === `phase1_pin_${pq.landmarkId}`);
      if (pa.length === 0) continue;

      const pinRows: AnswerRow[] = pq.questions.map(q => {
        const a = pa.find(r => r.question_id === q.id);
        const rawGiven = a?.answer_given ?? null;
        const formatted = formatAnswerGiven(rawGiven);
        const correctStr = PIN_CORRECT_ANSWERS[q.id] ?? '';
        let correct: boolean | null = null;
        if (correctStr !== '') {
          if (q.type === 'multiselect') {
            const givenArr: string[] = rawGiven ? JSON.parse(rawGiven) : [];
            const correctArr = Array.isArray(q.answer) ? (q.answer as string[]) : [];
            correct = givenArr.length === correctArr.length && givenArr.every(x => correctArr.includes(x));
          } else {
            correct = rawGiven !== null && rawGiven.toLowerCase() === String(q.answer).toLowerCase();
          }
        }
        return { questionLabel: PIN_QUESTION_LABELS[q.id] ?? q.id, given: formatted, correct, correctAnswer: correctStr };
      });

      const landmarkLabel = LANDMARK_LABELS[pq.landmarkId] ?? pq.landmarkId;
      subGroups.push({ key: `phase1_pin_${pq.landmarkId}`, label: `${landmarkLabel} — Project Quiz`, rows: pinRows, score: scoreRows(pinRows) });
    }

    if (ma.length > 0) {
      const miniRows: AnswerRow[] = ma.map(a => {
        const q = QUESTION_MAP[a.question_id];
        const hasCorrect = q?.type !== 'freetext' && q?.answer !== '' && q?.answer !== undefined;
        return {
          id: a.question_id,
          questionLabel: q?.question ?? a.question_id,
          given: formatAnswerGiven(a.answer_given),
          correct: hasCorrect ? a.correct : null,
          correctAnswer: Array.isArray(q?.answer) ? (q.answer as string[]).join(', ') : (q?.answer ?? ''),
        };
      });
      subGroups.push({ key: `phase1_mini_${section.id}`, label: `${section.label} — Section Quiz`, rows: miniRows, score: scoreRows(miniRows) });
    }

    groups.push({ key: phaseKey, label: section.label, rows, score: scoreRows(rows), subGroups: subGroups.length > 0 ? subGroups : undefined });
  }

  const p2 = answers.filter(a => a.phase === 'phase2');
  if (p2.length > 0) {
    const rows: AnswerRow[] = p2.map(a => {
      const q = QUESTION_MAP[a.question_id];
      const hasCorrect = q?.answer !== '' && q?.answer !== undefined;
      return {
        id: a.question_id,
        questionLabel: q?.question ?? a.question_id,
        given: formatAnswerGiven(a.answer_given),
        correct: hasCorrect ? a.correct : null,
        correctAnswer: Array.isArray(q?.answer) ? (q.answer as string[]).join(', ') : (q?.answer as string ?? ''),
      };
    });
    groups.push({ key: 'phase2', label: 'Knowledge Quiz', rows, score: scoreRows(rows) });
  }

  return groups;
}
