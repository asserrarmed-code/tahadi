import React, { useState, useEffect } from 'react';
import { 
  Laptop, Play, Plus, Trash, Clock, Users, Check, RefreshCw, 
  Settings, Award, Sparkles, LogOut, ArrowRight, ShieldAlert,
  Lock, Unlock, HelpCircle, Trophy, Volume2, PlusCircle, MinusCircle, Brain,
  Shield, Flame, Anchor, Tv, Zap, Heart, Award as StarIcon
} from 'lucide-react';
import { Room, Player, Question, QuizSet } from '../types';
import { INITIAL_QUIZZES } from '../data';
import { createRoom, updateRoom, listenToRoom, adjustPlayerScore, terminateRoom } from '../lib/firebase';
import AIGenerator from './AIGenerator';

interface TeacherViewProps {
  onBackToMain: () => void;
}

export default function TeacherView({ onBackToMain }: TeacherViewProps) {
  const [quizzes, setQuizzes] = useState<QuizSet[]>(() => {
    const saved = localStorage.getItem('school_custom_quizzes');
    if (saved) {
      try {
        return [...INITIAL_QUIZZES, ...JSON.parse(saved)];
      } catch (e) {
        return INITIAL_QUIZZES;
      }
    }
    return INITIAL_QUIZZES;
  });

  // Password Gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('school_teacher_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Room control properties
  const [selectedQuizId, setSelectedQuizId] = useState(quizzes[0].id);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [generatingForSubject, setGeneratingForSubject] = useState<string | null>(null);

  // Listen to active room
  useEffect(() => {
    const savedPin = localStorage.getItem('school_teacher_active_room_pin');
    if (savedPin) {
      setLoading(true);
      const unsubscribe = listenToRoom(savedPin, (room) => {
        setCurrentRoom(room);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  // Standard room timer handle
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        updateRoom(currentRoom.pin, {
          secondsRemaining: currentRoom.secondsRemaining - 1
        });
      }, 1005);
    } else if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining === 0) {
      // Transition on timeout
      updateRoom(currentRoom.pin, {
        state: 'question_result',
        revealAnswer: true
      });
    }
    
    // Countdown transition
    if (currentRoom && currentRoom.state === 'question_countdown' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        const nextTime = currentRoom.secondsRemaining - 1;
        if (nextTime === 0) {
          const activeQuiz = currentRoom.activeQuiz;
          const q = activeQuiz?.questions[currentRoom.currentQuestionIndex];
          updateRoom(currentRoom.pin, {
            state: 'question_active',
            secondsRemaining: q?.timeLimit || 25,
            questionStartedAt: Date.now()
          });
        } else {
          updateRoom(currentRoom.pin, {
            secondsRemaining: nextTime
          });
        }
      }, 1005);
    }

    return () => clearTimeout(timer);
  }, [currentRoom]);

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '2026') {
      setIsAuthenticated(true);
      localStorage.setItem('school_teacher_auth', 'true');
      setPasscodeError(null);
    } else {
      setPasscodeError('❌ رمز الأستاذ غير صحيح! يرجى الاستعانة برمز التمكين.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('school_teacher_auth');
  };

  const handleLaunchRoom = async () => {
    setLoading(true);
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
    if (!selectedQuiz) return;

    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const room = await createRoom(randomPin, selectedQuiz);
      setCurrentRoom(room);
      localStorage.setItem('school_teacher_active_room_pin', randomPin);
    } catch (err) {
      alert('تعذر فتح الحصة، يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!currentRoom) return;
    const activeQuiz = currentRoom.activeQuiz;
    if (!activeQuiz || activeQuiz.questions.length === 0) {
      alert('المرجو توليد تحدي أولاً بالضغط على إحدى قلاع المواد الست!');
      return;
    }

    await updateRoom(currentRoom.pin, {
      currentQuestionIndex: 0,
      currentQuestionId: activeQuiz.questions[0].id,
      state: 'question_countdown',
      secondsRemaining: 3,
      revealAnswer: false
    });
  };

  const handleNextAction = async () => {
    if (!currentRoom) return;
    const activeQuiz = currentRoom.activeQuiz;
    if (!activeQuiz) return;

    const nextIdx = currentRoom.currentQuestionIndex + 1;
    if (nextIdx < activeQuiz.questions.length) {
      // Clear answers for all players
      const updatedPlayers = { ...currentRoom.players };
      for (const pid in updatedPlayers) {
        updatedPlayers[pid] = {
          ...updatedPlayers[pid],
          answeredThisRound: false,
          answerIndex: null,
          writtenAnswer: '',
          isCorrect: false,
          pointsGained: 0
        };
      }

      await updateRoom(currentRoom.pin, {
        currentQuestionIndex: nextIdx,
        currentQuestionId: activeQuiz.questions[nextIdx].id,
        state: 'question_countdown',
        secondsRemaining: 3,
        revealAnswer: false,
        players: updatedPlayers
      });
    } else {
      await updateRoom(currentRoom.pin, {
        state: 'leaderboard'
      });
    }
  };

  const handleShowLeaderboard = async () => {
    if (!currentRoom) return;
    
    // Once result is handled, let's flag the activeSubject as Completed on Room state
    const completedUpdates = { 
      ...(currentRoom.completedSubjects || {}), 
      [currentRoom.activeSubject || '']: true 
    };

    await updateRoom(currentRoom.pin, {
      completedSubjects: completedUpdates,
      state: 'leaderboard'
    });
  };

  const handleFinishAdventureGame = async () => {
    if (!currentRoom) return;
    if (confirm('هل انتهت جولة الكنز بالكامل وترغب بالتتويج النهائي؟ 🎁')) {
      await updateRoom(currentRoom.pin, {
        state: 'finished'
      });
    }
  };

  const handleSkipTimer = async () => {
    if (!currentRoom) return;
    await updateRoom(currentRoom.pin, {
      state: 'question_result',
      revealAnswer: true,
      secondsRemaining: 0
    });
  };

  const handleTerminateSession = async () => {
    if (!currentRoom) return;
    if (confirm('هل أنت متأكد من رغبتك في إغلاق هذه الغرفة تفادياً لتعارض البث؟ 🛑')) {
      await terminateRoom(currentRoom.pin);
      setCurrentRoom(null);
      localStorage.removeItem('school_teacher_active_room_pin');
    }
  };

  const handleManualPointsAdjust = async (playerId: string, amount: number) => {
    if (!currentRoom) return;
    await adjustPlayerScore(currentRoom.pin, playerId, amount);
  };

  const handleQuizAddedByAi = (newQuiz: QuizSet) => {
    const updated = [newQuiz, ...quizzes];
    setQuizzes(updated);
    
    const customOnly = updated.filter(q => q.id.startsWith('quiz-gen-'));
    localStorage.setItem('school_custom_quizzes', JSON.stringify(customOnly));
    
    setSelectedQuizId(newQuiz.id);
    setShowAiDrawer(false);
  };

  // Helper utility to produce a high-fidelity mock question matching the Moroccan curriculum on client-side if server is unreachable
  const getLocalPedagogicalQuestion = (subject: string, level: string) => {
    const mainSubject = (subject || '').trim();
    
    if (mainSubject.includes('إسلامية') || mainSubject.includes('اسلامية') || mainSubject.includes('التربية')) {
      return {
        text: `ما هي "فرائض الوضوء" المعتمدة في مذهب إمامنا مالك بالمملكة المغربية؟`,
        options: [
          'سبعة: النية، غسل الوجه، غسل اليدين، مسح الرأس، غسل الرجلين، الدلك، الموالاة',
          'خمسة: التسمية، المضمضة، الاستنشاق، مسح الأذنين، غسل الكوعين',
          'أربعة فقط: غسل الوجه واليدين ومسح بعض الرأس ورجلين',
          'تسعة: التثليث والبسملة وتخليل الشعر والسواك'
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 20
      };
    }
    
    if (mainSubject.includes('عربية') || mainSubject.includes('عربي') || mainSubject.includes('اللغة')) {
      return {
        text: `في الدرس اللغوي بمقرر المستوى السادس، ما هو الإعراب الصحيح في جملة: "حفظ سليمان القرآن طاعةً للهِ"؟`,
        options: [
          'القرآن: مفعول به منصوب، طاعةً: مفعول لأجله منصوب يبيّن سبب الفعل',
          'القرآن: فاعل مؤخر، طاعةً: مفعول مطلق منصوب للتوكيد',
          'القرآن: تمييز منصوب، طاعةً: حال مفردة منصوبة بالفتحة',
          'القرآن: مفعول فيه ظرف مكان، طاعةً: صفة مجرورة'
        ],
        correctIndex: 0,
        points: 1100,
        timeLimit: 20
      };
    }

    if (mainSubject.includes('رياضيات') || mainSubject.includes('رياض') || mainSubject.includes('الأرقام')) {
      return {
        text: `يريد الأستاذ يوسف حساب مساحة فناء المدرسة المخصص للراحة بمراكش على شكل مستطيل طوله 25 متراً وعرضه 12 متراً. فما هي مساحته بدقة؟`,
        options: [
          '300 متر مربع (بحساب الطول × العرض)',
          '150 متر مربع (بحساب الطول + العرض ضرب 2)',
          '74 متر مربع (محيط المستطيل الشامل)',
          '37 متر مربع (نصف المساحة الكلية)'
        ],
        correctIndex: 0,
        points: 1200,
        timeLimit: 25
      };
    }

    if (mainSubject.includes('علمي') || mainSubject.includes('ابن الهيثم') || mainSubject.includes('النشاط')) {
      return {
        text: `ما هو غاز الغلاف الجوي الرئيسي الذي يمثل النسبة الأكبر (78%) ويدعم توازن الهواء في درس التغيرات والبيئة؟`,
        options: [
          'غاز النيتروجين (الآزوت)',
          'غاز الأوكسجين الوفير',
          'غاز ثنائي أوكسيد الكربون',
          'غاز الأوزون أو الميثان'
        ],
        correctIndex: 0,
        points: 1000,
        timeLimit: 20
      };
    }

    if (mainSubject.includes('اجتماعيات') || mainSubject.includes('تاريخ') || mainSubject.includes('جغرافيا')) {
      return {
        text: `من بني الصومعة التاريخية للكتبية الشهيرة في مراكش وصومعة حسان بالرباط؟`,
        options: [
          'دولة الموحدين العريقة',
          'دولة الأدارسة الأولى',
          'دولة المرابطين مؤسسي المدينة',
          'الدولة الميرينية المتميزة بالمعمار'
        ],
        correctIndex: 0,
        points: 1200,
        timeLimit: 20
      };
    }

    return {
      text: `قيمة بيداغوجية وتربوية تفاعلية للدرس الراهن: ما هي القاعدة المثمرة للعمل الجماعي بالقسم؟`,
      options: [
        'التعاون الفعّال، تدوين المخرجات، ومساعدة الرفيق بروح طيبة',
        'الانعزال واستعجال التخمين العشوائي دائماً',
        'تركيز كامل المسؤولية التعليمية على المدرس فقط',
        'التنافس السلبي للفوز دون تفاهم مع الرفاق'
      ],
      correctIndex: 0,
      points: 1000,
      timeLimit: 15
    };
  };

  // Launch Gemini specific subject question
  const handleLaunchSubjectStation = async (subjectName: string) => {
    if (!currentRoom) return;
    if (currentRoom.state === 'question_active' || currentRoom.state === 'question_countdown') {
      alert('هناك تحدي قائم الآن بالفعل! الرجاء كشف الجواب والانتقال للترتيب أولاً.');
      return;
    }

    setGeneratingForSubject(subjectName);
    
    let rawQ: any = null;
    let isOfflineMode = false;
    const currentLevel = currentRoom.activeQuiz?.level || 'المستوى السادس';

    try {
      const response = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: currentLevel,
          subject: subjectName,
          topic: `سؤال تحدي سريع وشيق يناسب جزيرة الكنز للمستوى الدراسي ${currentLevel}`,
          instructions: `توليد سؤال واحد فقط متكامل بمجزوءات المنهاج المغربي. التزم بقاعدة الفرائض في التربية الاسلامية أو امتناع التوكيد والاستثناء في عربية السادس.`
        })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          rawQ = data.questions[0];
        } else {
          throw new Error(data.error || 'استجابة محتوى غير صالحة من المعلم الذكي.');
        }
      } else {
        throw new Error('لم يتمكن نظام الصف من الاتصال بالخادم بشكل مباشر أو مغلف.');
      }
    } catch (err: any) {
      console.warn("Express AI generator offline or failed on current domain. Triggering local Moroccan pedagogical generator...", err);
      rawQ = getLocalPedagogicalQuestion(subjectName, currentLevel);
      isOfflineMode = true;
    }

    try {
      if (!rawQ) {
        throw new Error('عذراً، تعذر صياغة السؤال التعليمي للمحطة.');
      }

      const newQuestionId = `q-station-gen-${Date.now()}`;
      
      const newQuestion: Question = {
        id: newQuestionId,
        subject: subjectName,
        level: currentLevel,
        subComponent: 'عام',
        text: rawQ.text,
        options: Array.isArray(rawQ.options) && rawQ.options.length === 4 
          ? rawQ.options 
          : ['الخيار الف', 'الخيار باء', 'الخيار جيم', 'الخيار دال'],
        correctIndex: typeof rawQ.correctIndex === 'number' && rawQ.correctIndex >= 0 && rawQ.correctIndex < 4 
          ? rawQ.correctIndex 
          : 0,
        points: rawQ.points || 1000,
        timeLimit: rawQ.timeLimit || 25
      };

      // Inject or update room's quiz set
      let updatedQuiz = currentRoom.activeQuiz;
      let targetIndex = 0;

      if (!updatedQuiz) {
        updatedQuiz = {
          id: `quiz-gen-${Date.now()}`,
          title: `تحدي مغامرة جزيرة الكنز`,
          description: `قلاع المعرفة والعلوم`,
          level: currentLevel,
          subject: subjectName,
          questions: [newQuestion]
        };
        targetIndex = 0;
      } else {
        const revisedQuestions = [...(updatedQuiz.questions || []), newQuestion];
        updatedQuiz = {
          ...updatedQuiz,
          questions: revisedQuestions
        };
        targetIndex = revisedQuestions.length - 1;
      }

      // Reset players round statuses
      const updatedPlayers = { ...currentRoom.players };
      for (const pid in updatedPlayers) {
        updatedPlayers[pid] = {
          ...updatedPlayers[pid],
          answeredThisRound: false,
          answerIndex: null,
          writtenAnswer: '',
          isCorrect: false,
          pointsGained: 0
        };
      }

      // Update Room and deploy live
      await updateRoom(currentRoom.pin, {
        activeQuiz: updatedQuiz,
        currentQuestionIndex: targetIndex,
        currentQuestionId: newQuestionId,
        state: 'question_countdown',
        secondsRemaining: 3,
        revealAnswer: false,
        activeSubject: subjectName,
        players: updatedPlayers
      });

    } catch (err: any) {
      console.error(err);
      alert(`عذراً، فشلت صياغة محطة التحدي الذهبية: ${err?.message || 'الرجاء التحقق من المدخلات.'}`);
    } finally {
      setGeneratingForSubject(null);
    }
  };

  // Toggle risk point multiplier active or inactive
  const handleToggleRiskMultiplier = async () => {
    if (!currentRoom) return;
    const targetState = !currentRoom.multiplierActive;
    await updateRoom(currentRoom.pin, {
      multiplierActive: targetState
    });
  };

  // State calculations
  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  const totalPlayers = currentRoom ? Object.keys(currentRoom.players).length : 0;
  const playersList = currentRoom ? Object.values(currentRoom.players) : [];
  const answeredCount = currentRoom ? playersList.filter(p => p.answeredThisRound).length : 0;

  // Gatekeeping Password Check
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-slate-50" dir="rtl">
        <div className="bg-white border-2 border-indigo-50 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 text-center max-w-sm w-full transition-all">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-indigo-50 p-4 rounded-full border border-indigo-100 text-indigo-600 relative">
              <Lock className="w-8 h-8 animate-pulse" />
              <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></div>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 leading-snug">بوابة الأستاذ الموصدة آمنياً 🔐</h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                مغلق لأجل الحماية الصفية البيداغوجية. يرجى إثبات هويتك كمعلم/مُشرف للولوج والتحكم.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                placeholder="أدخل الرمز PIN المخصص للمدرس"
                value={passcode}
                onChange={(e) => {
                  setPasscodeError(null);
                  setPasscode(e.target.value);
                }}
                className="w-full text-center tracking-[0.4em] font-mono font-black text-xl bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:ring focus:ring-indigo-150 outline-none p-3 rounded-2xl transition-all"
                autoFocus
              />
            </div>

            {passcodeError && (
              <p className="text-[11px] text-rose-600 font-bold flex items-center justify-center gap-1.5 leading-relaxed bg-rose-50/50 p-2 rounded-xl">
                <ShieldAlert className="w-4 h-4 text-rose-550 shrink-0" />
                <span>{passcodeError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={!passcode}
              className={`w-full font-black text-xs py-3.5 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 ${
                passcode 
                  ? 'bg-gradient-to-r from-indigo-700 to-indigo-650 text-white hover:shadow-lg hover:from-indigo-600' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <Unlock className="w-4 h-4" />
              <span>تأكيد الهوية ودخول اللوحة 🚀</span>
            </button>
          </form>

          <div className="border-t border-slate-100 pt-3 flex flex-col items-center gap-2">
            <p className="text-[10px] text-slate-400 font-semibold text-center leading-relaxed">
              💡 الرمز التجريبي لتأكيد الهوية للتقييم: <span className="font-mono text-indigo-600 underline font-black text-[13px]">2026</span>
            </p>
            <button
              onClick={onBackToMain}
              className="text-[10px] text-slate-600 hover:text-slate-850 underline font-black"
            >
              الرجوع لبوابة الاستقبال
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active controlled Room Interface
  if (currentRoom) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-8 text-right space-y-6" dir="rtl">
        
        {/* Header Controls bar */}
        <header className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-950">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/25 p-3 rounded-2xl border border-indigo-500/30 text-emerald-405 text-emerald-400 animate-pulse">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black">قائد مغامرة جزيرة الكنز 🧭👑</h1>
                <span className="text-[10px] bg-indigo-700 text-indigo-150 px-2.5 py-0.5 rounded-full font-black">
                  {currentRoom.state === 'waiting' ? 'مرسى الانطلاق' : 'تحدي القلاع'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                المستوى المستهدف: <span className="text-teal-300 font-bold">{currentRoom.activeQuiz?.level || 'المستوى السادس'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Badge */}
            <div className="bg-emerald-950/45 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
              <span>تزامن Firebase المباشر 🟢</span>
            </div>

            {/* Terminate session */}
            <button
              onClick={handleTerminateSession}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <LogOut className="w-4 h-4" />
              <span>إنهاء الحصة 🛑</span>
            </button>
          </div>
        </header>

        {/* Dynamic monitoring content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 4-COLS COLUMN: Player live telemetry & Manual feedback */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Connected players */}
            <div className="bg-white rounded-3xl p-5 shadow-md border border-slate-100 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h2 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-650" />
                  <span>طاقم المجموعات المتصلة ({totalPlayers})</span>
                </h2>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-black">غرفة التقرير</span>
              </div>

              {totalPlayers === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 flex flex-col justify-center items-center">
                  <span className="text-4xl animate-bounce">⛵</span>
                  <p className="text-xs font-black text-slate-500 font-black">بانتظار التحاق سفن المجموعات...</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold max-w-xs text-center">
                    اطلب من طلابك فتح البوابة ووضع اسم الفريق ورمز الدخول الموضح في شاشة البروجيكتور التفاعلية.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[280px] pr-1">
                  {playersList.map((p) => (
                    <div key={p.id} className="bg-slate-50 border border-slate-150/70 p-3 rounded-2xl flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl shrink-0">{p.avatar}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{p.name}</p>
                          <p className="text-[9px] text-amber-600 font-extrabold flex items-center gap-0.5 mt-0.5">
                            <span>{p.score} ذهبية</span>
                            {p.streak && p.streak > 0 ? (
                              <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-black shrink-0 flex items-center gap-0.5">
                                <Flame className="w-2 h-2 text-red-500" />
                                {p.streak} صائب
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {/* Score correction options */}
                      <div className="flex items-center gap-1shrink-0">
                        <button
                          onClick={() => handleManualPointsAdjust(p.id, 200)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="منح 200 ذهبية لمجهود تشجيعي"
                        >
                          <PlusCircle className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => handleManualPointsAdjust(p.id, -200)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="خصم 200 ذهبية"
                        >
                          <MinusCircle className="w-4.5 h-4.5" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MAGIC CARDS MONITOR TABLE (Live telemetry constraint) */}
            <div className="bg-white rounded-3xl p-5 shadow-md border border-slate-100 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>لوحة الإحصائيات الفورية لبطاقات الدعم</span>
                </h3>
                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold animate-pulse">مباشر</span>
              </div>

              {totalPlayers === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-6">لا توجد مجموعات مرصودة لمراقبة أدواتها.</p>
              ) : (
                <div className="overflow-x-auto pr-1">
                  <table className="w-full text-right text-[11px] font-bold">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] text-slate-450 pb-2">
                        <th className="pb-1.5 align-middle">المجموعة</th>
                        <th className="pb-1.5 text-center">الفيلسوف 💡</th>
                        <th className="pb-1.5 text-center">الدرع 🛡️</th>
                        <th className="pb-1.5 text-center">الزلزال 🌋</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {playersList.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 truncate max-w-[80px]" title={p.name}>
                            <span className="mr-1">{p.avatar}</span>
                            <span className="text-slate-800 font-extrabold">{p.name}</span>
                          </td>
                          <td className="py-2 text-center">
                            {p.usedPhilosopher ? (
                              <span className="text-[8.5px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-extrabold">نَفِدت</span>
                            ) : (
                              <span className="text-[8.5px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-extrabold">مكتملة</span>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            {p.usedShield ? (
                              <span className="text-[8.5px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-extrabold">نَفِدت</span>
                            ) : (
                              <span className="text-[8.5px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-extrabold">مكتملة</span>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            {p.usedTimeQuake ? (
                              <span className="text-[8.5px] bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded font-extrabold">نَفِدت</span>
                            ) : (
                              <span className="text-[8.5px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-extrabold">مكتملة</span>
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

          {/* RIGHT 8-COLS COLUMN: Adventure board & active controllers */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* 6-SUBJECT ADVENTURE CONTROL PANEL GRID */}
            <div className="bg-slate-950 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-indigo-900/40 space-y-5">
              <div className="flex justify-between items-center border-b border-indigo-905 border-indigo-900 pb-3">
                <div className="flex items-center gap-2">
                  <Anchor className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-amber-200">التحكم الفوري في محطات قلاع الجزيرة 🏆🗺️</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">بوابة التفجير التفاعلي بالذكاء الاصطناعي</span>
              </div>

              <p className="text-[11px] text-slate-350 leading-relaxed font-bold">
                انقر على قلعة المادة لتستشير Gemini AI لتوليد تحدٍ فوري مبهج للقسم. تشتعل القلعة على شاشة العرض الكبرى فورياً لتنافس متعلمي الصف!
              </p>

              {/* 6 Castell Grid buttons */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { name: 'التربية الإسلامية', icon: '🕌', title: 'قلعة الإيمان' },
                  { name: 'اللغة العربية', icon: '📖', title: 'قلعة الضاد' },
                  { name: 'الرياضيات', icon: '📐', title: 'قلعة الخوارزمي' },
                  { name: 'النشاط العلمي', icon: '🔬', title: 'قلعة ابن سينا' },
                  { name: 'الاجتماعيات', icon: '🌍', title: 'قلعة ابن بطوطة' },
                  { name: 'اللغة الفرنسية', icon: '🇫🇷', title: 'قلعة Molière' }
                ].map((station) => {
                  const isCompleted = currentRoom.completedSubjects?.[station.name] || false;
                  const isActive = currentRoom.activeSubject === station.name;
                  const isGenerating = generatingForSubject === station.name;

                  return (
                    <button
                      key={station.name}
                      onClick={() => handleLaunchSubjectStation(station.name)}
                      disabled={isGenerating || !!generatingForSubject}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-right flex flex-col justify-between h-28 relative overflow-hidden group hover:scale-[1.01] ${
                        isActive 
                          ? 'bg-gradient-to-br from-amber-500 to-red-650 border-yellow-300 ring-4 ring-yellow-405' 
                          : isCompleted
                            ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-250 opacity-90'
                            : 'bg-slate-900 border-indigo-900/50 text-indigo-305 hover:border-amber-400/40 hover:bg-slate-850'
                      }`}
                    >
                      {/* Generating spinner overlay */}
                      {isGenerating && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center z-10 p-1">
                          <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                          <span className="text-[8px] mt-1 font-black text-emerald-300">سؤال AI قادم...</span>
                        </div>
                      )}

                      <div className="flex justify-between items-start w-full">
                        <span className="text-3xl filter drop-shadow">{station.icon}</span>
                        {isCompleted && (
                          <span className="bg-emerald-400 text-slate-950 p-0.5 rounded-full text-[8px] font-black border border-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                        {isActive && !isCompleted && (
                          <span className="bg-red-500 text-white px-2 py-0.5 text-[8px] font-black rounded-full animate-bounce">
                            نشط! 🔥
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5">
                        <p className={`text-xs font-black leading-none ${isActive ? 'text-white' : 'text-slate-100 group-hover:text-amber-300'}`}>
                          {station.title}
                        </p>
                        <p className="text-[9px] text-slate-400 font-extrabold mt-1">({station.name})</p>
                      </div>

                    </button>
                  );
                })}
              </div>

              {/* ACTIVE DOUBLE POINTS RISK TOGGLE BUTTON */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-indigo-900 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-right space-y-1">
                  <span className="text-xs font-black text-yellow-301 text-yellow-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                    تفعيل مضاعفة نقاط المخاطرة (Double Points)!
                  </span>
                  <p className="text-[10px] text-slate-405 leading-relaxed font-bold">
                    تمكين فرصة المخاطرة قبل تفجير السؤال. المجموعات المصيبة تنال 2x نقاط (+2000)، والمخطئة تخسر 300 نقطة (إلا المعززة ببطاقة درع الأطلس).
                  </p>
                </div>

                <button
                  onClick={handleToggleRiskMultiplier}
                  className={`px-5 py-3 rounded-xl font-black text-xs cursor-pointer tracking-wider transition-all shadow-md shrink-0 flex items-center gap-1.5 ${
                    currentRoom.multiplierActive 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400' 
                      : 'bg-slate-800 text-slate-350 hover:bg-slate-755 hover:text-white border border-slate-700'
                  }`}
                >
                  {currentRoom.multiplierActive ? (
                    <>
                      <Flame className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                      <span>المضاعفة نشطة 🔥 [إيقاف]</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-slate-400" />
                      <span>تنشيط المضاعفة (2x)</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* LIVE WORKSPACE ACTIVE STATE MANAGEMENT (Question display boards) */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/70 space-y-5">
              
              {/* LOBBY WAITING STAGE */}
              {currentRoom.state === 'waiting' && (
                <div className="py-12 text-center space-y-5 flex-grow flex flex-col justify-center">
                  <span className="text-4xl">🏝️</span>
                  <h3 className="text-lg font-black text-slate-805">شيدنا مرفإ انطلاق المستكشفين بالرقم:</h3>
                  <div className="bg-indigo-50 border border-indigo-150 p-5 rounded-2xl max-w-xs mx-auto text-center space-y-1 card-blur">
                    <p className="text-5xl font-mono tracking-widest font-extrabold text-indigo-700 select-all">{currentRoom.pin}</p>
                    <p className="text-[9px] text-indigo-400 font-semibold">بانتظار جلوس المتعلمين للمغامرة</p>
                  </div>

                  <div className="max-w-xs mx-auto">
                    <button
                      onClick={handleStartQuiz}
                      disabled={totalPlayers === 0}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs text-white transition-all shadow ${
                        totalPlayers > 0
                          ? 'bg-indigo-650 hover:bg-indigo-600 cursor-pointer'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {totalPlayers > 0 ? 'بدء الإقلاع وسبر الأغوار 🧭' : 'بانتظار انضمام تلميذ واحد على الأقل...'}
                    </button>
                  </div>
                </div>
              )}

              {/* PRESENTING ACTIVE QUESTION STALWART */}
              {(currentRoom.state === 'question_countdown' || currentRoom.state === 'question_active' || currentRoom.state === 'question_result') && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <span className="text-xs font-black bg-indigo-55 text-indigo-600 px-3 py-1 rounded-xl">
                      مادة: {currentRoom.activeSubject} • سؤال قيد الحساب
                    </span>

                    {/* Timer tracking */}
                    <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-xl border">
                      <Clock className="w-4 h-4 text-indigo-650 animate-pulse" />
                      <span className="font-mono text-xs font-black">{currentRoom.secondsRemaining} ثانٍ</span>
                    </div>
                  </div>

                  {currentRoom.state === 'question_countdown' && (
                    <div className="py-10 text-center space-y-3">
                      <p className="text-indigo-600 font-black animate-pulse text-sm">استعدوا! سؤال Gemini المولد ينطلق بعد قليل...</p>
                      <p className="text-5xl font-black font-mono text-slate-900">{currentRoom.secondsRemaining}</p>
                    </div>
                  )}

                  {activeQuestion && currentRoom.state !== 'question_countdown' && (
                    <div className="space-y-4 text-right">
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                        <p className="text-xs text-slate-400 font-semibold uppercase">{activeQuestion.level} - {activeQuestion.subject}</p>
                        <h4 className="text-base font-black text-slate-805 leading-relaxed mt-1">{activeQuestion.text}</h4>
                      </div>

                      {/* Options preview for MCQ */}
                      {activeQuestion.type === 'mcq' && (
                        <div className="grid grid-cols-2 gap-2">
                          {activeQuestion.options.map((opt, oi) => (
                            <div 
                              key={oi} 
                              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                                currentRoom.state === 'question_result' && oi === activeQuestion.correctIndex
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-extrabold shadow-sm'
                                  : 'bg-white border-slate-150 text-slate-600'
                              }`}
                            >
                              <span>{opt}</span>
                              {currentRoom.state === 'question_result' && oi === activeQuestion.correctIndex && (
                                <span className="text-emerald-500"><Check className="w-4 h-4 text-emerald-600" /></span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBMISSIONS REPORT TALLY */}
                  <div className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-xs text-slate-500 font-bold">
                    <span>الاستجابات الراهنة في هذه الجولة:</span>
                    <span className="text-indigo-600 font-black">{answeredCount} من أصل {totalPlayers} مجموعات صحية</span>
                  </div>

                </div>
              )}

              {/* MID GAME/SUBJECT LEADERBOARD OR FINISHED */}
              {(currentRoom.state === 'leaderboard' || currentRoom.state === 'finished') && (
                <div className="text-center py-6 space-y-4">
                  <span className="text-4xl">🏆🎖️</span>
                  <h3 className="text-base font-black text-slate-800">
                    {currentRoom.state === 'finished' ? 'قفل معارك الكنز والنتائج الختامية' : 'الترتيب اللحظي لأقوى حلفاء الصف'}
                  </h3>

                  <div className="max-w-md mx-auto space-y-2">
                    {playersList
                      .sort((a,b) => b.score - a.score)
                      .slice(0, 3)
                      .map((p, idx) => (
                        <div key={p.id} className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="font-extrabold text-slate-400">#{idx + 1} {p.avatar} {p.name}</span>
                          <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{p.score} ذهبة</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* BOTTOM WORKSPACE CONTROLLER ACTIONS */}
              <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 items-center justify-between">
                
                {currentRoom.state === 'question_active' && (
                  <button
                    onClick={handleSkipTimer}
                    className="bg-indigo-650 hover:bg-indigo-600 text-white font-black text-xs px-4 py-3 rounded-xl shadow cursor-pointer transition-all"
                  >
                    إنهاء الوقت وإشهار الجواب الصحيح 👁️
                  </button>
                )}

                {currentRoom.state === 'question_result' && (
                  <button
                    onClick={handleShowLeaderboard}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1"
                  >
                    <span>كشف الترتيب في شاشة البروجيكتور 🏆</span>
                  </button>
                )}

                {currentRoom.state === 'leaderboard' && (
                  <button
                    onClick={handleFinishAdventureGame}
                    className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-5 py-3 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <span>التتويج النهائي بالأوسمة الذهبية 🔱</span>
                  </button>
                )}

                {/* AI Generator dialog */}
                <button
                  onClick={() => setShowAiDrawer(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-black text-xs px-4 py-3 rounded-xl cursor-pointer transition-all"
                >
                  صانع الأسئلة المتكامل 🧠🪄
                </button>

              </div>

            </div>

          </div>

        </div>

        {/* COMPREHENSIVE AI QUIZ GENERATION POPUP DRAWER */}
        {showAiDrawer && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-1.5 max-w-xl w-full shadow-2xl overflow-hidden text-right" dir="rtl">
              <div className="p-4 bg-indigo-900 text-white flex justify-between items-center rounded-t-2xl">
                <span className="font-extrabold text-xs flex items-center gap-1.5">
                  <Brain className="w-5 h-5 text-emerald-400 animate-pulse" />
                  مستشار المعلم لتوليد التحديات بالـ AI
                </span>
                <button 
                  onClick={() => setShowAiDrawer(false)}
                  className="text-xs bg-indigo-850 hover:bg-indigo-800 text-white px-3.5 py-1.5 rounded-xl font-black"
                >
                  إغلاق ❌
                </button>
              </div>
              <div className="p-4 max-h-[75vh] overflow-y-auto">
                <AIGenerator onQuizAdded={handleQuizAddedByAi} />
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Lobby Setup / Selector
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 text-right space-y-6 animate-fade-in" dir="rtl">
      
      {/* Upper info page */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-805 flex items-center gap-3">
            <span className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-650">💻</span>
            <span>لوحة الأستاذ والمشرف التعليمي</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1.5">
            اختر أحد التحديات البحيانية لتأسيس الغرفة، ثم فجِّر مساقات جزيرة الكنز الست بـ Gemini AI بالتناوب.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-rose-50 hover:bg-rose-105 border border-rose-150 text-rose-700 font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Lock className="w-4 h-4 text-rose-650" />
          <span>قفل اللوحة 🔐</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left column list select */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-5 md:p-6 shadow-xl border border-indigo-50/70 space-y-4">
            <h2 className="text-xs font-black text-indigo-900 border-b pb-2">1. حدد مستوى التحدي الابتدائي المغربي:</h2>
            
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => setSelectedQuizId(quiz.id)}
                  className={`w-full p-4 rounded-2xl text-right border-2 grid grid-cols-1 md:grid-cols-4 gap-2 items-center transition-all cursor-pointer ${
                    selectedQuizId === quiz.id
                      ? 'bg-indigo-50/45 border-indigo-500 shadow-sm'
                      : 'bg-white border-slate-150 hover:bg-slate-50'
                  }`}
                >
                  <div className="md:col-span-3 space-y-1">
                    <p className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5 leading-snug">
                      <span>{quiz.title}</span>
                      {quiz.id.startsWith('quiz-gen-') && (
                        <span className="bg-teal-500/10 text-teal-700 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Brain className="w-2.5 h-2.5 animate-pulse" />
                          <span>توليد ذكي</span>
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold truncate max-w-md">{quiz.description}</p>
                  </div>
                  <div className="md:col-span-1 text-left">
                    <span className="text-[9px] bg-indigo-100 text-indigo-750 px-2 py-1 rounded-full font-black">
                      {quiz.level}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => setShowAiDrawer(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-md transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse shrink-0" />
                <span>تحضير فوري للمواضيع بالـ AI 🧠</span>
              </button>
              
              <button
                onClick={onBackToMain}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs px-4 py-3 rounded-2xl transition-all"
              >
                الرجوع للبوابة الرئيسية
              </button>
            </div>
          </div>
        </div>

        {/* Right column confirmation launcher */}
        <div className="md:col-span-1">
          <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-slate-850 space-y-4">
            <h3 className="text-xs font-black text-teal-200 uppercase tracking-wide">2. إطلاق غرفة التنافس 🚀</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
              سيقوم نظام الغرف المتزامن بإنشاء بث فوري لقسمك ليربط الطلاب والـ Projector سوية، لتنطلق المجموعات وتخوض سباق كنز القلاع المغربي.
            </p>

            <button
              onClick={handleLaunchRoom}
              disabled={loading}
              className={`w-full py-4 rounded-2xl text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${
                loading
                  ? 'bg-slate-800 cursor-wait text-slate-400'
                  : 'bg-gradient-to-r from-teal-400 to-emerald-400 border-teal-350 hover:from-teal-300 hover:shadow-emerald-900/10 cursor-pointer'
              }`}
            >
              {loading ? (
                <span>جاري إقلاع الغرفة...⏰</span>
              ) : (
                <>
                  <Play className="w-4 h-4 text-slate-900" />
                  <span>توليد وتفعيل الغرفة الكبرى 🌐</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI DRAWER OVERLAY POPUP */}
      {showAiDrawer && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-1 max-w-lg w-full shadow-2xl overflow-hidden text-right" dir="rtl">
            <div className="p-4 bg-indigo-900 text-white flex justify-between items-center rounded-t-2xl">
              <span className="font-extrabold text-xs">مستشار المعلم التعليمي الذكي 🪄</span>
              <button 
                onClick={() => setShowAiDrawer(false)}
                className="text-xs bg-indigo-850 hover:bg-indigo-800 text-white px-3 py-1.5 rounded-lg font-black"
              >
                إغلاق ❌
              </button>
            </div>
            <div className="p-4 p-5 text-slate-900">
              <AIGenerator onQuizAdded={handleQuizAddedByAi} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
