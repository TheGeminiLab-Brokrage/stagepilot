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

function buildReportHTML(data: ExamReportData, userName: string, summary: ReportSummary): string {
  const total = data.phase1_score + data.phase2_score
  const max = data.phase1_max + data.phase2_max
  const pct = max > 0 ? Math.round((total / max) * 100) : 0
  const passed = pct >= 60
  const dateStr = new Date(data.created_at).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' })

  const renderQuestion = (q: QuestionDetail, index: number) => `
    <div style="margin-bottom:10px; padding:12px 14px; border-radius:8px;
      background:${q.correct ? '#f0fdf4' : '#fff5f5'};
      border:1px solid ${q.correct ? '#86efac' : '#fca5a5'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="flex:1;">
          <p style="color:#6b7280; font-size:10px; margin:0 0 4px; font-family:monospace;">س${index + 1}</p>
          <p style="color:#111827; font-size:13px; line-height:1.6; margin:0 0 8px;">${q.questionText ?? q.id}</p>
          <div style="font-size:12px; color:#4b5563;">
            إجابة المتقدم: <span style="color:${q.correct ? '#16a34a' : '#dc2626'}; font-weight:600;">${q.userAnswer ?? '—'}</span>
            ${!q.correct ? `&nbsp;&nbsp; الإجابة الصحيحة: <span style="color:#16a34a; font-weight:600;">${q.correctAnswer}</span>` : ''}
          </div>
          ${!q.correct && q.reasoning ? `<p style="color:#6b7280; font-size:11px; margin:6px 0 0; line-height:1.6;">${q.reasoning}</p>` : ''}
        </div>
        <span style="font-size:13px; font-weight:700; color:${q.correct ? '#16a34a' : '#dc2626'}; white-space:nowrap;">
          ${q.pointsEarned}/${q.maxPoints}
        </span>
      </div>
    </div>`

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 14px; color: #111827; background: #fff; direction: rtl; }
  .page { padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 800; color: #111827; }
  h2 { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
  .section { margin-bottom: 32px; }
  .header-card { background: #111827; color: #fff; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
  .badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .pass { background: #dcfce7; color: #166534; }
  .fail { background: #fee2e2; color: #991b1b; }
  .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
  .score-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
  .score-card .label { font-size: 11px; color: #6b7280; margin-bottom: 6px; }
  .score-card .value { font-size: 20px; font-weight: 800; color: #111827; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; }
  .summary-section { margin-bottom: 16px; }
  .summary-section:last-child { margin-bottom: 0; }
  .summary-label { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-text { font-size: 13px; color: #334155; line-height: 1.7; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header-card">
    <p style="color:#9ca3af; font-size:11px; margin-bottom:8px; letter-spacing:0.1em;">تقرير الاختبار التقييمي — StagePilot</p>
    <h1 style="color:#fff; margin-bottom:6px;">${userName}</h1>
    <p style="color:#9ca3af; font-size:13px; margin-bottom:16px;">${dateStr}</p>
    <span class="badge ${passed ? 'pass' : 'fail'}">${passed ? '✓ ناجح' : '✗ راسب'}</span>
  </div>

  <!-- Score summary -->
  <div class="score-grid">
    <div class="score-card">
      <div class="label">المرحلة الأولى</div>
      <div class="value">${data.phase1_score}/${data.phase1_max}</div>
    </div>
    <div class="score-card">
      <div class="label">المرحلة الثانية</div>
      <div class="value">${data.phase2_score}/${data.phase2_max}</div>
    </div>
    <div class="score-card">
      <div class="label">الإجمالي</div>
      <div class="value">${total}/${max} <span style="font-size:14px;color:#6b7280;">(${pct}%)</span></div>
    </div>
  </div>

  <!-- Phase 1 -->
  ${data.phase1_details?.length ? `
  <div class="section">
    <h2>المرحلة الأولى — الأسئلة</h2>
    ${data.phase1_details.map((q, i) => renderQuestion(q, i)).join('')}
  </div>` : ''}

  <!-- Phase 2 -->
  ${data.phase2_details?.length ? `
  <div class="section">
    <h2>المرحلة الثانية — السيناريوهات</h2>
    ${data.phase2_details.map((q, i) => renderQuestion(q, i)).join('')}
  </div>` : ''}

  <!-- AI Summary -->
  <div class="section">
    <h2>ملخص التقييم</h2>
    <div class="summary-card">
      <div class="summary-section">
        <div class="summary-label">✓ نقاط القوة</div>
        <div class="summary-text">${summary.strengths}</div>
      </div>
      <div class="summary-section">
        <div class="summary-label">✗ نقاط تحتاج تطوير</div>
        <div class="summary-text">${summary.weaknesses}</div>
      </div>
      <div class="summary-section">
        <div class="summary-label">📚 توصيات للدراسة</div>
        <div class="summary-text">${summary.recommendation}</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`
}

export async function generatePDF(data: ExamReportData, userName: string, summary: ReportSummary): Promise<void> {
  // Dynamically import to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default
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
    })
    .from(html)
    .save()
}

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

  const rtlParagraph = (text: string, bold = false, size = 24, color = '111827') =>
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, bold, size, color, font: 'Arial' })],
    })

  const sectionHeading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, bold: true, size: 28, color: '111827', font: 'Arial' })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'e5e7eb' } },
      spacing: { before: 400, after: 200 },
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
            new TextRun({ text: `${phaseLabel} — س${i + 1}: `, bold: true, size: 22, color: '374151', font: 'Arial' }),
            new TextRun({ text: q.questionText ?? q.id, size: 22, color: '111827', font: 'Arial' }),
          ],
        }),
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: 'إجابة المتقدم: ', size: 20, color: '6b7280', font: 'Arial' }),
            new TextRun({ text: q.userAnswer ?? '—', bold: true, size: 20, color: q.correct ? '16a34a' : 'dc2626', font: 'Arial' }),
            ...(q.correct ? [] : [
              new TextRun({ text: '    |    الإجابة الصحيحة: ', size: 20, color: '6b7280', font: 'Arial' }),
              new TextRun({ text: q.correctAnswer, bold: true, size: 20, color: '16a34a', font: 'Arial' }),
            ]),
            new TextRun({ text: `    (${q.pointsEarned}/${q.maxPoints})`, size: 20, color: q.correct ? '16a34a' : 'dc2626', font: 'Arial' }),
          ],
        }),
        ...((!q.correct && q.reasoning) ? [new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 20, after: 80 },
          children: [new TextRun({ text: q.reasoning, italics: true, size: 18, color: '6b7280', font: 'Arial' })],
        })] : []),
      )
    }
    return rows
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: 'portrait' } } },
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'تقرير الاختبار التقييمي — StagePilot', bold: true, size: 36, color: '111827', font: 'Arial' })],
          spacing: { after: 200 },
        }),
        rtlParagraph(`المتقدم: ${userName}`, true, 26),
        rtlParagraph(`التاريخ: ${dateStr}`, false, 22, '6b7280'),
        rtlParagraph(`النتيجة: ${passed ? '✓ ناجح' : '✗ راسب'}`, true, 24, passed ? '166534' : '991b1b'),

        // Scores
        sectionHeading('ملخص الدرجات'),
        rtlParagraph(`المرحلة الأولى: ${data.phase1_score}/${data.phase1_max}`, false, 22),
        rtlParagraph(`المرحلة الثانية: ${data.phase2_score}/${data.phase2_max}`, false, 22),
        rtlParagraph(`الإجمالي: ${total}/${max} (${pct}%)`, true, 24),

        // Phase 1 details
        ...(data.phase1_details?.length ? [
          sectionHeading('المرحلة الأولى — الأسئلة'),
          ...questionParagraphs(data.phase1_details, 'المرحلة الأولى'),
        ] : []),

        // Phase 2 details
        ...(data.phase2_details?.length ? [
          sectionHeading('المرحلة الثانية — السيناريوهات'),
          ...questionParagraphs(data.phase2_details, 'المرحلة الثانية'),
        ] : []),

        // AI Summary
        sectionHeading('ملخص التقييم'),
        rtlParagraph('✓ نقاط القوة', true, 22, '166534'),
        rtlParagraph(summary.strengths, false, 22),
        new Paragraph({ spacing: { before: 160 }, children: [] }),
        rtlParagraph('✗ نقاط تحتاج تطوير', true, 22, '991b1b'),
        rtlParagraph(summary.weaknesses, false, 22),
        new Paragraph({ spacing: { before: 160 }, children: [] }),
        rtlParagraph('📚 توصيات للدراسة', true, 22, '1e40af'),
        rtlParagraph(summary.recommendation, false, 22),
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
