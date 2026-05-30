async function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

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
      error: 'GEMINI_API_KEY غير موجود في Vercel. أضفه في Settings → Environment Variables باسم: GEMINI_API_KEY',
    });
  }

  const body = await parseBody(req);
  const { subject, topic, level, count, type } = body;
  const finalCount = Math.min(Number(count) || 3, 10);
  const finalType = type === 'written' ? 'written' : 'mcq';

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth = (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');
  let note = '';
  if (isIslamic) note = 'استخدم مصطلح "الفرائض" وليس "الأركان".';
  else if (isArabicSixth) note = 'تجنب تماماً أسئلة التوكيد والمستثنى.';

  // ✅ بدون responseSchema — نطلب JSON مباشرة في النص
  const prompt = `أنت مصمم مناهج للمدارس الابتدائية المغربية.
ولّد بالضبط ${finalCount} أسئلة لـ:
- المستوى: ${level || 'الثالث'}
- المادة: ${subject || 'الرياضيات'}  
- الموضوع: ${topic || 'عام'}
- النوع: ${finalType === 'written' ? 'كتابي' : 'اختيار من متعدد (4 خيارات)'}
${note}

⚠️ أرجع JSON فقط — مصفوفة بدون أي نص قبلها أو بعدها ولا markdown:
[
  {
    "text": "نص السؤال هنا",
    "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
    "correctAnswer": "الخيار الأول",
    "points": 1000,
    "type": "${finalType}"
  }
]
تأكد: correctAnswer يطابق تماماً أحد عناصر options.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-classic-questions]', geminiRes.status, errText);
      return res.status(500).json({
        success: false,
        error: `Gemini API خطأ ${geminiRes.status}: ${errText.slice(0, 300)}`,
      });
    }

    const data = await geminiRes.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) {
      return res.status(500).json({ success: false, error: 'Gemini لم يُرجع نصاً. تحقق من المفتاح وحدود الاستخدام.' });
    }

    // استخراج JSON من النص حتى لو كان محاطاً بـ markdown
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: `Gemini أرجع نصاً غير JSON: ${rawText.slice(0, 200)}` });
    }

    const questions = JSON.parse(jsonMatch[0]);

    // تحقق: correctAnswer يجب أن يطابق أحد الخيارات
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
