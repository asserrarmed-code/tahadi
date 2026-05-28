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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { subject, topic, level, count, type } = req.body || {};

  try {
    const ai = getAiClient();

    const finalCount = Math.min(Number(count) || 3, 10); // حد أقصى 10 أسئلة
    const finalType = type === 'written' ? 'written' : 'mcq';

    // ── ضوابط بيداغوجية ملزمة ──
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
        '**قاعدة ملزمة:** استخدم "الفرائض" بدلاً من "الأركان" في التربية الإسلامية.';
    } else if (isArabicSixth) {
      pedagogicalEnforcement =
        '**قاعدة ملزمة للمستوى السادس:** تجنب "التوكيد" و"المستثنى". ' +
        'ركّز على: المفعول المطلق، المفعول لأجله، التمييز.';
    }

    const prompt =
      `أنت مصمم مناهج خبير ومرح للمدارس الابتدائية بالمملكة المغربية.\n` +
      `قم بتوليد ${finalCount} أسئلة بيداغوجية عالية الجودة وممتعة.\n` +
      `المستوى: ${level || 'المستوى الثالث'}\n` +
      `المادة: ${subject || 'الرياضيات'}\n` +
      `الموضوع: ${topic || 'ثقافة عامة'}\n` +
      `نوع الأسئلة: ${finalType === 'written' ? 'أسئلة كتابية (إجابة نصية)' : 'أسئلة اختيار من متعدد QCM'}\n` +
      `${pedagogicalEnforcement}\n\n` +
      `أسلوب مغربي لطيف: استلهم الأسماء المغربية (يوسف، أمينة، فاطمة) والوجبات المغربية (طاجين، كسكس) لزيادة الاندماج.\n\n` +
      `تنبيه مهم: يجب أن يكون correctAnswer مطابقاً تماماً لأحد عناصر options.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',   // ✅ اسم النموذج الصحيح
      contents: prompt,
      config: {
        systemInstruction:
          'أنت مصمم مناهج خبير للمدارس الابتدائية المغربية. ' +
          'أجب بـ JSON مصفوفة نظيفة فقط، بدون أي نص إضافي أو غلاف Markdown.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'قائمة الأسئلة الكلاسيكية المولدة',
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'نص السؤال مناسب للأطفال، مراعياً القيود البيداغوجية.',
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'للـ MCQ: أربعة خيارات بالضبط. للكتابي: مصفوفة بعنصر واحد هو الجواب الصحيح.',
              },
              correctAnswer: {
                type: Type.STRING,
                description:
                  'الجواب الصحيح — يجب أن يكون مطابقاً تماماً لأحد عناصر options.',
              },
              points: {
                type: Type.INTEGER,
                description: 'النقاط (1000 أو 1200 أو 1500).',
              },
              type: {
                type: Type.STRING,
                description: 'نوع السؤال: "mcq" أو "written".',
              },
            },
            required: ['text', 'options', 'correctAnswer', 'points', 'type'],
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('النموذج لم يُنتج أي محتوى.');

    // تنظيف غلاف Markdown إن وجد
    const clean = text.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    // ── التحقق: correctAnswer يجب أن يوجد ضمن options ──
    const validated = questions.map((q: any) => {
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const hasMatch = opts.some(
        (o: string) => o.trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()
      );
      if (!hasMatch && opts.length > 0) {
        // إذا لم يتطابق: استخدم الخيار الأول كحل احتياطي
        console.warn(`[generate-classic-questions] correctAnswer لا يتطابق مع options للسؤال: "${q.text}". الانتقال للخيار الأول.`);
        return { ...q, correctAnswer: opts[0] };
      }
      return q;
    });

    return res.status(200).json({ success: true, questions: validated });
  } catch (error: any) {
    console.error('[generate-classic-questions] خطأ:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'فشل توليد الأسئلة. تحقق من GEMINI_API_KEY.',
    });
  }
}
