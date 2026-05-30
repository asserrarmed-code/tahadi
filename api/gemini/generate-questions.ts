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
  let note = '';
  if (isIslamic) note = 'استخدم "الفرائض" وليس "الأركان".';
  else if (isArabicSixth) note = 'تجنب أسئلة التوكيد والمستثنى.';

  const prompt = `أنت مصمم مناهج للمدارس الابتدائية المغربية.
ولّد بالضبط 3 أسئلة لـ:
- المستوى: ${level || 'الثالث'}
- المادة: ${subject || 'الرياضيات'}
- الموضوع: ${topic || 'عام'}
- إرشادات: ${instructions || 'مشوقة وبسيطة'}
${note}

⚠️ أرجع JSON فقط — مصفوفة بدون markdown:
[
  {
    "text": "نص السؤال",
    "options": ["أ", "ب", "ج", "د"],
    "correctIndex": 0,
    "points": 1000,
    "timeLimit": 20,
    "subComponent": "المكون الفرعي"
  }
]
correctIndex هو رقم الخيار الصحيح (0 إلى 3).`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ success: false, error: `Gemini ${geminiRes.status}: ${errText.slice(0, 300)}` });
    }

    const data = await geminiRes.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, error: `Gemini أرجع نصاً غير JSON: ${rawText.slice(0, 200)}` });
    }

    const questions = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ success: true, questions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: `خطأ داخلي: ${err.message}` });
  }
}
