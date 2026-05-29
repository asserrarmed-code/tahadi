// Vercel Serverless Function — Gemini REST API (لا SDK)

async function parseBody(req: any): Promise<any> {
  // Vercel يحلل الـ body تلقائياً — لكن نضيف fallback يدوي للأمان
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req: any, res: any) {
  // CORS headers لضمان قبول الطلبات من frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY غير موجود في Vercel Environment Variables. أضفه في: Settings → Environment Variables → اسم المتغير: GEMINI_API_KEY',
    });
  }

  const body = await parseBody(req);
  const { subject, topic, level, count, type } = body;
  const finalCount = Math.min(Number(count) || 3, 10);
  const finalType = type === 'written' ? 'written' : 'mcq';

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth = (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');

  let pedagogicalNote = '';
  if (isIslamic) pedagogicalNote = 'استخدم "الفرائض" بدلاً من "الأركان" دائماً.';
  else if (isArabicSixth) pedagogicalNote = 'تجنب "التوكيد" و"المستثنى". ركّز على المفعول المطلق، لأجله، التمييز.';

  const prompt = [
    `أنت مصمم مناهج خبير للمدارس الابتدائية المغربية.`,
    `ولّد ${finalCount} أسئلة بيداغوجية للمستوى: ${level || 'الثالث'} - المادة: ${subject || 'الرياضيات'} - الموضوع: ${topic || 'عام'}.`,
    `النوع: ${finalType === 'written' ? 'كتابي (إجابة نصية)' : 'اختيار من متعدد QCM - 4 خيارات بالضبط'}.`,
    pedagogicalNote,
    `أجب بـ JSON مصفوفة نظيفة فقط (بدون markdown):`,
    `[{"text":"...","options":["أ","ب","ج","د"],"correctAnswer":"أ","points":1000,"type":"mcq"}]`,
    `correctAnswer يجب أن يطابق تماماً أحد عناصر options.`,
  ].filter(Boolean).join('\n');

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text:          { type: 'STRING' },
                  options:       { type: 'ARRAY', items: { type: 'STRING' } },
                  correctAnswer: { type: 'STRING' },
                  points:        { type: 'INTEGER' },
                  type:          { type: 'STRING' },
                },
                required: ['text', 'options', 'correctAnswer', 'points', 'type'],
              },
            },
          },
          systemInstruction: {
            parts: [{ text: 'أجب بـ JSON مصفوفة نظيفة فقط بدون أي نص إضافي.' }],
          },
        }),
      }
    );

    // جلب نص الخطأ الحقيقي من Gemini إذا فشل الطلب
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-classic-questions] Gemini error:', geminiRes.status, errText);
      return res.status(500).json({
        success: false,
        error: `Gemini API رجع خطأ ${geminiRes.status}: ${errText.slice(0, 200)}`,
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ success: false, error: 'Gemini لم يُرجع محتوى. تحقق من إعدادات المشروع في Google AI Studio.' });
    }

    const clean = rawText.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    const validated = questions.map((q: any) => {
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const match = opts.find((o: string) => o.trim() === (q.correctAnswer || '').trim());
      return { ...q, correctAnswer: match || opts[0] || q.correctAnswer };
    });

    return res.status(200).json({ success: true, questions: validated });
  } catch (err: any) {
    console.error('[generate-classic-questions] catch:', err);
    return res.status(500).json({ success: false, error: `خطأ داخلي: ${err.message}` });
  }
}
