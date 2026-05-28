export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'مفتاح GEMINI_API_KEY غير موجود. أضفه في Vercel → Settings → Environment Variables.',
    });
  }

  const { level, subject, topic, instructions } = req.body || {};

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth =
    (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');

  let pedagogicalNote = '';
  if (isIslamic) {
    pedagogicalNote = 'استخدم "الفرائض" بدلاً من "الأركان" في التربية الإسلامية.';
  } else if (isArabicSixth) {
    pedagogicalNote = 'تجنب "التوكيد" و"المستثنى". ركّز على المفعول المطلق، المفعول لأجله، التمييز.';
  }

  const prompt = [
    `أنت مصمم مناهج خبير ومرح للمدارس الابتدائية بالمملكة المغربية.`,
    `قم بتوليد 3 أسئلة عالية الجودة ومناسبة للمستوى.`,
    `المستوى: ${level || 'المستوى الثالث'}`,
    `المادة: ${subject || 'الرياضيات'}`,
    `الموضوع: ${topic || 'عام'}`,
    `إرشادات الأستاذ: ${instructions || 'أسئلة مشوقة وبسيطة'}`,
    pedagogicalNote,
    `أسلوب مبهج مستلهم من البيئة المغربية (يوسف، أمينة، طاجين، أطلس...).`,
    ``,
    `أجب بـ JSON مصفوفة نظيفة فقط، كل عنصر بهذا الشكل:`,
    `{ "text": "...", "options": ["أ","ب","ج","د"], "correctIndex": 0, "points": 1000, "timeLimit": 20, "subComponent": "..." }`,
    `correctIndex هو رقم بين 0 و3 يمثل رقم الخيار الصحيح.`,
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
                  text:         { type: 'STRING' },
                  options:      { type: 'ARRAY', items: { type: 'STRING' } },
                  correctIndex: { type: 'INTEGER' },
                  points:       { type: 'INTEGER' },
                  timeLimit:    { type: 'INTEGER' },
                  subComponent: { type: 'STRING' },
                },
                required: ['text', 'options', 'correctIndex', 'points', 'timeLimit'],
              },
            },
          },
          systemInstruction: {
            parts: [{ text: 'أنت مولد أسئلة بيداغوجي مغربي. أجب بـ JSON نظيف فقط بدون أي نص إضافي.' }],
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-questions] Gemini API error:', errText);
      return res.status(500).json({
        success: false,
        error: `خطأ من Gemini API: ${geminiRes.status} — تحقق من GEMINI_API_KEY.`,
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(500).json({ success: false, error: 'Gemini لم يُرجع محتوى.' });
    }

    const clean = rawText.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    return res.status(200).json({ success: true, questions });
  } catch (err: any) {
    console.error('[generate-questions]', err);
    return res.status(500).json({ success: false, error: err.message || 'خطأ داخلي.' });
  }
}
