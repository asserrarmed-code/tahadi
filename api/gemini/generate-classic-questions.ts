// Vercel Serverless Function — لا تستخدم @google/genai SDK لتجنب تعارض ESM/CJS
// بدلاً من ذلك نستدعي Gemini REST API مباشرة عبر fetch

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

  const { subject, topic, level, count, type } = req.body || {};
  const finalCount = Math.min(Number(count) || 3, 10);
  const finalType = type === 'written' ? 'written' : 'mcq';

  // ── ضوابط بيداغوجية ──
  const isIslamic = subject?.includes('إسلامية') || subject?.includes('اسلامية');
  const isArabicSixth =
    (subject?.includes('عربية') || subject?.includes('عربي')) && level?.includes('السادس');

  let pedagogicalNote = '';
  if (isIslamic) {
    pedagogicalNote = 'استخدم مصطلح "الفرائض" بدلاً من "الأركان" دائماً في التربية الإسلامية.';
  } else if (isArabicSixth) {
    pedagogicalNote = 'تجنب تمامًا أسئلة "التوكيد" و"المستثنى". ركّز على: المفعول المطلق، المفعول لأجله، التمييز.';
  }

  const prompt = [
    `أنت مصمم مناهج خبير ومرح للمدارس الابتدائية بالمملكة المغربية.`,
    `قم بتوليد ${finalCount} أسئلة بيداغوجية عالية الجودة وممتعة.`,
    `المستوى: ${level || 'المستوى الثالث'}`,
    `المادة: ${subject || 'الرياضيات'}`,
    `الموضوع: ${topic || 'ثقافة عامة'}`,
    `نوع الأسئلة: ${finalType === 'written' ? 'كتابية (إجابة نصية قصيرة)' : 'اختيار من متعدد QCM - 4 خيارات'}`,
    pedagogicalNote,
    `أسلوب مغربي لطيف: استلهم الأسماء المغربية (يوسف، أمينة، فاطمة) والوجبات المغربية (طاجين، كسكس).`,
    ``,
    `⚠️ مهم جداً: يجب أن يكون correctAnswer مطابقاً تماماً لأحد عناصر options.`,
    ``,
    `أجب بـ JSON مصفوفة نظيفة فقط، كل عنصر بهذا الشكل:`,
    `{ "text": "...", "options": ["أ", "ب", "ج", "د"], "correctAnswer": "أ", "points": 1000, "type": "mcq" }`,
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
            parts: [{
              text: 'أنت مصمم مناهج خبير للمدارس الابتدائية المغربية. أجب بـ JSON مصفوفة نظيفة فقط، بدون أي نص إضافي.',
            }],
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-classic-questions] Gemini API error:', errText);
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

    // ── تحقق: correctAnswer يجب أن يوجد ضمن options ──
    const validated = questions.map((q: any) => {
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const match = opts.find(
        (o: string) => o.trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()
      );
      return { ...q, correctAnswer: match || opts[0] || q.correctAnswer };
    });

    return res.status(200).json({ success: true, questions: validated });
  } catch (err: any) {
    console.error('[generate-classic-questions]', err);
    return res.status(500).json({ success: false, error: err.message || 'خطأ داخلي.' });
  }
}
