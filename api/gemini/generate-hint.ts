export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ success: true, hint: 'فكر بذكاء، الإجابة قريبة!' });
  }

  const { questionText, subject } = req.body || {};

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `قدم تلميحاً بيداغوجياً قصيراً (أقل من 12 كلمة) لمساعدة طفل على حل:\n"${questionText}"\nالمادة: ${subject || 'عام'}\nلا تعطِ الجواب مباشرة.`,
            }],
          }],
          systemInstruction: {
            parts: [{ text: 'أنت فيلسوف صف مغربي يعطي تلميحات لطيفة وقصيرة للأطفال.' }],
          },
        }),
      }
    );

    const data = await geminiRes.json();
    const hint = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || 'تلميح: استعن بأساسيات الدرس!';

    return res.status(200).json({ success: true, hint });
  } catch {
    return res.status(200).json({ success: true, hint: 'فكر بذكاء وتركيز، الإجابة قريبة جداً!' });
  }
}
