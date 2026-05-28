import { GoogleGenAI, Type } from '@google/genai';

// ─── تهيئة Gemini ─────────────────────────────────────────────────────────────
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'مفتاح GEMINI_API_KEY غير موجود في متغيرات البيئة. ' +
      'أضفه في لوحة Vercel → Settings → Environment Variables.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ─── Handler الرئيسي (Vercel Serverless Function) ─────────────────────────────
export default async function handler(req: any, res: any) {
  // السماح فقط بـ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { level, subject, topic, instructions } = req.body || {};

  try {
    const ai = getAiClient();

    // ── ضوابط بيداغوجية ملزمة للمنهاج المغربي ──
    const isIslamic =
      subject && (subject.includes('إسلامية') || subject.includes('اسلامية'));
    const isArabicSixth =
      subject &&
      (subject.includes('عربية') || subject.includes('عربي')) &&
      level &&
      level.includes('السادس');

    let pedagogicalEnforcement = '';
    if (isIslamic) {
      pedagogicalEnforcement =
        '**قاعدة بيداغوجية ملزمة:** في مادة التربية الإسلامية، ' +
        'استخدم "الفرائض" بدلاً من "الأركان" (مثال: فرائض الوضوء، فرائض الصلاة)، ' +
        'وتجنب خلط المفاهيم للأطفال الصغار.';
    } else if (isArabicSixth) {
      pedagogicalEnforcement =
        '**قاعدة بيداغوجية ملزمة للمستوى السادس:** امتنع تمامًا عن إدراج ' +
        'أسئلة حول "التوكيد" أو "المستثنى". ركّز على: المفعول المطلق، المفعول لأجله، ' +
        'التمييز، والتراكيب الأساسية.';
    }

    const prompt =
      `أنت مصمم مناهج خبير ومرح للمدارس الابتدائية بالمملكة المغربية.\n` +
      `قم بتوليد 3 أسئلة عالية الجودة ومناسبة للمستوى.\n` +
      `المستوى: ${level || 'المستوى الثالث'}\n` +
      `المادة: ${subject || 'الرياضيات'}\n` +
      `الموضوع: ${topic || 'عام'}\n` +
      `إرشادات الأستاذ: ${instructions || 'أسئلة مشوقة وبسيطة'}\n\n` +
      `${pedagogicalEnforcement}\n\n` +
      `أسلوب: مشجع ومبهج، مستلهماً البيئة المغربية (يوسف، أمينة، طاجين، أطلس…).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',   // ✅ اسم النموذج الصحيح
      contents: prompt,
      config: {
        systemInstruction:
          'أنت مولد أسئلة بيداغوجي لتطبيق "مسابقات القسم" المغربي. ' +
          'أجب دائماً بـ JSON نظيف مطابق للمخطط المرفق، بدون أي نص إضافي.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'قائمة الأسئلة المولدة',
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'نص السؤال مناسب للأطفال، مراعياً القواعد البيداغوجية.',
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'أربعة خيارات بالضبط.',
              },
              correctIndex: {
                type: Type.INTEGER,
                description: 'رقم الخيار الصحيح من 0 إلى 3.',
              },
              points: {
                type: Type.INTEGER,
                description: 'النقاط (1000 أو 1200).',
              },
              timeLimit: {
                type: Type.INTEGER,
                description: 'الوقت بالثواني (15 أو 20 أو 25).',
              },
              subComponent: {
                type: Type.STRING,
                description: 'المكون الفرعي للمادة (التراكيب، الصرف، الحساب…).',
              },
            },
            required: ['text', 'options', 'correctIndex', 'points', 'timeLimit'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('النموذج لم يُنتج أي محتوى.');

    // تنظيف أي غلاف Markdown قبل Parse
    const clean = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    return res.status(200).json({ success: true, questions });
  } catch (error: any) {
    console.error('[generate-questions] خطأ:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'فشل توليد الأسئلة. تحقق من GEMINI_API_KEY.',
    });
  }
}
