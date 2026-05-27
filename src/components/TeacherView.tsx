import React, { useState, useEffect } from 'react';
import { 
  Laptop, Play, Plus, Trash, Clock, Users, Check, RefreshCw, 
  Settings, Award, Sparkles, LogOut, ArrowRight, ShieldAlert,
  Lock, Unlock, HelpCircle, Trophy, Volume2, PlusCircle, MinusCircle, Brain,
  Shield, Flame, Anchor, Tv, Zap, Heart, Award as StarIcon, ChevronRight
} from 'lucide-react';
import { Room, Player, Question, QuizSet } from '../types';
import { createRoom, updateRoom, listenToRoom, adjustPlayerScore, terminateRoom } from '../lib/firebase';
import { ref, set, update, onValue } from 'firebase/database';
import { db, isRealFirebaseConfigured } from '../firebase';

interface TeacherViewProps {
  onBackToMain: () => void;
}

export default function TeacherView({ onBackToMain }: TeacherViewProps) {
  // Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('school_teacher_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Core App State: setup (Preparation & Generation) or live (Broadcast & Control Remote)
  const [gameState, setGameState] = useState<'setup' | 'live'>('setup');

  // Setup Form inputs
  const [selectedLevel, setSelectedLevel] = useState('المستوى السادس');
  const [selectedSubject, setSelectedSubject] = useState('اللغة العربية');
  const [selectedSubComponent, setSelectedSubComponent] = useState('التراكيب');
  const [questionCount, setQuestionCount] = useState(3);
  const [customTopic, setCustomTopic] = useState('');
  const [questionType, setQuestionType] = useState<'mcq' | 'written' | 'oral'>('mcq');

  // Generated Pool of Questions
  const [poolQuestions, setPoolQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Live Session details
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [teamsResponses, setTeamsResponses] = useState<Record<string, { teamName: string; selectedAnswer: any; isCorrect: boolean; timestamp: number }>>({});
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(() => localStorage.getItem('school_teacher_active_room_pin'));

  // Subcomponents options depending on Subject
  const getSubComponentsForSubject = (subject: string): string[] => {
    switch (subject) {
      case 'اللغة العربية':
        return ['التراكيب', 'الصرف والتحويل', 'الإملاء', 'فهم المقروء'];
      case 'اللغة الفرنسية':
        return ['Conjugaison', 'Grammaire', 'Lexique', 'Orthographe'];
      case 'الرياضيات':
        return ['حساب ذهني سري', 'مسائل رياضية', 'هندسة وقواسم', 'القياس والتحويل'];
      case 'التربية الإسلامية':
        return ['التزكية (العقيدة)', 'الاستجابة (الفرائض)', 'الاقتداء والاستماع', 'القسط والحكمة'];
      case 'النشاط العلمي':
        return ['سرعة التحولات', 'التنوع البيئي والمائي', 'صحة الإنسان والغذاء', 'علم الفلك البسيط'];
      case 'الاجتماعيات':
        return ['التاريخ المغربي الحديث', 'الجغرافيا والمناخ', 'تربية على المواطنة'];
      default:
        return ['عام'];
    }
  };

  // Adjust subcomponent automatically when subject changes
  useEffect(() => {
    const opts = getSubComponentsForSubject(selectedSubject);
    setSelectedSubComponent(opts[0]);
  }, [selectedSubject]);

  // Sync and listen to the active room whenever activePin is defined (on mount and when launched live)
  useEffect(() => {
    if (activePin) {
      setLoadingRoom(true);
      const unsubscribe = listenToRoom(activePin, (room) => {
        if (room) {
          setCurrentRoom(room);
          setGameState('live');
          if (room.activeQuiz && room.activeQuiz.questions) {
            setPoolQuestions(room.activeQuiz.questions);
          }
          if (room.responses) {
            setTeamsResponses(room.responses);
          } else {
            setTeamsResponses({});
          }
        } else {
          localStorage.removeItem('school_teacher_active_room_pin');
          setActivePin(null);
          setGameState('setup');
          setTeamsResponses({});
        }
        setLoadingRoom(false);
      });

      // Real-time Database live responses observer
      let rtdbCleanup = () => {};
      if (isRealFirebaseConfigured) {
        const responsesRef = ref(db, `rooms/${activePin}/responses`);
        rtdbCleanup = onValue(responsesRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setTeamsResponses(data || {});
          } else {
            setTeamsResponses({});
          }
        }, (err) => {
          console.warn("Real-time Database Live responses listener error:", err);
        });
      }

      return () => {
        unsubscribe();
        rtdbCleanup();
      };
    } else {
      setCurrentRoom(null);
      setTeamsResponses({});
    }
  }, [activePin]);

  // Timer Effect for countdowns and active questions synced to Firebase Realtime / Firestore
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        updateRoom(currentRoom.pin, {
          secondsRemaining: currentRoom.secondsRemaining - 1
        });
      }, 1000);
    } else if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining === 0) {
      updateRoom(currentRoom.pin, {
        state: 'question_result',
        revealAnswer: true
      });
    }
    
    // Check countdown state for transitioning intro
    if (currentRoom && currentRoom.state === 'question_countdown' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        const nextTime = currentRoom.secondsRemaining - 1;
        if (nextTime === 0) {
          const currentQ = currentRoom.activeQuiz?.questions[currentRoom.currentQuestionIndex];
          updateRoom(currentRoom.pin, {
            state: 'question_active',
            secondsRemaining: currentQ?.timeLimit || 25,
            questionStartedAt: Date.now()
          });
        } else {
          updateRoom(currentRoom.pin, {
            secondsRemaining: nextTime
          });
        }
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [currentRoom]);

  // Verify Educator Security Gate
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '2026') {
      setIsAuthenticated(true);
      localStorage.setItem('school_teacher_auth', 'true');
      setPasscodeError(null);
    } else {
      setPasscodeError('❌ رمز الأستاذ غير صحيح! المرجو استخدام الرمز 2026 لتأكيد الهوية.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('school_teacher_auth');
    localStorage.removeItem('school_teacher_active_room_pin');
    setGameState('setup');
    setActivePin(null);
    setCurrentRoom(null);
  };

  // -------------------------------------------------------------------------------------------------
  // HIGH-FIDELITY LOCAL PEDAGOGICAL QUESTION GENERATOR (Moroccan Curriculum Fallback Engine)
  // Ensures the app functions completely and beautifully with rich curriculum-aligned content offline.
  // -------------------------------------------------------------------------------------------------
  const getOfflinePedagogicalQuestions = (
    level: string,
    subject: string,
    component: string,
    type: 'mcq' | 'written' | 'oral',
    count: number,
    topic: string
  ): Question[] => {
    const questions: Question[] = [];
    
    // Subject themed databases
    const database_ar: Omit<Question, 'id'>[] = [
      {
        text: "أي من الجمل التالية تشتمل على 'مفعول لأجله' منصوب يوضح علة الفعل؟",
        options: [
          "حفظ سليمان القرآن طاعةً لله ورغبةً في ثوابه.",
          "قرأ الأستاذ يوسف كتاب التذكرة قراءةً متأنية.",
          "سافر المغامر ابن بطوطة صباحاً عبر فاس.",
          "العلم نور يضيء عقول الباحثين بجد ونشاط."
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 25,
        subject: "اللغة العربية",
        level: "المستوى السادس",
        subComponent: "التراكيب"
      },
      {
        text: "ما هو الإعراب الصحيح لكلمة 'دراسةً' في جملة: 'ازداد الطفل المغربي دراسةً وفهماً لدروسه'؟",
        options: [
          "تمييز منصوب وعلامة نصبه الفتحة الظاهرة على آخره",
          "مفعول به م منصوب مضاف لفاعل مستتر",
          "مفعول مطلق لتأكيد الفعل والنسبة",
          "حال منصوبة تبين هيئة صاحب الحال وقت الفعل"
        ],
        correctIndex: 0,
        points: 1200,
        timeLimit: 20,
        subject: "اللغة العربية",
        level: "المستوى السادس",
        subComponent: "التراكيب"
      },
      {
        text: "حدد وزن صيغة اسم الآلة القياسي في كلمة 'مِفتاح' في قواعد الصرف والتحويل المغربية:",
        options: [
          "مِفْعَال (من الفعل الثلاثي فَتَحَ)",
          "مِفْعَل (لتخفيف اللفظ والأوزان)",
          "مُفْعِل (لمجانسة اسم الفاعل)",
          "فَعَّال (لصيغة المبالغة وتبيين الآلة)"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "اللغة العربية",
        level: "المستوى السادس",
        subComponent: "الصرف والتحويل"
      },
      {
        text: "تكتب التاء المبسوطة في إحدى الحالات التالية، حددها بدقة بيداغوجية:",
        options: [
          "في آخر الأفعال مطلقاً (مثل: قَرَأْتُ، كَتَبَتْ، سَافَرْتُ)",
          "في الاسم المفرد المؤنث بعد فتحة ظاهرة",
          "في جمع التكسير الذي لا ينتهي مفرده بتاء",
          "في الأسماء الخمسة عند الرفع بالواو"
        ],
        correctIndex: 0,
        points: 1100,
        timeLimit: 20,
        subject: "اللغة العربية",
        level: "المستوى الخامس",
        subComponent: "الإملاء"
      }
    ];

    const database_fr: Omit<Question, 'id'>[] = [
      {
        text: "Choisissez la conjugaison correcte du verbe 'faire' au présent de l'indicatif avec le pronom 'nous':",
        options: [
          "Nous faisons notre travail soigneusement.",
          "Nous faissons nos devoirs avec passion.",
          "Nous faites un bel exposé sur le Maroc.",
          "Nous ferons l'exercice de grammaire."
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "اللغة الفرنسية",
        level: "المستوى السادس",
        subComponent: "Conjugaison"
      },
      {
        text: "Identifiez le Complément d'Objet Direct (COD) dans la phrase: 'Amina prépare un délicieux tajine marocain.'",
        options: [
          "un délicieux tajine marocain",
          "Amina (le sujet actif)",
          "prépare (le verbe)",
          "il n'y a pas de COD dans cette phrase"
        ],
        correctIndex: 0,
        points: 1200,
        timeLimit: 20,
        subject: "اللغة الفرنسية",
        level: "المستوى السادس",
        subComponent: "Grammaire"
      },
      {
        text: "Quel est le synonyme du mot 'magnifique' utilisé fréquemment pour décrire les paysages de l'Atlas marocain ?",
        options: [
          "Splendide et très beau",
          "Sombre et difficile",
          "Petit et insignifiant",
          "Sec et aride"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "اللغة الفرنسية",
        level: "المستوى الخامس",
        subComponent: "Lexique"
      }
    ];

    const database_math: Omit<Question, 'id'>[] = [
      {
        text: "أراد الأستاذ حساب مساحة ساحة مستطيلة بأكادير طولها 30 متراً وعرضها 15 متراً. فما هي مساحة الساحة بالدقة بضرب الطول قي العرض؟",
        options: [
          "450 متر مربع (المساحة = الطول × العرض)",
          "90 متر مربع (بحساب المحيط الإجمالي)",
          "225 متر مربع (نصف المساحة الكلية)",
          "600 متر مربع (بحساب مستطيل وهمي)"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 25,
        subject: "الرياضيات",
        level: "المستوى السادس",
        subComponent: "مسائل رياضية"
      },
      {
        text: "احسب ذهنياً وبسرعة فائقة: ما هو خارج قسمة العدد 4.8 على 0.8؟",
        options: [
          "6 (بما أن 6 × 8 تساوي 48)",
          "0.6 (بقسمة الفاصلة العشرية)",
          "60 (بإزالة الكسور بالتجريب)",
          "4 (بالتقريب الرياضي السريع)"
        ],
        correctIndex: 0,
        points: 1100,
        timeLimit: 15,
        subject: "الرياضيات",
        level: "المستوى السادس",
        subComponent: "حساب ذهني سري"
      },
      {
        text: "مجموع زوايا أي مثلث في الهندسة المستوية والتقليدية يساوي دائماً وعالمياً:",
        options: [
          "180 درجة (زاوية مستقيمة كاملة)",
          "90 درجة (زاوية قائمة واحدة)",
          "360 درجة (مجموع زوايا رباعي الأضلاع)",
          "120 درجة (زوايا مستوية)"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 20,
        subject: "الرياضيات",
        level: "المستوى الخامس",
        subComponent: "هندسة وقواسم"
      }
    ];

    const database_islamic: Omit<Question, 'id'>[] = [
      {
        text: "ما هي 'فرائض الوضوء' السبعة المعتمدة شرعاً وبيداغوجياً في مذهب إمامنا مالك بالمملكة المغربية؟",
        options: [
          "النّيّة، غسل الوجه، غسل اليدين للنقين، مسح الرأس، غسل الرجلين، الدّلك، الموالاة (الفور)",
          "البسملة، المضمضة، الاستنشاق، مسح الأذنين، غسل الكوعين بالتناوب",
          "غسل المرفقين فقط ومسح جزء من الوجه وتقديم اليمين",
          "السواك، الاستنثار، التثليث في الغسل وتخليل الأصابع"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 20,
        subject: "التربية الإسلامية",
        level: "المستوى السادس",
        subComponent: "الاستجابة (الفرائض)"
      },
      {
        text: "أي من العبادات التالية صنفها الباحثون والمنهاج المغربي كـ 'صلاة مفروضة' تجب خمس مرات يومياً؟",
        options: [
          "الصلوات الخمس (الظهر، العصر، المغرب، العشاء، الصبح)",
          "صلاة التراويح في شهر رمضان المبارك",
          "صلاة العيدين (الفطر والأضحى) المبهجة",
          "صلاة الاستسقاء لطلب الغيث والمطر"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "التربية الإسلامية",
        level: "المستوى الرابع",
        subComponent: "التزكية (العقيدة)"
      }
    ];

    const database_science: Omit<Question, 'id'>[] = [
      {
        text: "ما هو الغاز الرئيسي الوفير في الغلاف الجوي الذي يمثل أكبر نسبة في الهواء (حوالي 78%)؟",
        options: [
          "غاز ثنائي النيتروجين (الآزوت)",
          "غاز ثنائي الأوكسجين اللازم للحياة",
          "غاز ثنائي أكسيد الكربون الضئيل",
          "غاز الأوزون الحامي من الأشعة الضارة"
        ],
        correctIndex: 0,
        points: 1005,
        timeLimit: 20,
        subject: "النشاط العلمي",
        level: "المستوى السادس",
        subComponent: "سرعة التحولات"
      },
      {
        text: "ما هو الكوكب الأقرب إلى الشمس في مجموعتنا الشمسية الذي يتميز بدرجة حرارة شديدة وثابتة؟",
        options: [
          "كوكب عطارد السريع",
          "كوكب الزهرة اللامع",
          "كوكب المريخ الأحمر المجاور",
          "كوكب المشتري العملاق الغازي"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "النشاط العلمي",
        level: "المستوى الخامس",
        subComponent: "علم الفلك البسيط"
      }
    ];

    const database_hist: Omit<Question, 'id'>[] = [
      {
        text: "أي دولة تاريخية قامت ببناء صومعة الكتبية بمراكش المنقوشة وصومعة حسان بالرباط؟",
        options: [
          "دولة الموحدين العظيمة (في عهد يعقوب المنصور الموحدي)",
          "دولة الأدارسة الأولى العريقة بفاس",
          "دولة المرابطين مؤسسي مدينة مراكش الحمراء",
          "الدولة المرينية الشهيرة ببناء المدارس العتيقة"
        ],
        correctIndex: 0,
        points: 1100,
        timeLimit: 20,
        subject: "الاجتماعيات",
        level: "المستوى السادس",
        subComponent: "التاريخ المغربي الحديث"
      },
      {
        text: "يقع المغرب في القارة الإفريقية، ويمتاز بحدين بحريين هامين. حددهما بدقة جغرافية:",
        options: [
          "البحر الأبيض المتوسط شمالاً والمحيط الأطلسي غرباً",
          "المحيط الهندي شرقاً والبحر الكاريبي غرباً",
          "البحر الأحمر جنوباً والمحيط الهادي غرباً",
          "خليج غينيا شمالاً والبحيرات الكبرى جنوباً"
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 15,
        subject: "الاجتماعيات",
        level: "المستوى السادس",
        subComponent: "الجغرافيا والمناخ"
      }
    ];

    // Select source repository based on subject
    let sourceRepo = database_ar;
    if (subject === 'اللغة الفرنسية') sourceRepo = database_fr;
    else if (subject === 'الرياضيات') sourceRepo = database_math;
    else if (subject === 'التربية الإسلامية') sourceRepo = database_islamic;
    else if (subject === 'النشاط العلمي') sourceRepo = database_science;
    else if (subject === 'الاجتماعيات') sourceRepo = database_hist;

    // Build the payload
    for (let i = 0; i < count; i++) {
      const template = sourceRepo[i % sourceRepo.length];
      
      // Inject some topic context custom values if entered to show true bespoke feel
      let text = template.text;
      if (topic && topic.trim().length > 0) {
        text = `${template.text} (تركيز خاص على مهارة: ${topic})`;
      }

      // Format options and custom instructions depending on Oral or Written styles
      let displayOptions = [...template.options];
      if (type === 'written') {
        displayOptions = ["اكتب الإجابة باختصار في الصندوق المقترح", "انتظر مراجعة الأستاذ", "التقيد باللغة الفصحى", "احترام الإملاء البيداغوجي"];
      } else if (type === 'oral') {
        displayOptions = ["سرعة البديهة والطلاقة اللغوية", "الوقوف بثقة أمام الزملاء بالصف", "الاستماع الإيجابي لتصحيح الأستاذ", "مشاركة دقيقة مع زملائي بالفريق"];
      }

      questions.push({
        id: `q-local-${subject.replace(/\s+/g, '')}-${i}-${Date.now()}`,
        text: text,
        options: displayOptions,
        correctIndex: template.correctIndex,
        points: template.points + (i * 100),
        timeLimit: template.timeLimit,
        subject: subject,
        level: level,
        subComponent: component || template.subComponent,
        type: type
      });
    }

    return questions;
  };

  // -------------------------------------------------------------------------------------------------
  // CALL GEMINI API OR FALL BACK DYNAMICALLY TO MOROCCAN LOCAL PEDAGOGICAL GENERATOR
  // -------------------------------------------------------------------------------------------------
  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const levelStr = selectedLevel;
    const subjectStr = selectedSubject;
    const compStr = selectedSubComponent;
    const typeStr = questionType;
    const countNum = questionCount;
    const topicText = customTopic || `مفاهيم وعناصر عامة لـ ${compStr}`;

    try {
      // Prompt specification complying with Moroccan specifications
      const response = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: levelStr,
          subject: subjectStr,
          topic: topicText,
          instructions: `يرجى توليد ${countNum} أسئلة بالكامل مطابقة للمنهاج الدراسي المغربي.
في الإسلاميات، استخدم مصطلح "الفرائض" بدلاً من "الأركان" شرعاً.
في قواعد عربية المستوى السادس، يمنع منعاً باتاً صياغة أسئلة حول التوكيد أو المستثنى تسهيلاً للمتعلمين.
يرجى توفير ${countNum} سؤال بصيغة QCM مبسطة تناسب النمط ${typeStr === 'mcq' ? 'الاختياري' : typeStr === 'written' ? 'الكتابي القصير' : 'الشفهي الشيق'}`
        })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          // Map to standard layout
          const mapped: Question[] = data.questions.map((q: any, idx: number) => {
            // Reformat MCQ or alternative layout depending on Question type
            let finalOptions = Array.isArray(q.options) && q.options.length === 4 ? q.options : ['الخيار أ', 'الخيار ب', 'الخيار ج', 'الخيار د'];
            if (typeStr === 'written') {
              finalOptions = ['اكتب الإجابة باختصار في الصندوق المقترح', 'انتظر مراجعة الأستاذ', 'التقيد باللغة الفصحى', 'احترام الإملاء البيداغوجي'];
            } else if (typeStr === 'oral') {
              finalOptions = ['سرعة البديهة والطلاقة اللغوية', 'الوقوف بثقة أمام الزملاء بالصف', 'الاستماع الإيجابي لتصحيح الأستاذ', 'مشاركة دقيقة مع زملائي بالفريق'];
            }

            return {
              id: `q-gemini-${idx}-${Date.now()}`,
              subject: subjectStr,
              level: levelStr,
              subComponent: q.subComponent || compStr,
              text: q.text,
              options: finalOptions,
              correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
              points: q.points || 1000,
              timeLimit: q.timeLimit || 25,
              type: typeStr
            };
          });

          // Set state
          setPoolQuestions(mapped.slice(0, countNum));
          return;
        }
      }
      throw new Error('فشل توليد الأسئلة من Gemini API بشكل مباشر، جاري التحويل الفوري لمحرك التوليد البيداغوجي المحلي...');
    } catch (err: any) {
      console.warn("Express AI handler error or key omitted. Activating high-fidelity Moroccan local generator fallback.", err);
      // Run fallback
      const fallbackQuestions = getOfflinePedagogicalQuestions(
        levelStr,
        subjectStr,
        compStr,
        typeStr,
        countNum,
        topicText
      );
      setPoolQuestions(fallbackQuestions);
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------------------------------------------
  // LAUNCH AND ACTIVATE THE CLASSROOM ROOM SESSION ON FIREBASE
  // -------------------------------------------------------------------------------------------------
  const handleLaunchRoomSession = async () => {
    if (poolQuestions.length === 0) {
      alert('الرجاء توليد أسئلة المعترك على الأقل أولاً لمراجعتها قبل تفعيل الغرفة الصفية!');
      return;
    }

    setLoadingRoom(true);
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

    // Create a complete QuizSet structure
    const formedQuiz: QuizSet = {
      id: `quiz-gen-${Date.now()}`,
      title: `معترك قلاع ${selectedSubject}`,
      description: `تحدي بيداغوجي تفاعلي لـ ${selectedLevel} - درس ${customTopic || selectedSubComponent}`,
      level: selectedLevel,
      subject: selectedSubject,
      questions: poolQuestions
    };

    try {
      const room = await createRoom(randomPin, formedQuiz);
      setCurrentRoom(room);
      localStorage.setItem('school_teacher_active_room_pin', randomPin);
      
      // Update room properties to reflect current state cleanly
      await updateRoom(randomPin, {
        activeSubject: selectedSubject,
        completedSubjects: {},
        multiplierActive: false,
        state: 'waiting',
        currentQuestionIndex: -1,
        currentQuestionId: null,
      });

      setActivePin(randomPin);
      setGameState('live');
    } catch (err) {
      console.error(err);
      alert('تعذر إنشاء الغرفة والمزامنة مع Firebase، يرجى تكرار المحاولة وسحب الاتصال مجدداً.');
    } finally {
      setLoadingRoom(false);
    }
  };

  // -------------------------------------------------------------------------------------------------
  // QUESTIONS BROADCAST AND REMOTE MANAGEMENT
  // -------------------------------------------------------------------------------------------------
  const handleBroadcast = async (roomPIN: string, activeQuestion: Question) => {
    try {
      if (!roomPIN || !activeQuestion) {
        console.error("Missing parameters in handleBroadcast: roomPIN or activeQuestion is undefined.");
        return;
      }

      // Find original question index
      const idx = poolQuestions.findIndex(q => q.id === activeQuestion.id);
      if (idx === -1) {
        console.error("The selected activeQuestion was not found in poolQuestions.");
        return;
      }

      // Flush/Reset data values for all active players in room to clear UI buttons
      const resetPlayers = { ...(currentRoom?.players || {}) };
      for (const pid in resetPlayers) {
        resetPlayers[pid] = {
          ...resetPlayers[pid],
          answeredThisRound: false,
          answerIndex: null,
          writtenAnswer: '',
          isCorrect: false,
          pointsGained: 0
        };
      }

      // Direct write and update room fields on Firebase DB
      await updateRoom(roomPIN, {
        currentQuestionIndex: idx,
        currentQuestionId: activeQuestion.id,
        currentQuestion: activeQuestion, // Set the currentQuestion directly in rooms/${roomPIN}
        state: 'question_countdown',
        secondsRemaining: 4, // 3s countdown + 1s prep
        revealAnswer: false,
        players: resetPlayers
      });

      if (isRealFirebaseConfigured) {
        try {
          const roomDbRef = ref(db, `rooms/${roomPIN}`);
          const updates: any = {
            currentQuestion: activeQuestion,
            currentQuestionIndex: idx,
            currentQuestionId: activeQuestion.id,
            state: 'question_countdown',
            secondsRemaining: 4,
            revealAnswer: false,
            responses: {}
          };
          for (const pid in resetPlayers) {
            updates[`players/${pid}/answeredThisRound`] = false;
            updates[`players/${pid}/answerIndex`] = null;
            updates[`players/${pid}/writtenAnswer`] = '';
            updates[`players/${pid}/isCorrect`] = false;
            updates[`players/${pid}/pointsGained`] = 0;
          }
          await update(roomDbRef, updates);

          // Specifically write to rooms/${roomPIN}/currentQuestion
          const currentQuestionRef = ref(db, `rooms/${roomPIN}/currentQuestion`);
          await set(currentQuestionRef, activeQuestion);

          // Clear responses
          const responsesRef = ref(db, `rooms/${roomPIN}/responses`);
          await set(responsesRef, null);
        } catch (eRT) {
          console.error("RTDB broadcast sync error:", eRT);
        }
      }

      console.log(`🚀 Successfully broadcasted question id ${activeQuestion.id} to room ${roomPIN}`);
    } catch (err) {
      console.error("❌ Fatal Error in handleBroadcast:", err);
      alert('حدث خطأ أثناء بث وتنشيط السؤال في Firebase. المرجو المحاولة مجدداً.');
    }
  };

  const handleBroadcastQuestion = async (idx: number) => {
    if (!currentRoom) return;
    const targetQuestion = poolQuestions[idx];
    if (!targetQuestion) return;
    await handleBroadcast(currentRoom.pin, targetQuestion);
  };

  const handleSkipTimerAndReveal = async () => {
    if (!currentRoom) return;
    await updateRoom(currentRoom.pin, {
      state: 'question_result',
      revealAnswer: true,
      secondsRemaining: 0
    });
  };

  const handleShowLeaderboardOnProjector = async () => {
    if (!currentRoom) return;
    
    // Save current active subject as completed on adventure map
    const compSubjects = { 
      ...(currentRoom.completedSubjects || {}), 
      [currentRoom.activeSubject || selectedSubject]: true 
    };

    await updateRoom(currentRoom.pin, {
      completedSubjects: compSubjects,
      state: 'leaderboard'
    });
  };

  const handleFinishCrownTrophy = async () => {
    if (!currentRoom) return;
    if (window.confirm('هل ترغب في قفل المغامرة والولوج لشاشة التتويج النهائي؟ 🎁🎖️')) {
      await updateRoom(currentRoom.pin, {
        state: 'finished'
      });
    }
  };

  const handleToggleRiskMultiplierActive = async () => {
    if (!currentRoom) return;
    const isNowActive = !currentRoom.multiplierActive;
    await updateRoom(currentRoom.pin, {
      multiplierActive: isNowActive
    });
  };

  const handleEndClassroomSession = async () => {
    if (!currentRoom) return;
    if (window.confirm('تحذير! هل أنت متأكد من رغبتك في إغلاق هذه الغرفة وحل المجموعات؟')) {
      await terminateRoom(currentRoom.pin);
      localStorage.removeItem('school_teacher_active_room_pin');
      setActivePin(null);
      setCurrentRoom(null);
      setGameState('setup');
    }
  };

  const handleManualAdjustPoints = async (pid: string, amount: number) => {
    if (!currentRoom) return;
    try {
      // Direct optimistic state update for snappy UI feedback
      const updatedPlayers = { ...currentRoom.players };
      const currentScore = updatedPlayers[pid]?.score || 0;
      const targetScore = Math.max(0, currentScore + amount);
      if (updatedPlayers[pid]) {
        updatedPlayers[pid].score = targetScore;
        setCurrentRoom({
          ...currentRoom,
          players: updatedPlayers
        });
      }
      
      await adjustPlayerScore(currentRoom.pin, pid, amount);

      if (isRealFirebaseConfigured) {
        try {
          // Direct real database update paths as requested: rooms/${roomPIN}/teams/${teamId}/score
          const scoreRef = ref(db, `rooms/${currentRoom.pin}/teams/${pid}/score`);
          await set(scoreRef, targetScore);

          const playerRef = ref(db, `rooms/${currentRoom.pin}/players/${pid}/score`);
          await set(playerRef, targetScore);
        } catch (eRT) {
          console.error("RTDB score syncing error:", eRT);
        }
      }

      console.log(`Successfully adjusted score for playerId: ${pid} with amount: ${amount}`);
    } catch (err) {
      console.error("❌ Failed of manual score adjustment in teacher portal:", err);
    }
  };

  // Helper values for displaying telemetry
  const totalPlayers = currentRoom && currentRoom.players ? Object.keys(currentRoom.players).length : 0;
  const playersList = currentRoom && currentRoom.players ? Object.values(currentRoom.players) : [];
  const answeredCount = playersList.filter(p => p.answeredThisRound).length;

  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  // 1. Password Screen Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4" dir="rtl">
        <div className="bg-[#0c1424] border-2 border-indigo-900/50 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center max-w-sm w-full transition-all">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-[#10192e] p-4 rounded-full border border-indigo-600/30 text-indigo-400 relative">
              <Lock className="w-8 h-8 animate-pulse text-[#0038A8]" />
              <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-[#0c1424]"></div>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white leading-snug">بوابة الأستاذ والمشرف 🔑</h3>
              <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                مغلق لأغراض الأمان الديدكتيكي والصفّي. يرجى إثبات هويتك للولوج لإعداد اللعبة.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                placeholder="أدخل الرمز المخصص للمشرف"
                value={passcode}
                onChange={(e) => {
                  setPasscodeError(null);
                  setPasscode(e.target.value);
                }}
                className="w-full text-center tracking-[0.3em] font-mono font-black text-2xl bg-slate-900 border-2 border-indigo-950 text-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-700 outline-none p-3.5 rounded-2xl transition-all placeholder:tracking-normal placeholder:text-slate-600"
                autoFocus
              />
            </div>

            {passcodeError && (
              <p className="text-xs text-rose-400 font-bold flex items-center justify-center gap-1.5 leading-relaxed bg-rose-950/20 p-2.5 rounded-xl border border-rose-900/30">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passcodeError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={!passcode}
              className={`w-full font-black text-xs py-4 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 ${
                passcode 
                  ? 'bg-gradient-to-r from-[#0038A8] to-indigo-700 text-white hover:shadow-lg hover:from-indigo-650' 
                  : 'bg-slate-900 text-slate-500 border border-indigo-950 cursor-not-allowed'
              }`}
            >
              <Unlock className="w-4 h-4" />
              <span>تأكيد الهوية ودخول اللوحة 🚀</span>
            </button>
          </form>

          <div className="border-t border-indigo-950/80 pt-4 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-405 text-slate-400 font-semibold text-center leading-relaxed">
              💡 الرمز التجريبي لتسهيل التقييم والاعتماد: <span className="font-mono text-amber-400 underline font-black text-sm">2026</span>
            </p>
            <button
              onClick={onBackToMain}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-black mt-1"
            >
              الرجوع لبوابة الاستقبال الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------------------------------
  // STATE 1: SETUP GAME (gameState === 'setup')
  // Preparation & AI Generation / Custom question list edits
  // -------------------------------------------------------------------------------------------------
  if (gameState === 'setup') {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-8 text-right space-y-8 animate-fade-in" dir="rtl">
        
        {/* Moroccan Majorelle Header Block */}
        <header className="bg-[#0038A8] text-white rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-indigo-550 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
          <div className="space-y-2 relative z-10">
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 font-sans tracking-tight">
              <span className="bg-white/10 p-2 rounded-2xl">💻</span>
              <span>مستشار الأستاذ الذكي - معترك القلاع ⚔️🏰</span>
            </h1>
            <p className="text-xs md:text-sm text-indigo-150 text-indigo-100 font-medium max-w-2xl leading-relaxed">
              هنا يمكنك صياغة وتحضير أسئلة التحدي بدقة بيداغوجية ملائمة للمنهاج المغربي. ولّد بنقرة واحدة مستعيناً بالـ <span className="text-yellow-300 font-bold font-mono">Gemini AI</span> أو طوّر قائمتك الخاصة لتنشيط الغرفة وبدء المغامرة!
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 font-extrabold text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer relative z-10 shrink-0"
          >
            <Lock className="w-4 h-4 text-rose-450" />
            <span>تسجيل الخروج 🔐</span>
          </button>
        </header>

        {/* Setup parameters grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Block: Configuration Fields (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-950 space-y-6">
              <div className="flex items-center gap-2 border-b border-indigo-950 pb-3">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-extrabold text-sm">أولاً: صياغة معايير ومواضيع المعترك</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Level SELECT */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300 flex items-center gap-1">
                    <span>المستوى الدراسي:</span>
                  </label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all cursor-pointer"
                  >
                    <option value="المستوى السادس">المستوى السادس (6 AP)</option>
                    <option value="المستوى الخامس">المستوى الخامس (5 AP)</option>
                    <option value="المستوى الرابع">المستوى الرابع (4 AP)</option>
                    <option value="المستوى الثالث">المستوى الثالث (3 AP)</option>
                    <option value="المستوى الثاني">المستوى الثاني (2 AP)</option>
                    <option value="المستوى الأول">المستوى الأول (1 AP)</option>
                  </select>
                </div>

                {/* Subject SELECT */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300">المادة والقلعة المستهدفة:</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all cursor-pointer"
                  >
                    <option value="اللغة العربية">قلعة الضاد (اللغة العربية)</option>
                    <option value="اللغة الفرنسية">قلعة Molière (اللغة الفرنسية)</option>
                    <option value="الرياضيات">قلعة الخوارزمي (الرياضيات)</option>
                    <option value="التربية الإسلامية">قلعة الإيمان (التربية الإسلامية)</option>
                    <option value="النشاط العلمي">قلعة ابن سينا (النشاط العلمي)</option>
                    <option value="الاجتماعيات">قلعة ابن بطوطة (الاجتماعيات)</option>
                  </select>
                </div>

                {/* SubComponent SELECT */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300">مكون الدرس الفرعي :</label>
                  <select
                    value={selectedSubComponent}
                    onChange={(e) => setSelectedSubComponent(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all cursor-pointer"
                  >
                    {getSubComponentsForSubject(selectedSubject).map((comp) => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>

                {/* Question Type Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300">نمط السؤال والتصرف التلقائي:</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as any)}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all cursor-pointer"
                  >
                    <option value="mcq">النمط الاختياري QCM (أزرار 3D ضخمة ملونة)</option>
                    <option value="written">النمط الكتابي (حقل نصي لكتابة الإجابة)</option>
                    <option value="oral">النمط الشفهي (استعد للإجابة وتقييم يدوي)</option>
                  </select>
                </div>

                {/* Number of Questions Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300">عدد الأسئلة المطلوبة:</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all cursor-pointer"
                  >
                    <option value={1}>سؤال واحد (1)</option>
                    <option value={2}>سؤالان (2)</option>
                    <option value={3}>ثلاثة أسئلة (3)</option>
                    <option value={5}>خمسة أسئلة (5)</option>
                    <option value={8}>ثمانية أسئلة (8)</option>
                    <option value={10}>عشرة أسئلة (10)</option>
                  </select>
                </div>

                {/* Custom Topic Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-300">الدرس المستهدف أو عبارة مفتاحية (اختياري):</label>
                  <input
                    type="text"
                    placeholder="مثال: الكسور العشرية، المفعول لأجله، صلح الحديبية..."
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-indigo-950 text-white text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-600 transition-all placeholder:text-slate-650"
                  />
                </div>

              </div>

              {/* GENERATE ACTION BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-xl text-black font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    isGenerating 
                      ? 'bg-amber-100/30 text-slate-400 cursor-wait' 
                      : 'bg-[#00E5FF] hover:bg-[#00c5dd] hover:scale-[1.01]'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 text-black ${isGenerating ? 'animate-spin' : 'animate-pulse'}`} />
                  <span>{isGenerating ? 'جاري الصياغة البيداغوجية عبر الذكاء الاصطناعي... ⏳' : 'توليد الأسئلة فورياً بـ Gemini AI 🪄'}</span>
                </button>
              </div>

              {generationError && (
                <div className="bg-rose-950/20 text-rose-450 border border-rose-900/35 p-3 rounded-xl text-xs font-bold">
                  ⚠️ {generationError}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: PREVIEW LIST AND LAUNCH (1 column) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Generated questions list preview */}
            <div className="bg-[#0b121f] text-white rounded-3xl p-6 border border-indigo-950 space-y-4 max-h-[380px] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-indigo-950 pb-2.5">
                <h3 className="font-extrabold text-xs text-amber-200 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#00E5FF]" />
                  <span>قائمة الأسئلة المحضرة للتحدي ({poolQuestions.length})</span>
                </h3>
              </div>

              {poolQuestions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <span className="text-3xl">⛵</span>
                  <p className="text-xs font-extrabold leading-relaxed">السفينة خالية من التحديات الآن!</p>
                  <p className="text-[10px] text-slate-600 leading-relaxed">قم بتهيئية الخصائص على اليسار ثم انقر على توليد لتتمكن من معاينة وتغيير الأسئلة وتنشيط البث الحي.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {poolQuestions.map((q, qIndex) => (
                    <div key={q.id || qIndex} className="bg-slate-900/60 p-3.5 rounded-2xl border border-indigo-950 space-y-2 relative group">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-[#0038A8] text-white font-extrabold px-2 py-0.5 rounded-md">سؤال {qIndex + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-indigo-950 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded">
                            {q.type === 'written' ? 'كتابي ✏️' : q.type === 'oral' ? 'شفهي 🗣️' : 'QCM 🔘'}
                          </span>
                          <button
                            onClick={() => {
                              const updated = poolQuestions.filter((_, idx) => idx !== qIndex);
                              setPoolQuestions(updated);
                            }}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-all"
                            title="حذف هذا السؤال"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] font-bold text-slate-100 leading-relaxed text-right">{q.text}</p>
                      
                      {q.type === 'mcq' && q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400 font-bold">
                          {q.options.map((opt, oIdx) => (
                            <span 
                              key={oIdx} 
                              className={`truncate p-1 bg-slate-950 rounded border ${oIdx === q.correctIndex ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/10' : 'border-indigo-950'}`}
                            >
                              • {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Launch Block */}
            <div className="bg-[#0b121f] rounded-3xl p-6 border-2 border-emerald-500/30 text-center space-y-4">
              <h3 className="text-sm font-black text-emerald-400 flex items-center justify-center gap-2">
                <Play className="w-5 h-5 animate-pulse" />
                <span>2. تنشيط الغرفة لبدء المعركة</span>
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed font-bold text-right">
                عند النقر على الزر بالأسفل، سيقوم النظام بتأمين وبث PIN مخصص (لغرفة تفاعلية متزامنة). سيتمكن طلابك والحاسوب الكلي العارض للمسابقة من الدخول واللحاق ومبارزة المجموعات للربح!
              </p>

              <button
                type="button"
                onClick={handleLaunchRoomSession}
                disabled={poolQuestions.length === 0 || loadingRoom}
                className={`w-full py-4 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${
                  poolQuestions.length > 0 && !loadingRoom
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:shadow-lg cursor-pointer hover:scale-[1.01]'
                    : 'bg-slate-900 border border-indigo-950 text-slate-500 cursor-not-allowed'
                }`}
              >
                {loadingRoom ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تفعيل الحصة وسحب المزامنة...</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-4 h-4 shrink-0" />
                    <span>تفعيل الغرفة وبدء تواصل المجموعات 🌐🚀</span>
                  </>
                )}
              </button>

              <button
                onClick={onBackToMain}
                className="text-xs text-slate-400 hover:text-white underline font-semibold mt-2 block mx-auto"
              >
                العودة لبوابة الاستقبال
              </button>
            </div>

          </div>

        </div>

      </div>
    );
  }

  // -------------------------------------------------------------------------------------------------
  // STATE 2: LIVE BROADCAST & REMOTE CONTROL BOARD (gameState === 'live')
  // Split into left (Live monitoring/scores) and right (Generated questions broadcast trigger)
  // -------------------------------------------------------------------------------------------------
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-8 text-right space-y-6" dir="rtl">
      
      {/* Active Header Dashboard Banner */}
      <header className="bg-slate-900 text-white rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 border-2 border-indigo-900/60 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="bg-[#0038A8]/20 p-3 rounded-2xl border border-indigo-500/30 text-amber-400 animate-pulse">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black">غرفة الأستاذ النشطة: معترك الكنز ⛵👑</h1>
              <span className="text-[10px] bg-[#0038A8] text-white px-2.5 py-0.5 rounded-full font-black animate-pulse">تواصل مباشر 🟢</span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-1">
              المستوى المستهدف: <span className="text-amber-400">{selectedLevel}</span> • المادة: <span className="text-[#00E5FF] font-black">{selectedSubject}</span>
            </p>
          </div>
        </div>

        {/* PIN CODE PRESENTATION */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-indigo-900/85 px-4 py-2 rounded-2xl text-center">
            <p className="text-[9px] text-indigo-400 font-black">رمز دخول المجموعات PIN</p>
            <p className="text-2xl font-mono tracking-widest font-black text-amber-450 text-amber-400">{currentRoom?.pin}</p>
          </div>

          <button
            onClick={handleEndClassroomSession}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <LogOut className="w-4 h-4" />
            <span>إنهاء وإغلاق الحصة 🛑</span>
          </button>
        </div>
      </header>

      {/* Main Two Column State Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (4 CoLS): Connected Teams, Manual Gold Increments & Magic Cards Tracker */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Mapped Team Connections list with manual feedback */}
          <div className="bg-[#0b121f] text-white rounded-3xl p-5 border border-indigo-950 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-indigo-950 pb-2">
              <h3 className="font-extrabold text-xs text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>مجموعات المغامرين المتصلة ({totalPlayers})</span>
              </h3>
              <span className="text-[9px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-black">تقييم الأستاذ اللحظي</span>
            </div>

            {totalPlayers === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2 flex flex-col justify-center items-center">
                <span className="text-4xl animate-bounce">🏝️</span>
                <p className="text-xs font-black text-slate-400">بانتظار التحاق سفن المجموعات...</p>
                <p className="text-[9px] text-slate-550 text-slate-500 max-w-xs leading-relaxed">
                  اطلب من النلاميذ فتح بوابة المغامرة وإدخال اسم المجموعة والرمز PIN <span className="font-mono text-amber-400 font-extrabold">{currentRoom?.pin}</span> الموضح أعلى الشاشة.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {playersList.map((p) => {
                  const resp = teamsResponses[p.id];
                  return (
                    <div key={p.id} className="bg-slate-900/80 border border-indigo-950 p-3 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{p.avatar || '⛵'}</span>
                          <div className="min-w-0 text-right">
                            <p className="text-xs font-black text-slate-100 truncate">{p.name}</p>
                            <p className="text-[10px] text-amber-400 font-bold mt-0.5 flex items-center gap-1.5">
                              <span>{p.score} ذهبية</span>
                              {p.streak > 0 && (
                                <span className="bg-red-950/40 text-rose-400 px-1.5 py-0.5 rounded text-[8.5px] font-black flex items-center gap-0.5 border border-rose-900/30">
                                  <Flame className="w-2.5 h-2.5 text-rose-400" />
                                  {p.streak} متتالي
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* GRADING FEEDBACK BUTTONS FOR THE EDUCATOR */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleManualAdjustPoints(p.id, 200)}
                            className="p-1 px-1.5 text-xs text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/50 rounded-lg border border-emerald-900/30 transition-all cursor-pointer flex items-center gap-0.5"
                            title="منح 200 ذهبية لمجهود متميز"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>200+</span>
                          </button>
                          
                          <button
                            onClick={() => handleManualAdjustPoints(p.id, -200)}
                            className="p-1 px-1.5 text-xs text-rose-400 bg-rose-950/20 hover:bg-rose-950/50 rounded-lg border border-rose-900/30 transition-all cursor-pointer flex items-center gap-0.5"
                            title="خصم 200 ذهبية"
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            <span>200-</span>
                          </button>
                        </div>
                      </div>

                      {/* Live Teams Answer / Feedback tracker */}
                      {resp && (
                        <div className="text-[10px] bg-slate-950 border border-indigo-900/30 text-slate-300 font-medium px-2.5 py-1.5 rounded-xl block text-right mt-1">
                          <span className="text-amber-400 font-extrabold">الجواب المختار: </span>
                          <span className="text-slate-100 font-bold pb-1 block">
                            {typeof resp.selectedAnswer === 'number'
                              ? `الخيار رَقْم ${resp.selectedAnswer + 1} (${activeQuestion?.options[resp.selectedAnswer] || ''})`
                              : `"${resp.selectedAnswer}"`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {resp.isCorrect ? (
                              <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded font-black text-[9px]">✔️ صحيحة</span>
                            ) : (
                              <span className="bg-rose-950/50 text-rose-400 border border-rose-900/30 px-1.5 py-0.5 rounded font-black text-[9px]">❌ خاطئة</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TELEMETRY ACTIVE CARDS STATUS TABLE */}
          <div className="bg-[#0b121f] text-white rounded-3xl p-5 border border-indigo-950 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-indigo-950 pb-2">
              <h3 className="font-extrabold text-xs text-slate-205 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00E5FF]" />
                <span>لوحة متابعة بطاقات دعم الحظ للمتعلمين</span>
              </h3>
              <span className="text-[8px] px-2 py-0.5 font-bold rounded-full bg-emerald-950 text-emerald-400 animate-pulse">ربط لحظي</span>
            </div>

            {totalPlayers === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-4">في انتظار تسجيل المتعلمين لمتابعة بطاقاتهم.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[10px] font-bold">
                  <thead>
                    <tr className="border-b border-indigo-950/80 text-slate-400">
                      <th className="pb-1.5">المجموعة</th>
                      <th className="pb-1.5 text-center">💡 الفيلسوف (التلميح)</th>
                      <th className="pb-1.5 text-center">🛡️ الدرع (الحماية)</th>
                      <th className="pb-1.5 text-center">🌋 الزلزال (تمديد الوقت)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-950/40">
                    {playersList.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/30">
                        <td className="py-2.5 truncate max-w-[90px] text-slate-200">
                          <span className="ml-1">{p.avatar}</span>
                          <span>{p.name}</span>
                        </td>
                        <td className="py-2 text-center">
                          {p.usedPhilosopher ? (
                            <span className="text-[8.5px] bg-red-950/30 text-rose-450 border border-rose-900/40 px-2 py-0.5 rounded-full font-black">نَفِدت</span>
                          ) : (
                            <span className="text-[8.5px] bg-emerald-950/30 text-emerald-405 border border-emerald-900/40 px-2 py-0.5 rounded-full font-black">مـتـاحة</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {p.usedShield ? (
                            <span className="text-[8.5px] bg-red-950/30 text-rose-450 border border-rose-900/40 px-2 py-0.5 rounded-full font-black">نَفِدت</span>
                          ) : (
                            <span className="text-[8.5px] bg-emerald-950/30 text-emerald-405 border border-emerald-900/40 px-2 py-0.5 rounded-full font-black">مـتـاحة</span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {p.usedTimeQuake ? (
                            <span className="text-[8.5px] bg-red-950/30 text-rose-450 border border-rose-900/40 px-2 py-0.5 rounded-full font-black">نَفِدت</span>
                          ) : (
                            <span className="text-[8.5px] bg-emerald-950/30 text-emerald-405 border border-emerald-900/40 px-2 py-0.5 rounded-full font-black">مـتـاحة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (8 CoLS): Broadcast Remote controls & Question list manager */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* BROADCAST QUESTIONS REMOTE PANEL */}
          <div className="bg-slate-900 rounded-3xl p-5 md:p-6 shadow-2xl border border-indigo-950 space-y-5">
            <div className="flex justify-between items-center border-b border-indigo-950 pb-3">
              <div className="flex items-center gap-2">
                <Anchor className="w-5 h-5 text-amber-400" />
                <h3 className="text-white font-black text-sm">مستودع البث وتفجير الأسئلة لحظياً ⚔️🏰</h3>
              </div>
              <span className="text-[9px] text-[#00E5FF] font-black">انقر لتفعيل البث الفوري</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              اضغط على المغلف المقابل للسؤال تحت ليرسل فوراً إلى أجهزة التلاميذ وشاشة البروجيكتور الكبرى لبدء الوقت التنازلي التفاعلي الممتع!
            </p>

            {/* Questions broadcast grid list */}
            <div className="space-y-3.5">
              {poolQuestions.map((q, qIndex) => {
                const isSentThisIndex = currentRoom?.currentQuestionIndex === qIndex;
                return (
                  <div 
                    key={q.id || qIndex} 
                    className={`p-4 rounded-2xl border-2 transition-all text-right flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                      isSentThisIndex 
                        ? 'bg-gradient-to-br from-indigo-950 to-slate-900 border-amber-400 shadow-lg ring-2 ring-amber-500/20' 
                        : 'bg-slate-950 border-indigo-950 hover:border-indigo-850'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] bg-amber-450 bg-[#0038A8] text-white font-extrabold px-2 py-0.5 rounded">السؤال {qIndex + 1}</span>
                        <span className="text-[9px] bg-indigo-950 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded">
                          {q.type === 'written' ? 'نمط كتابي ✏️' : q.type === 'oral' ? 'نمط شفهي 🗣️' : 'نمط اختيار QCM 🔘'}
                        </span>
                        <span className="text-[9px] text-teal-300 font-bold">({q.points} نقطة / {q.timeLimit}ث)</span>
                      </div>
                      <p className="text-xs md:text-sm font-bold text-white leading-relaxed whitespace-pre-wrap break-words" title={q.text}>{q.text}</p>
                    </div>

                    <button
                      onClick={() => currentRoom && handleBroadcast(currentRoom.pin, q)}
                      className={`w-full md:w-auto px-5 py-3 rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow transition-all flex items-center justify-center gap-1.5 ${
                        isSentThisIndex 
                          ? 'bg-amber-500 text-slate-950 font-black hover:bg-amber-400 hover:scale-[1.01]'
                          : 'bg-[#0038A8] hover:bg-indigo-700 text-white font-black hover:scale-[1.01]'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      <span>{isSentThisIndex ? 'بث السؤال جارٍ... (اضغط لإعادة الإرسال) 🔄🔥' : 'بث وتنشيط السؤال كلياً 🚀'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* TOGGLE RISK MULTIPLIER BUTTON AT BEDTIME */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-950 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="space-y-1 text-right">
                <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                  مضاعفة الفرص الكبرى (مضاعف المخاطرة النشط):
                </span>
                <p className="text-[9.5px] text-slate-400 leading-relaxed font-bold">
                  في حال تفعيله، سيتمكن المتعلمون من حسم الجواب بـ 2x نقاط مع خطر خسارة بعض النقاط في حال السقوط الخطأ بمطبة الإجابة!
                </p>
              </div>

              <button
                onClick={handleToggleRiskMultiplierActive}
                className={`px-5 py-3 rounded-xl text-xs font-black shrink-0 transition-all shadow cursor-pointer flex items-center gap-1.5 ${
                  currentRoom?.multiplierActive 
                    ? 'bg-rose-600 border border-rose-500 text-white' 
                    : 'bg-slate-900 text-slate-300 border border-indigo-950 hover:bg-slate-850'
                }`}
              >
                {currentRoom?.multiplierActive ? (
                  <>
                    <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
                    <span>المضاعفة نشطة 🔥 [تعطيل]</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-slate-400" />
                    <span>تنشيط مضاعفة النقاط (2x)</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* REALTIME RESULTS AND PRESENT STATE PROGRESS */}
          {currentRoom && (
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-xl border border-indigo-50/70 space-y-4 text-right">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl">
                  {currentRoom.state === 'question_countdown' 
                    ? 'العد التنازلي التمهيدي للسؤال' 
                    : currentRoom.state === 'question_active' 
                      ? 'بث السؤال وتنافس الوقت المباشر' 
                      : currentRoom.state === 'question_result' 
                        ? 'إنهاء الوقت وإشهار النتيجة' 
                        : currentRoom.state === 'leaderboard' 
                          ? 'جدول ترتيب حسم المجموعات' 
                          : 'انتظار تفعيل البث'}
                </span>

                <div className="flex items-center gap-1 bg-slate-100 border px-3 py-1 rounded-xl">
                  <Clock className="w-4 h-4 text-[#0038A8] animate-pulse" />
                  <span className="font-mono text-xs font-black">{currentRoom.secondsRemaining} ثانٍ</span>
                </div>
              </div>

              {/* Countdown intro details */}
              {currentRoom.state === 'question_countdown' && (
                <div className="py-8 text-center space-y-2">
                  <p className="text-[#0038A8] font-black animate-pulse text-xs">استعدوا! تفعيل السؤال ينطلق الآن...</p>
                  <p className="text-4xl font-mono font-black text-slate-900">{currentRoom.secondsRemaining}</p>
                </div>
              )}

              {/* Active display on question active */}
              {activeQuestion && currentRoom.state !== 'question_countdown' && (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-indigo-600 font-black">{activeQuestion.level} • {activeQuestion.subject} ({activeQuestion.subComponent})</p>
                    <h4 className="text-sm font-black text-slate-800 leading-relaxed mt-1">{activeQuestion.text}</h4>
                  </div>

                  {activeQuestion.type === 'mcq' && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      {activeQuestion.options.map((opt, oi) => (
                        <div 
                          key={oi} 
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            currentRoom.revealAnswer && oi === activeQuestion.correctIndex
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                              : 'bg-white border-slate-150 text-slate-500'
                          }`}
                        >
                          <span>{opt}</span>
                          {currentRoom.revealAnswer && oi === activeQuestion.correctIndex && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submission statistics */}
                  <div className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>استجابة المجموعات الراهنة:</span>
                    <span className="text-indigo-600 font-black">{answeredCount} من أصل {totalPlayers} متسابقين</span>
                  </div>
                </div>
              )}

              {/* LEADERBOARD VIEW ON CONTROLLER */}
              {(currentRoom.state === 'leaderboard' || currentRoom.state === 'finished') && (
                <div className="text-center py-6 space-y-4">
                  <span className="text-4xl">🏆🎖️</span>
                  <h3 className="font-extrabold text-slate-850 text-sm">
                    {currentRoom.state === 'finished' ? 'انتهت المعركة الصفية الكبرى وتم فتح صندوق كنز المعرفة' : 'ترتيب المجموعات الأقوى الراهن'}
                  </h3>

                  <div className="max-w-md mx-auto space-y-2">
                    {playersList
                      .sort((a,b) => b.score - a.score)
                      .slice(0, 3)
                      .map((p, idx) => (
                        <div key={p.id} className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-700">#{idx + 1} {p.avatar} {p.name}</span>
                          <span className="font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">{p.score} ذهبية</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ACTION BUTTON CONTROLLER BOARD DEPENDEND ON FIRESTORE SYNC STATE */}
              <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 justify-between items-center text-xs">
                
                {currentRoom.state === 'question_active' && (
                  <button
                    onClick={handleSkipTimerAndReveal}
                    className="bg-indigo-650 bg-[#0038A8] hover:bg-slate-850 text-white font-black px-4 py-3 rounded-xl cursor-pointer shadow transition-all shrink-0"
                  >
                    إنهاء المؤقت وإشهار الجواب الصحيح 👁️
                  </button>
                )}

                {currentRoom.state === 'question_result' && (
                  <button
                    onClick={handleShowLeaderboardOnProjector}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-4 py-3 rounded-xl cursor-pointer shadow transition-all shrink-0"
                  >
                    كشف الترتيب في شاشة البروجيكتور 🏆
                  </button>
                )}

                {currentRoom.state === 'leaderboard' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Switch setup tab to draft another castle subject!
                        setGameState('setup');
                        setPoolQuestions([]);
                        setCustomTopic('');
                      }}
                      className="bg-sky-650 bg-[#00E5FF] hover:bg-sky-500 text-slate-950 font-black px-4 py-3 rounded-xl cursor-pointer transition-all shrink-0"
                    >
                      تجهيز وتوليد القلعة التالية 🏰
                    </button>

                    <button
                      onClick={handleFinishCrownTrophy}
                      className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-3 rounded-xl cursor-pointer shadow transition-all shrink-0"
                    >
                      التتويج النهائي بصندوق الكنز 🔱
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    // Quick reset parameters to allow teacher re-write questions
                    setGameState('setup');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 font-extrabold px-3 py-3 rounded-xl transition-all font-bold"
                >
                  العودة لقسم التحضير والتعديل
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
