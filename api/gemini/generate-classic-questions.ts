export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY غير موجود. أضفه في Vercel → Settings → Environment Variables باسم GEMINI_API_KEY بدون VITE_',
    });
  }

  // ✅ Vercel يحلل body تلقائياً — لا نقرأ من stream
  const body = req.body || {};
  const { subject, topic, level, count, type } = body;
  const finalCount = Math.min(Number(count) || 3, 10);
  const finalType = type === 'written' ? 'written' : 'mcq';

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth = (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');
  let note = '';
  if (isIslamic) note = 'استخدم "الفرائض" وليس "الأركان".';
  else if (isArabicSixth) note = 'تجنب أسئلة التوكيد والمستثنى.';

  const prompt = `أنت مصمم مناهج للمدارس الابتدائية المغربية.
ولد بالضبط ${finalCount} اسئلة للمستوى ${level || 'الثالث'} مادة ${subject || 'الرياضيات'} موضوع ${topic || 'عام'}.
النوع: ${finalType === 'written' ? 'كتابي' : 'اختيار من متعدد 4 خيارات'}.
${note}
اجب بـ JSON مصفوفة فقط بدون markdown:
[{"text":"نص السؤال","options":["أ","ب","ج","د"],"correctAnswer":"أ","points":1000,"type":"mcq"}]
correctAnswer يطابق تماما احد عناصر options.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );
    clearTimeout(timeoutId);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({
        success: false,
        error: `Gemini API خطا ${geminiRes.status}: ${errText.slice(0, 300)}`,
      });
    }

    const data = await geminiRes.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawText) {
      return res.status(500).json({
        success: false,
        error: 'Gemini لم يرجع محتوى. تحقق من حدود الاستخدام في Google AI Studio.',
      });
    }

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({
        success: false,
        error: `Gemini ارجع نصا غير JSON: ${rawText.slice(0, 200)}`,
      });
    }

    const questions = JSON.parse(jsonMatch[0]);
    const validated = questions.map((q: any) => {
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const match = opts.find((o: string) => o.trim() === (q.correctAnswer || '').trim());
      return { ...q, correctAnswer: match || opts[0] || q.correctAnswer };
    });

    return res.status(200).json({ success: true, questions: validated });
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return res.status(500).json({
      success: false,
      error: isTimeout
        ? 'Gemini API استغرق وقتا طويلا. حاول مرة اخرى.'
        : `خطا داخلي: ${err.message}`,
    });
  }
}
