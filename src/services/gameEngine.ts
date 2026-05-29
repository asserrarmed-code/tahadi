import { ref, set, update } from 'firebase/database';
import { db } from '../firebase';

export interface Question {
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  type: string;
}

/**
 * 1. دالة توليد الأسئلة الحقيقية (generateQuestionsFromAI)
 * تعمل على الاتصال بـ Gemini API لتوليد باقة أسئلة تعليمية مطابقة للمنهاج المغربي
 * 
 * @param subject المادة (مثال: التربية الإسلامية، اللغة العربية، الرياضيات، النشاط العلمي)
 * @param topic المكون أو الموضوع (مثال: فرائض الصلاة، التراكيب، قياس المساحات)
 * @param level المستوى الدراسي (مثال: المستوى الثالث، المستوى السادس)
 * @param count عدد الأسئلة المطلوبة (مثال: 3، 5)
 * @param type نوع السؤال (QCM أو خطي)
 * @returns مصفوفة من الأسئلة الجاهزة
 */
export async function generateQuestionsFromAI(
  subject: string,
  topic: string,
  level: string,
  count: number,
  type: string = 'QCM'
): Promise<Question[]> {
  try {
    const response = await fetch('/api/gemini/generate-classic-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        topic,
        level,
        count,
        type: type === 'written' ? 'written' : 'mcq'
      }),
    });

    // قراءة body الخطأ الحقيقي بدل statusText الفارغ دائماً
    const data = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));
    if (!response.ok) {
      throw new Error(data.error || `خطأ في الخادم (${response.status})`);
    }
    if (data.success && Array.isArray(data.questions)) {
      return data.questions.map((q: any) => ({
        text: q.text || 'سؤال تفاعلي جديد',
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['الخيار أ', 'الخيار ب', 'الخيار ج', 'الخيار د'],
        correctAnswer: q.correctAnswer || '',
        points: Number(q.points) || 1000,
        type: q.type || type
      }));
    } else {
      throw new Error(data.error || 'الاستجابة المستلمة ليست تنسيقاً صالحاً.');
    }
  } catch (err: any) {
    console.error('⚠️ تعذر الاستدعاء من الخلفية:', err);
    throw new Error(err.message || 'فشل الاتصال بالذكاء الاصطناعي لتوليد الأسئلة. يرجى تكرار المحاولة أو التحقق من مفتاح API.');
  }
}

/**
 * 2. دالة حفظ الأسئلة في Firebase (savePoolToFirebase)
 * تقوم بحفظ مصفوفة الأسئلة المتولدة في قاعدة البيانات وتحديث حالة الغرفة إلى "setup"
 * 
 * @param roomPIN رمز الغرفة المكون من 4 أرقام
 * @param questions مصفوفة الأسئلة المطلوب حفظها
 */
export async function savePoolToFirebase(roomPIN: string, questions: Question[]): Promise<void> {
  if (!roomPIN) {
    throw new Error('لم يتم تحديد رمز الغرفة PIN.');
  }

  const roomRef = ref(db, `rooms/${roomPIN}`);
  
  // تحديث الخزينة وقاعدة البيانات المتزامنة للغرفة
  await update(roomRef, {
    pin: roomPIN,
    status: 'setup',
    currentQuestionIndex: -1,
    questionsPool: questions,
    currentQuestion: null,
    responses: null
  });
}

/**
 * مولد أسئلة محلي واحتياطي غني بالمواضيع لضمان استمرارية التطبيق
 */
export function generateLocalFallback(
  level: string,
  subject: string,
  topic: string,
  count: number,
  type: string
): Question[] {
  const finalQuestions: Question[] = [];

  const datasets: Record<string, { text: string; options: string[]; correctAnswer: string }[]> = {
    'اللغة العربية': [
      {
        text: "أي من الجمل التالية تشتمل على 'مفعول لأجله' منصوب يوضح علة وقوع الفعل؟",
        options: [
          "حفظ سليمان القرآن طاعةً لله ورغبةً في ثوابه.",
          "قرأ الأستاذ يوسف كتاب التذكرة قراءةً متأنية.",
          "سافر المغامر ابن بطوطة صباحاً عبر طنجة.",
          "العلم نور يضيء عقول الباحثين بجد ونشاط."
        ],
        correctAnswer: "حفظ سليمان القرآن طاعةً لله ورغبةً في ثوابه."
      },
      {
        text: "حدد الجملة التي تشتمل على 'فاعل' ظاهر مرفوع بالضمة الظاهرة على آخره:",
        options: [
          "كتبتْ التلميذةُ فاطمةُ ملخصاً حول طواحين الهواء.",
          "سافروا في رحلة استكشافية إلى شلالات أوزود.",
          "يحبون مراجعة دروسهم بجد واجتهاد في المنزل.",
          "أكرمنا المعلم يوسف بجوائز قيمة لجهودنا."
        ],
        correctAnswer: "كتبتْ التلميذةُ فاطمةُ ملخصاً حول طواحين الهواء."
      },
      {
        text: "ما هو الفعل اللازم من بين الأفعال المدرجة في الخيارات التالية؟",
        options: [
          "خرجَ أحمدُ إلى الساحة مسرعاً.",
          "أكلَ يوسفُ الطاجين المغربي اللذيذ.",
          "كتبتْ فاطمةُ الدرسَ بعناية فائقة.",
          "رسمَ الفنانُ لوحةً معبرة عن صومعة حسان."
        ],
        correctAnswer: "خرجَ أحمدُ إلى الساحة مسرعاً."
      }
    ],
    'التربية الإسلامية': [
      {
        text: "ما هو الحكم الفقهي الصحيح لغسل الوجه واليدين إلى المرفقين في الفقه الإسلامي المنهجي؟",
        options: [
          "فرائض من فرائض الطهارة (الوضوء)",
          "سنن مستحبة ومؤكدة فقط للوضوء",
          "مستحبات وفضائل مستحسنة في السواك",
          "مكروهات تبطل غسل أعضاء الوضوء كلياً"
        ],
        correctAnswer: "فرائض من فرائض الطهارة (الوضوء)"
      },
      {
        text: "أي من الخيارات التالية يعتبر من سنن الوضوء المؤكدة في الفقه المالكي؟",
        options: [
          "غسل اليدين الكوعين إلى المعصم أول الوضوء",
          "النية في التطهّر لرفع الحدث الأصغر",
          "فور وموالاة الأعضاء من غير تأجيل",
          "غسل الوجه كاملاً من منابت الشعر إلى الذقن"
        ],
        correctAnswer: "غسل اليدين الكوعين إلى المعصم أول الوضوء"
      },
      {
        text: "ما هي الصلوات الخمس المفروضة التي يؤديها المسلم في اليوم والليلة تفصيلاً؟",
        options: [
          "الصبح، الظهر، العصر، المغرب، العشاء",
          "الشروق، الضحى، العصر، المغرب، الوتر",
          "الفجر، الظهر، التراويح، العصر، العشاء",
          "الصبح، قيام الليل، العصر، الشفع، الوتر"
        ],
        correctAnswer: "الصبح، الظهر، العصر، المغرب، العشاء"
      }
    ],
    'الرياضيات': [
      {
        text: "اشترى التلميذ يوسف طاجيناً بسعر 45 درهماً، وحصل على تخفيض بقيمة 10%. كم درهماً وفر يوسف؟",
        options: [
          "4.5 دراهم توفير",
          "5 دراهم توفير كلي",
          "40.5 درهماً توفير",
          "10 دراهم كاملة من السعر"
        ],
        correctAnswer: "4.5 دراهم توفير"
      },
      {
        text: "كم عدد أضلاع الشكل الهندسي المعروف بـ 'شبه المنحرف'؟",
        options: [
          "4 أضلاع",
          "3 أضلاع",
          "5 أضلاع",
          "6 أضلاع"
        ],
        correctAnswer: "4 أضلاع"
      },
      {
        text: "إذا كانت مساحة بستان دائري الشكل تحسب بـ (شعاع × شعاع × 3.14)، فما قيمة الثابت الهندسي Pi (π) التقريبية؟",
        options: [
          "3.14",
          "2.5",
          "4.15",
          "1.0"
        ],
        correctAnswer: "3.14"
      }
    ],
    'النشاط العلمي': [
      {
        text: "ما هما الغازان الأساسيان المكونان بنسبة عظمى للهواء الجوي المحيط بكوكب الأرض؟",
        options: [
          "الأكسجين والآزوت (النيتروجين)",
          "الأكسجين وثاني أوكسيد الكربون الجوي",
          "النيتروجين وغاز الأرجون الدقيق والنبيل",
          "الهيدروجين وبخار الماء الجوي المحسوس"
        ],
        correctAnswer: "الأكسجين والآزوت (النيتروجين)"
      },
      {
        text: "أي من الحيوانات التالية يصنف بكونه حيواناً بيوضاً (يتكاثر بوضع البيض)؟",
        options: [
          "اللقلق الأبيض الجميل",
          "الأرنب البري السريع",
          "الدلفين البحري الذكي",
          "الفأر المنزلي الصغير"
        ],
        correctAnswer: "اللقلق الأبيض الجميل"
      },
      {
        text: "ما هو الكوكب الأقرب للشمس في مجموعتنا الشمسية الفلكية؟",
        options: [
          "كوكب عطارد",
          "كوكب الزهرة",
          "كوكب المريخ الأحمر",
          "كوكب الأرض الجميل"
        ],
        correctAnswer: "كوكب عطارد"
      }
    ]
  };

  const subjectData = datasets[subject] || datasets['اللغة العربية'];

  for (let i = 0; i < count; i++) {
    const template = subjectData[i % subjectData.length];
    finalQuestions.push({
      text: i === 0 ? template.text : `سؤال تعزيزي رقم ${i + 1} عن موضوع (${topic || 'مفاهيم عامة'}): ${template.text}`,
      options: [...template.options],
      correctAnswer: template.correctAnswer,
      points: 1000 + (i * 100),
      type: type
    });
  }

  return finalQuestions;
}
