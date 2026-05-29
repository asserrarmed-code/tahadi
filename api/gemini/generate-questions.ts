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
      error: 'GEMINI_API_KEY غير موجود في Vercel Environment Variables.',
    });
  }

  const body = await parseBody(req);
  const { level, subject, topic, instructions } = body;

  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth = (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');
  let pedagogicalNote = '';
  if (isIslamic) pedagogicalNote = 'استخدم "الفرائض" بدلاً من "الأركان".';
  else if (isArabicSixth) pedagogicalNote = 'تجنب التوكيد والمستثنى. ركّز على المفعول المطلق، لأجله، التمييز.';

  const prompt = [
    `ولّد 3 أسئلة بيداغوجية للمستوى: ${level || 'الثالث'} - المادة: ${subject || 'الرياضيات'} - الموضوع: ${topic || 'عام'}.`,
    `إرشادات: ${instructions || 'مشوقة وبسيطة'}. ${pedagogicalNote}`,
    `أجب بـ JSON مصفوفة: [{"text":"...","options":["أ","ب","ج","د"],"correctIndex":0,"points":1000,"timeLimit":20,"subComponent":"..."}]`,
    `correctIndex هو رقم 0-3 للخيار الصحيح.`,
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
          systemInstruction: { parts: [{ text: 'أجب بـ JSON نظيف فقط.' }] },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ success: false, error: `Gemini ${geminiRes.status}: ${errText.slice(0, 200)}` });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return res.status(500).json({ success: false, error: 'Gemini لم يُرجع محتوى.' });

    const questions = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    return res.status(200).json({ success: true, questions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: `خطأ داخلي: ${err.message}` });
  }
}
