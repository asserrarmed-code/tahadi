import React, { useState, useEffect } from 'react';
import { 
  Laptop, Play, Plus, Trash, Clock, Users, Check, RefreshCw, 
  Settings, Award, Sparkles, LogOut, ArrowRight, ShieldAlert,
  Lock, Unlock, HelpCircle, Trophy, Volume2, PlusCircle, MinusCircle, Brain
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

  // Password Lock
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('school_teacher_auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Room lifecycle
  const [selectedQuizId, setSelectedQuizId] = useState(quizzes[0].id);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);

  // Listen to active room if exists
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

  // Handle countdown tick if running
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        updateRoom(currentRoom.pin, {
          secondsRemaining: currentRoom.secondsRemaining - 1
        });
      }, 1000);
    } else if (currentRoom && currentRoom.state === 'question_active' && currentRoom.secondsRemaining === 0) {
      // Auto transition to result on timeout
      updateRoom(currentRoom.pin, {
        state: 'question_result',
        revealAnswer: true
      });
    }
    
    // Countdown intro
    if (currentRoom && currentRoom.state === 'question_countdown' && currentRoom.secondsRemaining > 0) {
      timer = setTimeout(() => {
        const nextTime = currentRoom.secondsRemaining - 1;
        if (nextTime === 0) {
          // Get the active question
          const activeQuiz = currentRoom.activeQuiz;
          const q = activeQuiz?.questions[currentRoom.currentQuestionIndex];
          updateRoom(currentRoom.pin, {
            state: 'question_active',
            secondsRemaining: q?.timeLimit || 20,
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

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '2026') {
      setIsAuthenticated(true);
      localStorage.setItem('school_teacher_auth', 'true');
      setPasscodeError(null);
    } else {
      setPasscodeError('❌ رمز الأستاذ غير صحيح! يرجى إدخال رمز معلم فطن.');
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

    // Generate random 4 digit PIN
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const room = await createRoom(randomPin, selectedQuiz);
      setCurrentRoom(room);
      localStorage.setItem('school_teacher_active_room_pin', randomPin);
    } catch (err) {
      alert('فشل في حجز غرفة المعركة. يرجى المحاولة من جديد.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!currentRoom) return;
    const activeQuiz = currentRoom.activeQuiz;
    if (!activeQuiz || activeQuiz.questions.length === 0) return;

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
      // Clear previous student answer flags for the next round
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
        state: 'finished'
      });
    }
  };

  const handleShowLeaderboard = async () => {
    if (!currentRoom) return;
    await updateRoom(currentRoom.pin, {
      state: 'leaderboard'
    });
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
    if (confirm('هل أنت متأكد من رغبتك في إغلاق هذه الغرفة وطرد جميع المتعلمين منها؟ 🛑')) {
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
    
    // Save custom quizzes to local storage
    const customOnly = updated.filter(q => q.id.startsWith('quiz-gen-'));
    localStorage.setItem('school_custom_quizzes', JSON.stringify(customOnly));
    
    setSelectedQuizId(newQuiz.id);
    setShowAiDrawer(false);
  };

  // Get active question
  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  // Active question details
  const totalPlayers = currentRoom ? Object.keys(currentRoom.players).length : 0;
  const answeredCount = currentRoom ? Object.values(currentRoom.players).filter(p => p.answeredThisRound).length : 0;

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
      <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-8 text-right space-y-6" dir="rtl">
        
        {/* Header Controls bar */}
        <header className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-950">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/25 p-3 rounded-2xl border border-indigo-500/30 text-emerald-400 animate-pulse">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black">غرفة الأستاذ المتحكم المباشرة 👑</h1>
                <span className="text-[10px] bg-indigo-700 text-indigo-150 px-2.5 py-0.5 rounded-full font-black">
                  {currentRoom.state === 'waiting' ? 'لوبي الانتظار' : 'مسابقة فاعلة'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                التحضير: <span className="text-teal-300 font-bold">{currentRoom.activeQuiz?.title}</span> ({currentRoom.activeQuiz?.level})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Status Badge */}
            <div className="bg-emerald-950/45 border border-emerald-555/40 text-emerald-400 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
              <span>قاعدة Firebase نشطة 🟢</span>
            </div>

            {/* Close Room button */}
            <button
              onClick={handleTerminateSession}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              title="إغلاق وقطع اتصالات الغرفة"
            >
              <LogOut className="w-4 h-4" />
              <span>إغلاق الغرفة 🛑</span>
            </button>
          </div>
        </header>

        {/* Dynamic monitoring content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left Column: Player dashboard */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 flex flex-col space-y-4 lg:col-span-1">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>المجموعات والأبطال المتصلين ({totalPlayers})</span>
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black">استجابة حية</span>
            </div>

            {totalPlayers === 0 ? (
              <div className="py-12 text-center text-slate-405 space-y-2 flex-grow flex flex-col justify-center items-center">
                <span className="text-4xl animate-bounce">🎒</span>
                <p className="text-xs font-black text-slate-500">في انتظار التحاق المتعلمين أولاً...</p>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold max-w-xs block mx-auto">
                  يرجى توجيه التلاميذ للدخول باستعمال الـ PIN الموضح في شاشات العرض للتسجيل.
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[450px] flex-grow pr-1">
                {Object.values(currentRoom.players).map((p: any) => (
                  <div key={p.id} className="bg-slate-50 border border-slate-150 p-3 rounded-2xl flex items-center justify-between gap-2.5 hover:shadow-sm transition-all">
                    
                    {/* Basic info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0">{p.avatar}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-extrabold shrink-0">
                            {p.score} نقطة🎖️
                          </span>
                          {p.streak > 0 && (
                            <span className="text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded-md font-black shrink-0">
                              🔥 سلسة {p.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Panel: real-time status & manual gradings */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Round indicator */}
                      {currentRoom.state === 'question_active' && (
                        <div className="flex items-center gap-1.5">
                          {p.answeredThisRound ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>أرسل الإجابة</span>
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-lg font-black animate-pulse">
                              ⏳ يفكّر الآن
                            </span>
                          )}
                        </div>
                      )}

                      {/* Display written answer if written test */}
                      {currentRoom.state === 'question_active' && activeQuestion?.type === 'written' && p.writtenAnswer && (
                        <p className="text-[10px] font-bold bg-slate-100 text-indigo-950 py-1 px-2 rounded-lg max-w-[120px] truncate">
                          ✏️: "{p.writtenAnswer}"
                        </p>
                      )}

                      {/* Manual Point Award Button panel (For general and spoken scoring) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleManualPointsAdjust(p.id, 200)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                          title="منح زائد 200 نقطة بونص"
                        >
                          <PlusCircle className="w-5 h-5" />
                        </button>
                        <span className="text-[9px] text-slate-400 font-bold">بيداغوجي</span>
                        <button
                          onClick={() => handleManualPointsAdjust(p.id, -200)}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                          title="خصم 200 نقطة"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Oral grading fast buttons if active question is Spoken */}
                      {currentRoom.state === 'question_active' && activeQuestion?.type === 'oral' && (
                        <div className="flex gap-1 mt-0.5">
                          <button
                            onClick={() => handleManualPointsAdjust(p.id, activeQuestion.points)}
                            className="bg-teal-500 hover:bg-teal-600 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-sm transition-all"
                          >
                            تقييم شفوي ممتاز 👄
                          </button>
                        </div>
                      )}

                      {/* Powerups indicator labels */}
                      <div className="flex gap-1">
                        {p.usedFiftyFifty && <span className="text-[8px] bg-amber-50 text-amber-600 font-bold px-1 rounded">50/50 🃏</span>}
                        {p.usedExtraTime && <span className="text-[8px] bg-blue-50 text-blue-600 font-bold px-1 rounded">وقت+ ⏰</span>}
                        {p.usedHint && <span className="text-[8px] bg-sky-50 text-sky-600 font-bold px-1 rounded">تلميح💡</span>}
                      </div>

                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (2-span: active workspace) */}
          <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
            
            {/* Live Room Info Board */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 space-y-6 flex-grow flex flex-col justify-between">
              
              {/* LOBBY / SETUP STATUS CONTAINER */}
              {currentRoom.state === 'waiting' && (
                <div className="py-12 text-center space-y-6 flex-grow flex flex-col justify-center">
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-450 font-black tracking-widest uppercase">شاشة التوجية الكبرى</p>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-805">انشر رمز الغرفة للطلاب! 📣</h3>
                  </div>

                  {/* giant Pin board */}
                  <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl inline-block mx-auto max-w-sm w-full space-y-2">
                    <p className="text-xs text-indigo-500 font-black">رمز الحصة للاتصال المباشر:</p>
                    <p className="text-5xl md:text-6xl font-extrabold tracking-[0.2em] font-mono text-indigo-750 animate-bounce">{currentRoom.pin}</p>
                    <p className="text-[10px] text-indigo-400 font-bold pt-1">
                      (يقوم التلميذ بنسخ هذا الرمز PIN في هاتفه للولوج)
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-3">
                    <button
                      onClick={handleStartQuiz}
                      disabled={totalPlayers === 0}
                      className={`w-full py-4 rounded-2xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                        totalPlayers > 0
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:shadow-emerald-100 cursor-pointer'
                          : 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-5 h-5 shrink-0" />
                      <span>{totalPlayers > 0 ? 'ابدأ المسابقة فوراً 🎮' : 'في انتظار التحاق لاعب واحد على الأقل...'}</span>
                    </button>
                    {totalPlayers === 0 && (
                      <p className="text-[10px] text-amber-600 font-black animate-pulse text-center">
                        ⚠️ لا يمكن بدء الحصة بدون انضمام أي تلميذ على الأقل.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ACTIVE QUESTION PANEL WRAPPER */}
              {(currentRoom.state === 'question_countdown' || currentRoom.state === 'question_active' || currentRoom.state === 'question_result') && (
                <div className="space-y-6 flex-grow flex flex-col justify-between">
                  {/* Info tracker */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl">
                        سؤال {currentRoom.currentQuestionIndex + 1} من {currentRoom.activeQuiz?.questions.length}
                      </span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-605 px-2 py-1 rounded-lg">
                        النوع: {activeQuestion?.type === 'written' ? 'كتابي ✏️' : activeQuestion?.type === 'oral' ? 'شفهي 🗣️' : 'إختياري 🔲'}
                      </span>
                    </div>

                    {/* Clock stopwatch */}
                    <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3.5 py-1.5 rounded-xl border border-indigo-100">
                      <Clock className="w-4 h-4 text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
                      <span className="font-mono text-sm font-black">{currentRoom.secondsRemaining} ثانٍ</span>
                    </div>
                  </div>

                  {/* Countdown state details */}
                  {currentRoom.state === 'question_countdown' && (
                    <div className="py-12 text-center space-y-4">
                      <p className="text-lg text-indigo-600 font-black animate-pulse">استعدوا! السؤال الموالي سينطلق بعد قليل...</p>
                      <p className="text-5xl font-black font-mono text-indigo-950">{currentRoom.secondsRemaining}</p>
                    </div>
                  )}

                  {/* Active detailed questions */}
                  {activeQuestion && currentRoom.state !== 'question_countdown' && (
                    <div className="space-y-4 text-right">
                      <h4 className="text-base font-black text-slate-900 leading-relaxed bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                        {activeQuestion.text}
                      </h4>

                      {/* Display choices if MCQ */}
                      {activeQuestion.type !== 'written' && activeQuestion.type !== 'oral' && (
                        <div className="grid grid-cols-2 gap-2.5">
                          {activeQuestion.options.map((opt, oi) => (
                            <div 
                              key={oi} 
                              className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between ${
                                currentRoom.state === 'question_result' && oi === activeQuestion.correctIndex
                                  ? 'bg-emerald-50 border-emerald-250 text-emerald-800 ring-2 ring-emerald-150'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span>{opt}</span>
                              {currentRoom.state === 'question_result' && oi === activeQuestion.correctIndex && (
                                <span className="bg-emerald-600 text-white p-0.5 rounded-full"><Check className="w-3 h-3" /></span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Info on Correct indexes if Written */}
                      {activeQuestion.type === 'written' && currentRoom.state === 'question_result' && (
                        <div className="bg-emerald-50 border border-emerald-250 p-3 rounded-2xl">
                          <p className="text-xs font-black text-emerald-850">الجواب الصحيح البيداغوجي المعتمد:</p>
                          <p className="text-sm font-bold text-emerald-700 mt-1">"{activeQuestion.options[activeQuestion.correctIndex || 0]}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Response Tracker footer */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <span className="text-xs font-extrabold text-slate-650">الاستجابة والتقدم:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-indigo-650">{answeredCount}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">من أصل {totalPlayers} تلاميذ</span>
                      {/* progress bar */}
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300"
                          style={{ width: `${totalPlayers > 0 ? (answeredCount / totalPlayers) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* MAIN LEADERBOARD HIGHLIGHTS */}
              {currentRoom.state === 'leaderboard' && (
                <div className="py-6 text-center space-y-5 flex-grow flex flex-col justify-center">
                  <div className="space-y-1">
                    <p className="text-[10px] text-amber-500 font-black tracking-wider flex items-center justify-center gap-1">
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>شعلة التنافس الصفي</span>
                    </p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-850">التصنيف والترتيب المؤقت للمجموعات 🏆</h3>
                  </div>

                  <div className="max-w-md mx-auto w-full space-y-2.5">
                    {Object.values(currentRoom.players)
                      .sort((a: any, b: any) => b.score - a.score)
                      .slice(0, 5)
                      .map((p: any, idx) => (
                        <div key={p.id} className="bg-slate-50 border border-slate-150 rounded-2xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="font-extrabold text-xs text-slate-400 font-mono w-5">#{idx + 1}</span>
                            <span className="text-xl shrink-0">{p.avatar}</span>
                            <span className="font-extrabold text-slate-750 text-xs truncate">{p.name}</span>
                          </div>
                          <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-xl">{p.score} نقطة</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* GAME FINISHED TAB */}
              {currentRoom.state === 'finished' && (
                <div className="py-12 text-center space-y-6 flex-grow flex flex-col justify-center">
                  <div className="space-y-2">
                    <span className="text-4xl">👑🏆🌟</span>
                    <h3 className="text-2xl font-black text-slate-900">انتهت المعركة التعليمية بنجاح باهر!</h3>
                    <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                      تحية تربوية عالية لكل أبطال وبطلات الصف على هذا المجهود والمنافسة الشريفة.
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-200 p-6 rounded-3xl inline-block mx-auto max-w-sm w-full space-y-3">
                    <p className="text-xs font-black text-amber-800">🎖️ بطل القسم وصاحب المرتبة الأولى:</p>
                    {Object.values(currentRoom.players).length > 0 ? (
                      (() => {
                        const top = Object.values(currentRoom.players).sort((a: any, b: any) => b.score - a.score)[0];
                        return (
                          <div className="space-y-2">
                            <span className="text-5xl block">{top.avatar}</span>
                            <p className="font-black text-slate-900 text-lg">{top.name}</p>
                            <p className="text-xs font-black bg-amber-500 text-slate-950 inline-block px-3 py-1 rounded-full">{top.score} نقطة موفقة</p>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-slate-405">لم يشارك أي تلميذ</p>
                    )}
                  </div>
                </div>
              )}

              {/* REMOTE PROCESS CONTROL BUTTONS */}
              <div className="border-t border-slate-100 pt-5 flex flex-wrap gap-3 items-center justify-between">
                
                {/* Skip / Reveal countdown timer */}
                {currentRoom.state === 'question_active' && (
                  <button
                    onClick={handleSkipTimer}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>كشف الإجابة ووقف المؤقت 👁️</span>
                  </button>
                )}

                {/* Show leaderboard button */}
                {currentRoom.state === 'question_result' && (
                  <button
                    onClick={handleShowLeaderboard}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>عرض لوحة الترتيب 🏆</span>
                  </button>
                )}

                {/* Next button (next question countdown or end podiums) */}
                {(currentRoom.state === 'question_result' || currentRoom.state === 'leaderboard') && (
                  <button
                    onClick={handleNextAction}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>التالي (السؤال الموالي) ➡️</span>
                  </button>
                )}

                {/* Open AI generator button */}
                <button
                  onClick={() => setShowAiDrawer(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-750 font-black text-xs px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Brain className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>توليد أسئلة Gemini بالذكاء الاصطناعي 🧠</span>
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* AI DRAWER OVERLAY POPUP */}
        {showAiDrawer && (
          <div className="fixed inset-0 bg-slate-950/70 z-50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-1 max-w-lg w-full shadow-2xl overflow-hidden text-right" dir="rtl">
              <div className="p-4 bg-indigo-900 text-white flex justify-between items-center rounded-t-2xl">
                <span className="font-extrabold text-xs">مستشير المعلم التعليمي الذكي 🪄</span>
                <button 
                  onClick={() => setShowAiDrawer(false)}
                  className="text-xs bg-indigo-850 hover:bg-indigo-800 text-indigo-200 px-3 py-1.5 rounded-lg font-black"
                >
                  إغلاق ❌
                </button>
              </div>
              <div className="p-4">
                <AIGenerator onQuizAdded={handleQuizAddedByAi} />
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Lobby Setup / Create room selector
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 text-right space-y-6" dir="rtl">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-805 flex items-center gap-3">
            <span className="bg-indigo-50 p-2 rounded-2xl text-indigo-600">💻</span>
            <span>بوابة المشرف والأستاذ المفتوحة</span>
          </h1>
          <p className="text-xs text-slate-505 font-semibold mt-1.5">
            اختر أحد التحديات البيداغوجية المتوفرة أسفله، أو انقر على زر توليد الذكاء الاصطناعي لإطلاق حصة جديدة.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 font-extrabold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Lock className="w-4 h-4 text-rose-600" />
          <span>قفل اللوحة 🔐</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left Column: List select or AI create button */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-5 md:p-6 shadow-xl border border-indigo-50/70 space-y-4">
            <h2 className="text-base font-black text-slate-900">1. حدد موضوع المسابقة التنافسية:</h2>
            
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => setSelectedQuizId(quiz.id)}
                  className={`w-full p-4 rounded-2xl text-right border-2 grid grid-cols-1 md:grid-cols-4 gap-2 items-center transition-all cursor-pointer ${
                    selectedQuizId === quiz.id
                      ? 'bg-indigo-50/50 border-indigo-500 shadow-sm'
                      : 'bg-white border-slate-150 hover:bg-slate-50'
                  }`}
                >
                  <div className="md:col-span-3 space-y-1">
                    <p className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5 leading-snug">
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
                      {quiz.level} - {quiz.subject}
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
                <span>تحضير موضوع جديد بالذكاء الاصطناعي 🧠</span>
              </button>
              
              <button
                onClick={onBackToMain}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs px-4 py-3 rounded-2xl transition-all"
              >
                الرجوع للرئيسية
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: confirmation launcher */}
        <div className="md:col-span-1">
          <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-slate-850 space-y-4">
            <h3 className="text-sm font-black text-teal-200 uppercase tracking-wide">2. إطلاق غرفة الحصة 🚀</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
              سيقوم النظام بإنشاء غرفة متصلة بقاعدة معلومات سحابية متزامنة، وتوفير رمز (PIN) مؤمن ليلتحق به التلاميذ من هواتفهم وهواتف المجموعات للتنافس المباشر.
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
                <span>جاري فتح صمام البوابة...⏰</span>
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
              <span className="font-extrabold text-xs">مستشير الأستاد التعليمي الذكي 🪄</span>
              <button 
                onClick={() => setShowAiDrawer(false)}
                className="text-xs bg-indigo-850 hover:bg-indigo-800 text-indigo-200 px-3 py-1.5 rounded-lg font-black"
              >
                إغلاق ❌
              </button>
            </div>
            <div className="p-4">
              <AIGenerator onQuizAdded={handleQuizAddedByAi} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
