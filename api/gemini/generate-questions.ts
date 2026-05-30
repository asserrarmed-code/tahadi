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
      error: 'GEMINI_API_KEY غير موجود في Vercel Environment Variables.',
    });
  }

  const body = req.body || {};
  const { level, subject, topic, instructions } = body;

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth = (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');
  let note = '';
  if (isIslamic) note = 'استخدم الفرائض وليس الاركان.';
  else if (isArabicSixth) note = 'تجنب اسئلة التوكيد والمستثنى.';

  const prompt = `ولد 3 اسئلة للمستوى ${level || 'الثالث'} مادة ${subject || 'الرياضيات'} موضوع ${topic || 'عام'}. ${instructions || ''}. ${note}
اجب بـ JSON مصفوفة فقط:
[{"text":"...","options":["أ","ب","ج","د"],"correctIndex":0,"points":1000,"timeLimit":20,"subComponent":"..."}]
correctIndex رقم 0 الى 3.`;

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
      return res.status(500).json({ success: false, error: `Gemini ${geminiRes.status}: ${errText.slice(0, 300)}` });
    }

    const data = await geminiRes.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: `Gemini ارجع نصا غير JSON: ${rawText.slice(0, 200)}` });
    }

    return res.status(200).json({ success: true, questions: JSON.parse(jsonMatch[0]) });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.name === 'AbortError' ? 'Gemini timeout. حاول مرة اخرى.' : `خطا: ${err.message}`,
    });
  }
}
