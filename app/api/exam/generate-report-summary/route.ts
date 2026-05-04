import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

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

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phase1_details, phase2_details, phase1_score, phase1_max, phase2_score, phase2_max, userName } = await req.json()

  const wrongPhase1 = (phase1_details as QuestionDetail[] ?? []).filter(q => !q.correct)
  const wrongPhase2 = (phase2_details as QuestionDetail[] ?? []).filter(q => !q.correct)
  const correctPhase1 = (phase1_details as QuestionDetail[] ?? []).filter(q => q.correct)
  const correctPhase2 = (phase2_details as QuestionDetail[] ?? []).filter(q => q.correct)

  const phase1Pct = phase1_max > 0 ? Math.round((phase1_score / phase1_max) * 100) : 0
  const phase2Pct = phase2_max > 0 ? Math.round((phase2_score / phase2_max) * 100) : 0

  const wrongQuestionsText = [
    ...wrongPhase1.map((q, i) => `المرحلة الأولى - س${i + 1}: ${q.questionText ?? q.id}\nإجابة المتقدم: ${q.userAnswer ?? '—'}\nالإجابة الصحيحة: ${q.correctAnswer}`),
    ...wrongPhase2.map((q, i) => `المرحلة الثانية - سيناريو${i + 1}: ${q.questionText ?? q.id}\nإجابة المتقدم: ${q.userAnswer ?? '—'}\nالإجابة الصحيحة: ${q.correctAnswer}\n${q.reasoning ? `السبب: ${q.reasoning}` : ''}`),
  ].join('\n\n')

  const correctQuestionsText = [
    ...correctPhase1.slice(0, 5).map((q, i) => `المرحلة الأولى - س${i + 1}: ${q.questionText ?? q.id}`),
    ...correctPhase2.slice(0, 5).map((q, i) => `المرحلة الثانية - سيناريو${i + 1}: ${q.questionText ?? q.id}`),
  ].join('\n\n')

  const prompt = `أنت مدرب مبيعات عقارية خبير. قم بتحليل نتائج اختبار المتقدم "${userName}" وأعطِ تقييماً مفصلاً.

نتائج الاختبار:
- المرحلة الأولى: ${phase1_score}/${phase1_max} (${phase1Pct}%)
- المرحلة الثانية: ${phase2_score}/${phase2_max} (${phase2Pct}%)

الأسئلة التي أخطأ فيها المتقدم:
${wrongQuestionsText || 'لا توجد أخطاء'}

أمثلة على الأسئلة التي أجاب عليها بشكل صحيح:
${correctQuestionsText || 'لا توجد إجابات صحيحة'}

اكتب تحليلاً باللغة العربية يتضمن:
1. نقاط القوة (ما يتقنه المتقدم)
2. نقاط الضعف (ما يحتاج إلى تطوير)
3. توصيات للدراسة (ماذا يجب أن يركز عليه)

أجب بـ JSON فقط بهذا الشكل:
{"strengths": "...", "weaknesses": "...", "recommendation": "..."}`

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const text = completion.choices[0].message.content?.trim() ?? '{}'
    const parsed = JSON.parse(text)

    return NextResponse.json({
      strengths: parsed.strengths ?? '',
      weaknesses: parsed.weaknesses ?? '',
      recommendation: parsed.recommendation ?? '',
    })
  } catch {
    const correctSample = [...correctPhase1, ...correctPhase2].slice(0, 5)
    const wrongAll = [...wrongPhase1, ...wrongPhase2]

    const strengthsText = correctSample.length > 0
      ? `أجاب المتقدم بشكل صحيح على: ${correctSample.map(q => q.questionText ?? q.id).join('، ')}.`
      : 'لم يُسجَّل أداء صحيح في هذا الاختبار.'

    const weaknessesText = wrongAll.length > 0
      ? `أخطأ المتقدم في الأسئلة التالية:\n${wrongAll.map(q => `- ${q.questionText ?? q.id} (الإجابة الصحيحة: ${q.correctAnswer})`).join('\n')}`
      : 'لا توجد أخطاء واضحة — أحسنت!'

    const recommendationText = wrongAll.length > 0
      ? `يُنصح بمراجعة الأسئلة التالية وفهم إجاباتها الصحيحة:\n${wrongAll.map(q => `- ${q.questionText ?? q.id}`).join('\n')}`
      : 'استمر في المستوى الممتاز والحرص على تطبيق ما تعلمته في المواقف العملية.'

    return NextResponse.json({
      strengths: strengthsText,
      weaknesses: weaknessesText,
      recommendation: recommendationText,
    })
  }
}
