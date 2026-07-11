import { CAPITAL_ZONES } from '@/lib/assessment/data/landmarks-capital';
import { CAPITAL_PIN_QUIZZES } from '@/lib/assessment/data/pin-quizzes-capital';
import { CAPITAL_QUESTIONS } from '@/lib/assessment/data/questions-capital';
import { getZoneAnswer, gradeZoneForm, acresVarianceOk } from '@/lib/assessment/data/zone-answers-capital';
import type { Answer } from '@/lib/assessment/types';
import type { SectionScore } from './scores';

export function computeCapitalScores(answers: Answer[]): SectionScore[] {
  const scores: SectionScore[] = [];

  // ── Map phase: one answer per zone ──────────────────────────────────
  const mapAnswers = answers.filter(a => a.phase === 'capital_map');
  if (mapAnswers.length > 0) {
    const correct = mapAnswers.filter(a => {
      if (a.correct) return true;
      if (!a.answer_given) return false;
      try {
        const form = JSON.parse(a.answer_given);
        return gradeZoneForm(form, a.question_id).allOk;
      } catch { return false; }
    }).length;
    scores.push({
      key: 'capital_map',
      label: 'New Capital Map',
      correct,
      total: mapAnswers.length,
      pct: correct / mapAnswers.length,
      tip: 'Review the layout and project locations on the New Capital district map.',
    });
  }

  // ── Pin quizzes: one entry per zone that has a quiz ──────────────────
  for (const pq of CAPITAL_PIN_QUIZZES) {
    const phaseKey = `capital_pin_${pq.landmarkId}`;
    const pa = answers.filter(a => a.phase === phaseKey);
    if (pa.length === 0) continue;
    const scorable = pa.filter(a => {
      const q = pq.questions.find(x => x.id === a.question_id);
      return q && q.type !== 'freetext' && q.type !== 'pricegroup';
    });
    const correct = scorable.filter(a => a.correct).length;
    const total = scorable.length;
    if (total === 0) continue;
    const zoneLabel = CAPITAL_ZONES.find(z => z.id === pq.landmarkId)?.label ?? pq.landmarkId;
    scores.push({
      key: phaseKey,
      label: `${zoneLabel} — Project Quiz`,
      correct,
      total,
      pct: correct / total,
      tip: `Review the project-specific details for zone ${zoneLabel}.`,
    });
  }

  // ── Knowledge quiz ──────────────────────────────────────────────────
  const quizAnswers = answers.filter(a => a.phase === 'capital_quiz');
  if (quizAnswers.length > 0) {
    const correct = quizAnswers.filter(a => a.correct).length;
    scores.push({
      key: 'capital_quiz',
      label: 'Knowledge Quiz',
      correct,
      total: quizAnswers.length,
      pct: correct / quizAnswers.length,
      tip: 'Review the general knowledge questions about the New Administrative Capital.',
    });
  }

  return scores;
}

export function getCapitalQuestionLabel(questionId: string): string {
  const q = CAPITAL_QUESTIONS.find(x => x.id === questionId);
  return q?.question ?? questionId;
}

// ── Answer review builder for the results page ───────────────────────────────

interface AnswerRow {
  id?: string;
  questionLabel: string;
  given: string | null;
  correct: boolean | null;
  correctAnswer: string;
}

interface PhaseGroup {
  key: string;
  label: string;
  rows: AnswerRow[];
  score: { correct: number; total: number };
  subGroups?: { key: string; label: string; rows: AnswerRow[]; score: { correct: number; total: number } }[];
}

function scoreRows(rows: AnswerRow[]): { correct: number; total: number } {
  const scorable = rows.filter(r => r.correct !== null);
  return { correct: scorable.filter(r => r.correct === true).length, total: scorable.length };
}

export function buildCapitalAnswerReview(answers: Answer[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];

  // Map placement phase — always show all zones, even unanswered ones
  {
    const eq = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();
    const rows: AnswerRow[] = CAPITAL_ZONES.map(zone => {
      const a = answers.find(x => x.phase === 'capital_map' && x.question_id === zone.id);
      const ans = getZoneAnswer(zone.id);
      let form: { developer?: string; project?: string; acres?: string } = {};
      if (a?.answer_given) {
        try { form = JSON.parse(a.answer_given); } catch { /* ignore */ }
      }
      const developerOk = ans ? eq(form.developer ?? '', ans.developer) : null;
      const projectOk   = ans ? eq(form.project   ?? '', ans.project)   : null;
      const acresOk     = ans ? acresVarianceOk(form.acres ?? '', ans.acres) : null;
      const allOk       = developerOk && projectOk && acresOk;
      const given        = `Developer: ${form.developer ?? '—'} | Project: ${form.project ?? '—'} | Acres: ${form.acres ?? '—'}`;
      const correctAnswer = ans ? `Developer: ${ans.developer} | Project: ${ans.project} | Acres: ${ans.acres}` : '';
      return {
        questionLabel: `Zone ${zone.code}`,
        given,
        correct: ans ? allOk : null,
        correctAnswer,
      };
    });
    groups.push({ key: 'capital_map', label: 'New Capital Map', rows, score: scoreRows(rows) });
  }

  // Pin quizzes — always show all zones with all questions, even if unanswered
  for (const pq of CAPITAL_PIN_QUIZZES) {
    const phaseKey = `capital_pin_${pq.landmarkId}`;
    const pa = answers.filter(a => a.phase === phaseKey);
    const zoneLabel = CAPITAL_ZONES.find(z => z.id === pq.landmarkId)?.label ?? pq.landmarkId;
    const rows: AnswerRow[] = pq.questions.map(q => {
      const a = pa.find(r => r.question_id === q.id);
      const raw = a?.answer_given ?? null;
      const hasCorrect = q.type !== 'freetext' && q.type !== 'pricegroup';
      const correctAnswer = Array.isArray(q.answer) ? (q.answer as string[]).join(', ') : (q.answer as string ?? '');
      const correct = hasCorrect && raw !== null
        ? raw.toLowerCase() === String(q.answer).toLowerCase()
        : null;
      return { questionLabel: q.question, given: raw, correct, correctAnswer };
    });
    groups.push({ key: phaseKey, label: `${zoneLabel} — Project Quiz`, rows, score: scoreRows(rows) });
  }

  // Knowledge quiz — always show all questions, even unanswered ones
  {
    const rows: AnswerRow[] = CAPITAL_QUESTIONS.map(q => {
      const a = answers.find(x => x.phase === 'capital_quiz' && x.question_id === q.id);
      const hasCorrect = q.type !== 'freetext' && q.type !== 'pricegroup';
      return {
        id: q.id,
        questionLabel: q.question,
        given: a?.answer_given ?? null,
        correct: hasCorrect ? (a?.correct ?? null) : null,
        correctAnswer: Array.isArray(q.answer) ? (q.answer as string[]).join(', ') : (q.answer as string ?? ''),
      };
    });
    groups.push({ key: 'capital_quiz', label: 'Knowledge Quiz', rows, score: scoreRows(rows) });
  }

  return groups;
}
