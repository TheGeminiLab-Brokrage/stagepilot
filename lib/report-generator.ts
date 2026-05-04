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

// ─── PDF ─────────────────────────────────────────────────────────────────────

function buildReportHTML(data: ExamReportData, userName: string, summary: ReportSummary): string {
  const total = data.phase1_score + data.phase2_score
  const max = data.phase1_max + data.phase2_max
  const pct = max > 0 ? Math.round((total / max) * 100) : 0
  const passed = pct >= 60
  const dateStr = new Date(data.created_at).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })

  const renderQuestion = (q: QuestionDetail, index: number) => `
    <div style="margin-bottom:10px;padding:12px 14px;border-radius:8px;
      background:${q.correct ? '#f0fdf4' : '#fff5f5'};
      border:1px solid ${q.correct ? '#86efac' : '#fca5a5'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;">
          <p style="color:#6b7280;font-size:10px;margin:0 0 4px;font-family:monospace;">س${index + 1}</p>
          <p style="color:#111827;font-size:13px;line-height:1.6;margin:0 0 8px;">${q.questionText ?? q.id}</p>
          <div style="font-size:12px;color:#4b5563;">
            إجابة المتقدم: <span style="color:${q.correct ? '#16a34a' : '#dc2626'};font-weight:600;">${q.userAnswer ?? '—'}</span>
            ${!q.correct ? `&nbsp;&nbsp; الإجابة الصحيحة: <span style="color:#16a34a;font-weight:600;">${q.correctAnswer}</span>` : ''}
          </div>
          ${!q.correct && q.reasoning ? `<p style="color:#6b7280;font-size:11px;margin:6px 0 0;line-height:1.6;">${q.reasoning}</p>` : ''}
        </div>
        <span style="font-size:13px;font-weight:700;color:${q.correct ? '#16a34a' : '#dc2626'};white-space:nowrap;">
          ${q.pointsEarned}/${q.maxPoints}
        </span>
      </div>
    </div>`

  const pageBreak = `<div class="html2pdf__page-break"></div>`

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; font-size:14px; color:#111827; background:#fff; direction:rtl; }
  .page { padding:40px; max-width:800px; margin:0 auto; }
  h2 { font-size:18px; font-weight:800; color:#111827; margin-bottom:14px; padding-bottom:10px; border-bottom:3px solid #D7FF00; }
  .header-card { background:#111827; color:#fff; border-radius:12px; padding:28px 32px; margin-bottom:28px; }
  .header-name { font-size:26px; font-weight:800; color:#fff; margin-bottom:6px; }
  .header-meta { color:#9ca3af; font-size:13px; margin-bottom:14px; }
  .badge { display:inline-block; padding:5px 16px; border-radius:20px; font-size:13px; font-weight:700; }
  .pass { background:rgba(16,185,129,0.2); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4); }
  .fail { background:rgba(248,113,113,0.2); color:#fca5a5; border:1px solid rgba(248,113,113,0.4); }
  .scores { margin-bottom:0; }
  .score-row { display:flex; gap:16px; margin-bottom:8px; font-size:14px; color:#374151; }
  .score-label { color:#6b7280; min-width:140px; }
  .score-value { font-weight:700; color:#111827; }
  .score-total { font-size:16px; font-weight:800; color:#D7FF00; background:#111827; padding:10px 16px; border-radius:8px; display:inline-block; margin-top:8px; }
  .section { margin-bottom:0; }
  .summary-label { font-size:12px; font-weight:800; color:#D7FF00; background:#111827; display:inline-block; padding:3px 10px; border-radius:4px; margin-bottom:8px; }
  .summary-text { font-size:13px; color:#334155; line-height:1.7; margin-bottom:20px; white-space:pre-line; }
</style>
</head>
<body>
<div class="page">

  <!-- Page 1: Header + Scores -->
  <div class="header-card">
    <div class="header-name">${userName}</div>
    <div class="header-meta">${dateStr}</div>
    <span class="badge ${passed ? 'pass' : 'fail'}">${passed ? '✓ ناجح' : '✗ راسب'}</span>
  </div>

  <h2>ملخص الدرجات</h2>
  <div class="scores">
    <div class="score-row"><span class="score-label">المرحلة الأولى:</span><span class="score-value">${data.phase1_score}/${data.phase1_max}</span></div>
    <div class="score-row"><span class="score-label">المرحلة الثانية:</span><span class="score-value">${data.phase2_score}/${data.phase2_max}</span></div>
    <div class="score-total">الإجمالي: ${total}/${max} (${pct}%)</div>
  </div>

  ${data.phase1_details?.length ? `
  ${pageBreak}
  <div class="section">
    <h2>المرحلة الأولى — الأسئلة</h2>
    ${data.phase1_details.map((q, i) => renderQuestion(q, i)).join('')}
  </div>` : ''}

  ${data.phase2_details?.length ? `
  ${pageBreak}
  <div class="section">
    <h2>المرحلة الثانية — السيناريوهات</h2>
    ${data.phase2_details.map((q, i) => renderQuestion(q, i)).join('')}
  </div>` : ''}

  ${pageBreak}
  <div class="section">
    <h2>ملخص التقييم</h2>
    <div class="summary-label">✓ نقاط القوة</div>
    <div class="summary-text">${summary.strengths}</div>
    <div class="summary-label">✗ نقاط تحتاج تطوير</div>
    <div class="summary-text">${summary.weaknesses}</div>
    <div class="summary-label">📚 توصيات للدراسة</div>
    <div class="summary-text">${summary.recommendation}</div>
  </div>

</div>
</body>
</html>`
}

export async function generatePDF(data: ExamReportData, userName: string, summary: ReportSummary): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (await import('html2pdf.js')).default as any
  const html = buildReportHTML(data, userName, summary)
  const dateStr = new Date(data.created_at).toISOString().slice(0, 10)
  const filename = `exam-report-${userName.replace(/\s+/g, '-')}-${dateStr}.pdf`

  await html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: 'legacy' },
    })
    .from(html)
    .save()
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
