import { NextRequest, NextResponse } from 'next/server';
import { requireCaller } from '@/lib/assessment/server-auth';

export async function POST(req: NextRequest) {
  const { error, status } = await requireCaller();
  if (error) return NextResponse.json({ error }, { status });

  const { userAnswer, correctAnswer } = await req.json();

  if (!userAnswer || !correctAnswer) {
    return NextResponse.json({ score: 0, feedback: 'إجابة أو نموذج مفقود', isCorrect: false });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ score: 0, feedback: 'خدمة التصحيح غير متاحة', isCorrect: false }, { status: 503 });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'أنت مصحح اختبار معرفة عقارية. قارن إجابة الطالب بالإجابة النموذجية وأعطِ درجة من 0 إلى 100. 100 = تطابق تام، 80+ = مقبول، أقل من 80 = يحتاج مراجعة. تساهل مع الصياغات المختلفة للمعلومة نفسها. أعِد JSON فقط: {"score": <رقم>, "feedback": "<جملة قصيرة بالعربية>"}',
          },
          {
            role: 'user',
            content: `الإجابة النموذجية: ${correctAnswer}\n\nإجابة الطالب: ${userAnswer}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 150,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));

    return NextResponse.json({
      score,
      feedback: parsed.feedback ?? '',
      isCorrect: score >= 80,
    });
  } catch {
    return NextResponse.json({ score: 0, feedback: 'خطأ في التصحيح', isCorrect: false }, { status: 500 });
  }
}
