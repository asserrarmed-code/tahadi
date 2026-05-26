import { QuizSet } from './types';

export const MOROCCAN_AVATARS = [
  { char: '🦁', name: 'أسد الأطلس' },
  { char: '🐪', name: 'جمل الصحراء' },
  { char: '🥣', name: 'طاجين شهي' },
  { char: '🍵', name: 'أتاي منعنع' },
  { char: '🎒', name: 'محفظة مجدة' },
  { char: '✏️', name: 'قلم رصاص' },
  { char: '🦉', name: 'بومة ذكية' },
  { char: '🦊', name: 'ثعلب الفنك' },
  { char: '🦅', name: 'عقاب الأطلس' },
  { char: '🎨', name: 'فنان صغير' }
];

export const INITIAL_QUIZZES: QuizSet[] = [
  {
    id: 'quiz-math-primary3',
    title: 'تحدي الحساب الذهني والسريع',
    description: 'مسابقة ممتعة في العمليات والمسائل البسيطة لتلاميذ المستوى الثالث والرابع الابتدائي.',
    level: 'المستوى الثالث',
    subject: 'الرياضيات',
    questions: [
      {
        id: 'q-math-1',
        subject: 'الرياضيات',
        level: 'المستوى الثالث',
        subComponent: 'الحساب',
        text: 'ما هو حاصل ضرب 7 في 8؟ (7 × 8)',
        options: [
          '54',
          '56',
          '64',
          '48'
        ],
        correctIndex: 1, // 56
        points: 1000,
        timeLimit: 15
      },
      {
        id: 'q-math-2',
        subject: 'الرياضيات',
        level: 'المستوى الثالث',
        subComponent: 'القياس',
        text: 'تضم الساعة الواحدة 60 دقيقة. فكم دقيقة في نصف ساعة (1/2 ساعة)؟',
        options: [
          '20 دقيقة',
          '30 دقيقة',
          '45 دقيقة',
          '15 دقيقة'
        ],
        correctIndex: 1, // 30 دقيقة
        points: 1000,
        timeLimit: 15
      },
      {
        id: 'q-math-3',
        subject: 'الرياضيات',
        level: 'المستوى الرابع',
        subComponent: 'الهندسة',
        text: 'ما هو مضلع رباعي أضلاعه الأربعة متقايسة وزواياه الأربعة قائمة؟',
        options: [
          'المستطيل',
          'المعين',
          'المربع',
          'المثلث'
        ],
        correctIndex: 2, // المربع
        points: 1200,
        timeLimit: 20
      }
    ]
  },
  {
    id: 'quiz-islamic-primary4',
    title: 'كنوز السيرة والقرآن الكريم',
    description: 'مسابقات دينية في العقيدة والسيرة النبوية والمستوى الرابع الابتدائي بالمغرب.',
    level: 'المستوى الرابع',
    subject: 'التربية الإسلامية',
    questions: [
      {
        id: 'q-islamic-1',
        subject: 'التربية الإسلامية',
        level: 'المستوى الرابع',
        subComponent: 'التزكية (القرآن الكربم)',
        text: 'ما هي السورة الكريمة التي تبدأ بـ "والضحى والليل إذا سجى"؟',
        options: [
          'سورة الشرح',
          'سورة الضحى',
          'سورة التين',
          'سورة العلق'
        ],
        correctIndex: 1,
        points: 1000,
        timeLimit: 15
      },
      {
        id: 'q-islamic-2',
        subject: 'التربية الإسلامية',
        level: 'المستوى الرابع',
        subComponent: 'الاقتداء',
        text: 'أين ولد رسول الله محمد صلى الله عليه وسلم؟',
        options: [
          'المدينة المنورة',
          'القدس الشريف',
          'مكة المكرمة',
          'الطائف'
        ],
        correctIndex: 2,
        points: 1000,
        timeLimit: 12
      }
    ]
  },
  {
    id: 'quiz-arabic-primary5',
    title: 'قواعد لغتنا العربية الجميلة',
    description: 'ألعاب لغوية مسلية في تراكيب وصرف وتحويل المستوى الخامس والسادس.',
    level: 'المستوى الخامس',
    subject: 'لغة عربية',
    questions: [
      {
        id: 'q-arabic-1',
        subject: 'لغة عربية',
        level: 'المستوى الخامس',
        subComponent: 'التراكيب',
        text: 'ما هي حركة إعراب "الفاعل" دائماً في الجملة الفعلية؟',
        options: [
          'الجر (الكسرة)',
          'النصب (الفتحة)',
          'الرفع (الضمة)',
          'الجزم (السكون)'
        ],
        correctIndex: 2,
        points: 1000,
        timeLimit: 15
      },
      {
        id: 'q-arabic-2',
        subject: 'لغة عربية',
        level: 'المستوى الخامس',
        subComponent: 'الصرف والتحويل',
        text: 'أي من الأسماء التالية هو "اسم فاعل" من الفعل (كتب)؟',
        options: [
          'مكتوب',
          'كتابة',
          'مكتب',
          'كاتب'
        ],
        correctIndex: 3,
        points: 1000,
        timeLimit: 15
      }
    ]
  },
  {
    id: 'quiz-science-primary6',
    title: 'عالم العلوم والنشاط العلمي',
    description: 'اكتشف الغلاف الجوي وجسم الإنسان والكهرباء مع مسابقات النشاط العلمي للمستوى السادس الابتدائي.',
    level: 'المستوى السادس',
    subject: 'نشاط علمي',
    questions: [
      {
        id: 'q-sci-1',
        subject: 'نشاط علمي',
        level: 'المستوى السادس',
        subComponent: 'الفيزياء',
        text: 'أي غاز يمثل النسبة الأكبر في الهواء الذي نحيط به وينعش الغلاف الجوي؟',
        options: [
          'الأوكسجين',
          'ثنائي أوكسيد الكربون',
          'النيتروجين (الآزوت)',
          'الهيدروجين'
        ],
        correctIndex: 2,
        points: 1200,
        timeLimit: 20
      },
      {
        id: 'q-sci-2',
        subject: 'نشاط علمي',
        level: 'المستوى السادس',
        subComponent: 'علوم الحياة والأرض',
        text: 'ما هو العضو المسؤول عن ضخ الدم وتوزيع الأوكسجين في كامل جسم الإنسان الحبيب؟',
        options: [
          'الرئتين',
          'الدماغ',
          'المعدة',
          'القلب'
        ],
        correctIndex: 3,
        points: 1000,
        timeLimit: 15
      }
    ]
  }
];
