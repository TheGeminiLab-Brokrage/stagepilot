// Client-side only — imported dynamically to avoid SSR issues with html2pdf.js

interface QuestionDetail {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
  questionText?: string
  userAnswer?: string
  reasoning?: string
}

export interface ExamReportData {
  id: string
  phase1_score: number
  phase1_max: number
  phase2_score: number
  phase2_max: number
  phase3_completed: boolean
  phase1_details?: QuestionDetail[]
  phase2_details?: QuestionDetail[]
  created_at: string
}

export interface ReportSummary {
  strengths: string
  weaknesses: string
  recommendation: string
}

// ─── Word ─────────────────────────────────────────────────────────────────────

export async function generateWord(data: ExamReportData, userName: string, summary: ReportSummary): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, ShadingType,
  } = await import('docx')

  const total = data.phase1_score + data.phase2_score
  const max = data.phase1_max + data.phase2_max
  const pct = max > 0 ? Math.round((total / max) * 100) : 0
  const passed = pct >= 60
  const dateStr = new Date(data.created_at).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })

  // Helper: single RTL paragraph with optional shading
  const rtlP = (text: string, opts: {
    bold?: boolean; size?: number; color?: string;
    fill?: string; spacing?: { before?: number; after?: number }
  } = {}) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      ...(opts.fill ? { shading: { type: ShadingType.CLEAR, fill: opts.fill } } : {}),
      spacing: opts.spacing ?? {},
      children: [new TextRun({
        text,
        bold: opts.bold ?? false,
        size: opts.size ?? 24,
        color: opts.color ?? '111827',
        font: 'Arial',
        rightToLeft: true,
      })],
    })

  const sectionHeading = (text: string, pageBreak = false) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      pageBreakBefore: pageBreak,
      children: [new TextRun({ text, bold: true, size: 32, color: '111827', font: 'Arial', rightToLeft: true })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'D7FF00' } },
      spacing: { before: pageBreak ? 0 : 400, after: 240 },
    })

  const questionParagraphs = (questions: QuestionDetail[], phaseLabel: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = []
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      rows.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 160, after: 60 },
          shading: { type: ShadingType.CLEAR, fill: q.correct ? 'f0fdf4' : 'fff5f5' },
          children: [
            new TextRun({ text: `${phaseLabel} — س${i + 1}: `, bold: true, size: 22, color: '374151', font: 'Arial', rightToLeft: true }),
            new TextRun({ text: q.questionText ?? q.id, size: 22, color: '111827', font: 'Arial', rightToLeft: true }),
          ],
        }),
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: 'إجابة المتقدم: ', size: 20, color: '6b7280', font: 'Arial', rightToLeft: true }),
            new TextRun({ text: q.userAnswer ?? '—', bold: true, size: 20, color: q.correct ? '16a34a' : 'dc2626', font: 'Arial', rightToLeft: true }),
            ...(q.correct ? [] : [
              new TextRun({ text: '    |    الإجابة الصحيحة: ', size: 20, color: '6b7280', font: 'Arial', rightToLeft: true }),
              new TextRun({ text: q.correctAnswer, bold: true, size: 20, color: '16a34a', font: 'Arial', rightToLeft: true }),
            ]),
            new TextRun({ text: `    (${q.pointsEarned}/${q.maxPoints})`, size: 20, color: q.correct ? '16a34a' : 'dc2626', font: 'Arial', rightToLeft: true }),
          ],
        }),
        ...((!q.correct && q.reasoning) ? [new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 20, after: 80 },
          children: [new TextRun({ text: q.reasoning, italics: true, size: 18, color: '6b7280', font: 'Arial', rightToLeft: true })],
        })] : []),
      )
    }
    return rows
  }

  const summaryLabelP = (text: string) =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      shading: { type: ShadingType.CLEAR, fill: '111827' },
      spacing: { before: 200, after: 60 },
      children: [new TextRun({ text, bold: true, size: 22, color: 'D7FF00', font: 'Arial', rightToLeft: true })],
    })

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: 'portrait' } } },
      children: [
        // ── Page 1: Header band + Scores ──────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          shading: { type: ShadingType.CLEAR, fill: '111827' },
          spacing: { after: 0 },
          children: [new TextRun({ text: `المتقدم: ${userName}`, bold: true, size: 48, color: 'FFFFFF', font: 'Arial', rightToLeft: true })],
        }),
        rtlP(`التاريخ: ${dateStr}`, { size: 22, color: '9ca3af', fill: '111827', spacing: { after: 0 } }),
        rtlP(`النتيجة: ${passed ? '✓ ناجح' : '✗ راسب'}`, { bold: true, size: 26, color: passed ? '6ee7b7' : 'fca5a5', fill: '111827', spacing: { after: 400 } }),

        sectionHeading('ملخص الدرجات'),
        rtlP(`المرحلة الأولى: ${data.phase1_score}/${data.phase1_max}`, { size: 22, spacing: { after: 60 } }),
        rtlP(`المرحلة الثانية: ${data.phase2_score}/${data.phase2_max}`, { size: 22, spacing: { after: 60 } }),
        rtlP(`الإجمالي: ${total}/${max} (${pct}%)`, { bold: true, size: 26, color: passed ? '166534' : '991b1b', spacing: { after: 0 } }),

        // ── Phase 1: new page ─────────────────────────────────────────────
        ...(data.phase1_details?.length ? [
          sectionHeading('المرحلة الأولى — الأسئلة', true),
          ...questionParagraphs(data.phase1_details, 'المرحلة الأولى'),
        ] : []),

        // ── Phase 2: new page ─────────────────────────────────────────────
        ...(data.phase2_details?.length ? [
          sectionHeading('المرحلة الثانية — السيناريوهات', true),
          ...questionParagraphs(data.phase2_details, 'المرحلة الثانية'),
        ] : []),

        // ── Summary: new page ─────────────────────────────────────────────
        sectionHeading('ملخص التقييم', true),
        summaryLabelP('✓ نقاط القوة'),
        rtlP(summary.strengths, { size: 22, spacing: { after: 0 } }),
        summaryLabelP('✗ نقاط تحتاج تطوير'),
        rtlP(summary.weaknesses, { size: 22, spacing: { after: 0 } }),
        summaryLabelP('📚 توصيات للدراسة'),
        rtlP(summary.recommendation, { size: 22, spacing: { after: 0 } }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dateLabel = new Date(data.created_at).toISOString().slice(0, 10)
  a.href = url
  a.download = `exam-report-${userName.replace(/\s+/g, '-')}-${dateLabel}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
