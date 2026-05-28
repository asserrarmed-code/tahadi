import { GoogleGenAI } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY غير موجود في متغيرات البيئة.');
  return new GoogleGenAI({ apiKey });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { questionText, subject } = req.body || {};

  try {
    const ai = getAiClient();

    const prompt =
      `أنت "فيلسوف الصف" الحكيم والمساعد للأطفال في المغرب.\n` +
      `قدم تلميحاً بيداغوجياً ذكياً، قصيراً جداً (لا يتجاوز 12 كلمة)، ومشجعاً.\n` +
      `السؤال: "${questionText}"\n` +
      `المادة: ${subject || 'عام'}\n` +
      `تجنب إعطاء الجواب الصريح. قدم دلالة لطيفة بأسلوب مغربي يثير الفضول.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'أنت فيلسوف بيداغوجي مبهج وسريع البديهة تعطي تلميحات غير مباشرة للأطفال المغاربة.',
      },
    });

    const hint = response.text?.trim() || 'فكر بذكاء وتركيز، الإجابة قريبة جداً!';
    return res.status(200).json({ success: true, hint });
  } catch (error: any) {
    console.error('[generate-hint] خطأ:', error);
    // Fallback سلس: لا نُرجع خطأ للمستخدم
    return res.status(200).json({
      success: true,
      hint: 'تلميح: استعن بأساسيات الدرس وعناصر المفهوم الرئيسية!',
    });
  }
}
