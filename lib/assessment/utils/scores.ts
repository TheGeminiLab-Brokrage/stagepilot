import { SECTIONS } from '@/lib/assessment/data/landmarks';
import { QUESTIONS } from '@/lib/assessment/data/questions';
import { PIN_QUIZZES } from '@/lib/assessment/data/pin-quizzes';
import type { Answer } from '@/lib/assessment/types';

export interface SectionScore {
  key: string;
  label: string;
  correct: number;
  total: number;
  pct: number;
  tip: string;
}

const LANDMARK_LABELS: Record<string, string> = {};
SECTIONS.forEach(s => s.landmarks.forEach(lm => { LANDMARK_LABELS[lm.id] = lm.label; }));

const PIN_CORRECT_ANSWERS: Record<string, string> = {};
PIN_QUIZZES.forEach(pq => pq.questions.forEach(q => {
  if (q.type === 'multiselect' && Array.isArray(q.answer)) {
    PIN_CORRECT_ANSWERS[q.id] = (q.answer as string[]).join(', ');
  } else if (q.type === 'freetext' || q.type === 'pricegroup') {
    PIN_CORRECT_ANSWERS[q.id] = '';
  } else {
    PIN_CORRECT_ANSWERS[q.id] = q.answer as string;
  }
}));

export const PASS_THRESHOLD = 0.7;

export function computeScores(answers: Answer[]): SectionScore[] {
  const scores: SectionScore[] = [];

  const p0 = answers.filter(a => a.phase === 'phase0');
  if (p0.length > 0) {
    const correct = p0.filter(a => a.correct).length;
    scores.push({ key: 'phase0', label: 'Overview Map', correct, total: p0.length, pct: correct / p0.length, tip: 'Review the positions of all 6 North Coast locations on the map.' });
  }

  for (const section of SECTIONS) {
    const phaseKey = `phase1_${section.id}`;
    const sa = answers.filter(a => a.phase === phaseKey);
    if (sa.length > 0) {
      const correct = sa.filter(a => a.correct).length;
      scores.push({ key: phaseKey, label: section.label, correct, total: sa.length, pct: correct / sa.length, tip: section.improvementTip });
    }
  }

  for (const pq of PIN_QUIZZES) {
    const phaseKey = `phase1_pin_${pq.landmarkId}`;
    const pa = answers.filter(a => a.phase === phaseKey);
    if (pa.length === 0) continue;
    const scorableQIds = new Set(pq.questions.filter(q => PIN_CORRECT_ANSWERS[q.id] !== '').map(q => q.id));
    const scorable = pa.filter(a => scorableQIds.has(a.question_id));
    const correct = scorable.filter(a => a.correct).length;
    const total = scorable.length;
    if (total === 0) continue;
    const landmarkLabel = LANDMARK_LABELS[pq.landmarkId] ?? pq.landmarkId;
    scores.push({ key: phaseKey, label: `${landmarkLabel} — Project Quiz`, correct, total, pct: correct / total, tip: `Review the project-specific details for ${landmarkLabel}.` });
  }

  for (const section of SECTIONS) {
    const miniKey = `phase1_mini_${section.id}`;
    const ma = answers.filter(a => a.phase === miniKey);
    if (ma.length === 0) continue;
    const correct = ma.filter(a => a.correct).length;
    scores.push({ key: miniKey, label: `${section.label} — Section Quiz`, correct, total: ma.length, pct: correct / ma.length, tip: `Review the section knowledge questions for ${section.label}.` });
  }

  const p2 = answers.filter(a => a.phase === 'phase2');
  if (p2.length > 0) {
    const correct = p2.filter(a => a.correct).length;
    scores.push({ key: 'phase2', label: 'Knowledge Quiz', correct, total: p2.length, pct: correct / p2.length, tip: 'Review the quiz questions and correct answers to strengthen your product knowledge.' });
  }

  return scores;
}

export function computeOverall(scores: SectionScore[]): number {
  if (!scores.length) return 0;
  const totalCorrect = scores.reduce((s, x) => s + x.correct, 0);
  const totalQ = scores.reduce((s, x) => s + x.total, 0);
  return totalQ > 0 ? totalCorrect / totalQ : 0;
}

export function averageScores(allSessionScores: SectionScore[][]): SectionScore[] {
  const map = new Map<string, { label: string; tip: string; totalCorrect: number; totalItems: number }>();
  for (const scores of allSessionScores) {
    for (const s of scores) {
      const entry = map.get(s.key) ?? { label: s.label, tip: s.tip, totalCorrect: 0, totalItems: 0 };
      entry.totalCorrect += s.correct;
      entry.totalItems += s.total;
      map.set(s.key, entry);
    }
  }
  return Array.from(map.entries()).map(([key, e]) => ({
    key,
    label: e.label,
    correct: e.totalCorrect,
    total: e.totalItems,
    pct: e.totalItems > 0 ? e.totalCorrect / e.totalItems : 0,
    tip: e.tip,
  }));
}

export function getQuestionLabel(questionId: string): string {
  const q = QUESTIONS.find(x => x.id === questionId);
  return q?.question ?? questionId;
}
