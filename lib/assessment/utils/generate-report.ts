import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx';

// ─── Types (duplicated locally to avoid circular deps) ────────────────────────

interface Session {
  full_name: string;
  completed_at?: string | null;
}

interface AnswerRow {
  questionLabel: string;
  given: string | null;
  correct: boolean | null;
  correctAnswer: string;
}

interface SubGroup {
  key: string;
  label: string;
  rows: AnswerRow[];
  score: { correct: number; total: number };
}

interface PhaseGroup {
  key: string;
  label: string;
  rows: AnswerRow[];
  score: { correct: number; total: number };
  subGroups?: SubGroup[];
}

interface SectionScore {
  key: string;
  label: string;
  correct: number;
  total: number;
  pct: number;
  tip: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIME = '8BAF00';
const RED = 'EF4444';
const GREY = '555555';
const BLACK = '111111';
const HEADER_BG = 'EEEEEE';
const ROW_BG = 'FFFFFF';

// ─── Paragraph helpers ────────────────────────────────────────────────────────

function h1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 40, color: LIME, font: 'Calibri' })],
    spacing: { before: 200, after: 120 },
  });
}

function h2(text: string, pageBreak = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: BLACK, font: 'Calibri' })],
    spacing: { before: 320, after: 100 },
    pageBreakBefore: pageBreak,
  });
}

function h3(text: string, color = GREY): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color, font: 'Calibri' })],
    spacing: { before: 200, after: 60 },
    pageBreakBefore: true,
  });
}

function meta(label: string, value: string, valueColor = BLACK): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, size: 20, color: GREY, font: 'Calibri' }),
      new TextRun({ text: value, size: 20, color: valueColor, bold: true, font: 'Calibri' }),
    ],
    spacing: { after: 60 },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: '', size: 4 })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
    spacing: { before: 160, after: 160 },
  });
}

function answerLines(row: AnswerRow, indent = 0): Paragraph[] {
  const icon = row.correct === null ? '–' : row.correct ? '✓' : '✗';
  const iconColor = row.correct === null ? GREY : row.correct ? LIME : RED;
  const ps: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: `${icon}  `, bold: true, size: 20, color: iconColor, font: 'Calibri' }),
        new TextRun({ text: row.questionLabel, size: 20, color: BLACK, font: 'Calibri' }),
      ],
      indent: indent ? { left: indent } : undefined,
      spacing: { before: 80, after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'You answered: ', size: 18, color: GREY, font: 'Calibri' }),
        new TextRun({ text: row.given ?? '—', size: 18, bold: true, color: row.correct === null ? GREY : row.correct ? LIME : RED, font: 'Calibri' }),
      ],
      indent: indent ? { left: indent } : undefined,
      spacing: { after: row.correct === false && row.correctAnswer ? 20 : 80 },
    }),
  ];
  if (row.correct === false && row.correctAnswer) {
    ps.push(new Paragraph({
      children: [
        new TextRun({ text: 'Correct answer: ', size: 18, color: GREY, font: 'Calibri' }),
        new TextRun({ text: row.correctAnswer, size: 18, bold: true, color: LIME, font: 'Calibri' }),
      ],
      indent: indent ? { left: indent } : undefined,
      spacing: { after: 80 },
    }));
  }
  return ps;
}

function scoreTable(scores: SectionScore[]): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: thinBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Section', 'Score', '%', 'Result'].map((t, i) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18, color: GREY, font: 'Calibri' })] })],
            width: { size: [55, 20, 15, 10][i], type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: HEADER_BG },
          })
        ),
      }),
      ...scores.map(s => {
        const pass = s.pct >= 0.7;
        return new TableRow({
          children: [
            s.label,
            `${s.correct}/${s.total}`,
            `${Math.round(s.pct * 100)}%`,
            pass ? 'PASS' : 'REVIEW',
          ].map((t, i) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: t, size: 18, color: i >= 2 && pass ? LIME : i >= 2 ? RED : BLACK, bold: i >= 2, font: 'Calibri' })] })],
              shading: { type: ShadingType.SOLID, color: ROW_BG },
            })
          ),
        });
      }),
    ],
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateReportDocx({
  session,
  scores,
  answerGroups,
  title = 'North Coast Assessment Report',
}: {
  session: Session;
  scores: SectionScore[];
  answerGroups: PhaseGroup[];
  title?: string;
}): Promise<Blob> {
  const completedAt = session.completed_at
    ? new Date(session.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'In progress';

  const totalCorrect = scores.reduce((s, x) => s + x.correct, 0);
  const totalQ = scores.reduce((s, x) => s + x.total, 0);
  const overallPct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

  const children: (Paragraph | Table)[] = [
    h1(title),
    meta('Agent', session.full_name),
    meta('Date', completedAt),
    meta('Overall Score', `${overallPct}% (${totalCorrect}/${totalQ} correct)`, overallPct >= 70 ? LIME : RED),
    divider(),

    h2('Section Breakdown'),
    scoreTable(scores),
    divider(),

    h2('Answer Review'),
  ];

  for (const group of answerGroups) {
    const groupPct = group.score.total > 0 ? Math.round((group.score.correct / group.score.total) * 100) : null;
    const groupPass = groupPct !== null && groupPct >= 70;

    children.push(h3(`${group.label}${groupPct !== null ? `  —  ${group.score.correct}/${group.score.total}  ·  ${groupPct}%  ${groupPass ? '✓ PASS' : '⚠ REVIEW'}` : ''}`, groupPass ? LIME : groupPct !== null ? RED : GREY));

    for (const row of group.rows) {
      for (const p of answerLines(row)) children.push(p);
    }

    for (const sub of group.subGroups ?? []) {
      const subPct = sub.score.total > 0 ? Math.round((sub.score.correct / sub.score.total) * 100) : null;
      children.push(new Paragraph({
        children: [new TextRun({ text: `↳  ${sub.label}${subPct !== null ? `  —  ${sub.score.correct}/${sub.score.total} · ${subPct}%` : ''}`, bold: true, size: 20, color: LIME, font: 'Calibri' })],
        indent: { left: 360 },
        spacing: { before: 160, after: 60 },
      }));
      for (const row of sub.rows) {
        for (const p of answerLines(row, 360)) children.push(p);
      }
    }

    children.push(divider());
  }

  // Improvement areas
  const weak = scores.filter(s => s.pct < 0.7);
  if (weak.length > 0) {
    children.push(h2('Improvement Areas', true));
    for (const s of weak) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${s.label}  —  ${Math.round(s.pct * 100)}%`, bold: true, size: 20, color: RED, font: 'Calibri' })],
        spacing: { before: 120, after: 40 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: s.tip, size: 18, color: GREY, font: 'Calibri' })],
        spacing: { after: 100 },
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children,
    }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: BLACK } },
      },
    },
  });

  return Packer.toBlob(doc);
}
