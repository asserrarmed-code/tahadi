import React, { useState, useEffect } from 'react';
import { 
  Laptop, Play, Trash, Clock, Users, Check, RefreshCw, 
  Settings, Award, Sparkles, LogOut, Lock, Unlock, HelpCircle, 
  Trophy, PlusCircle, MinusCircle, Brain, Shield, Flame, Anchor, Tv, Zap
} from 'lucide-react';
import { ref, set, update, onValue } from 'firebase/database';
import { db } from '../firebase';
import { generateQuestionsFromAI, savePoolToFirebase } from '../services/gameEngine';

interface Question {
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  type: string;
}

interface Team {
  id: string;
  teamName: string;
  avatar: string;
  score: number;
  streak: number;
}

interface RoomState {
  pin: string;
  status: 'setup' | 'playing' | 'reveal' | 'finished';
  currentQuestionIndex: number;
  questionsPool: Question[];
  currentQuestion: Question | null;
  responses?: Record<string, { teamName: string; selectedAnswer: any; isCorrect: boolean }>;
  teams?: Record<string, Team>;
}

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

  // Connection State
  const [roomPIN, setRoomPIN] = useState<string>(() => {
    return localStorage.getItem('school_teacher_active_room_pin') || '';
  });
  const [roomVal, setRoomVal] = useState<RoomState | null>(null);

  // Form parameters
  const [selectedLevel, setSelectedLevel] = useState('المستوى السادس');
  const [selectedSubject, setSelectedSubject] = useState('اللغة العربية');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(3);
  const [questionType, setQuestionType] = useState('mcq');

  // Question Preparation Pool
  const [poolQuestions, setPoolQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Real-time listener for current room state
  useEffect(() => {
    if (roomPIN) {
      const roomRef = ref(db, `rooms/${roomPIN}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as RoomState;
          setRoomVal(data);
          if (data.questionsPool) {
            setPoolQuestions(data.questionsPool);
          }
        } else {
          setRoomVal(null);
        }
      });
      return () => unsubscribe();
    }
  }, [roomPIN]);

  // Passcode authentication
  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '2026') {
      setIsAuthenticated(true);
      localStorage.setItem('school_teacher_auth', 'true');
      setPasscodeError(null);
    } else {
      setPasscodeError('❌ الرمز السري للمشرف غير صحيح المرجو تجريب "2026"');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('school_teacher_auth');
    localStorage.removeItem('school_teacher_active_room_pin');
    setRoomPIN('');
    setRoomVal(null);
  };

  // Safe Gemini Question Generator complying with Moroccan pedagogic constraints
  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const theme = selectedTopic.trim() || 'عام مفاهيم عامة ومفتوحة';

    try {
      const generated = await generateQuestionsFromAI(
        selectedSubject,
        theme,
        selectedLevel,
        questionCount,
        questionType === 'written' ? 'written' : 'mcq'
      );
      setPoolQuestions(generated);
    } catch (err: any) {
      setGenerationError(err.message || 'فشل في توليد الأسئلة.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch Competition Room Nodes
  const handleLaunchRoom = async () => {
    if (poolQuestions.length === 0) {
      alert("المرجو توليد الأسئلة بيداغوجياً أولاً لمراجعتها قبل بدء الحصة.");
      return;
    }

    // Auto generate 4 digit PIN
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem('school_teacher_active_room_pin', randomPin);
    
    try {
      await savePoolToFirebase(randomPin, poolQuestions);
      setRoomPIN(randomPin);
    } catch (err: any) {
      alert("تعذر حفظ وإعداد الغرفة في قاعدة البيانات الحالية: " + err.message);
    }
  };

  // State Machine Action: Start Competition
  const handleStartCompetition = async () => {
    if (!roomPIN || poolQuestions.length === 0) return;
    const roomRef = ref(db, `rooms/${roomPIN}`);
    
    // Set status playing, set index 0, move first question to currentQuestion, reset responses
    await update(roomRef, {
      status: 'playing',
      currentQuestionIndex: 0,
      currentQuestion: poolQuestions[0],
      responses: null
    });
  };

  // State Machine Action: Reveal Correct Answer
  const handleRevealAnswer = async () => {
    if (!roomPIN) return;
    const statusRef = ref(db, `rooms/${roomPIN}/status`);
    await set(statusRef, 'reveal');
  };

  // State Machine Action: Next Question
  const handleNextQuestion = async () => {
    if (!roomPIN || !roomVal) return;
    const nextIdx = roomVal.currentQuestionIndex + 1;
    
    const roomRef = ref(db, `rooms/${roomPIN}`);
    if (nextIdx < poolQuestions.length) {
      // Clean and push next question details
      await update(roomRef, {
        status: 'playing',
        currentQuestionIndex: nextIdx,
        currentQuestion: poolQuestions[nextIdx],
        responses: null
      });
    } else {
      // End Competition podium
      await update(roomRef, {
        status: 'finished'
      });
    }
  };

  // Scores Grading adjustment handlers (rooms/PIN/teams/teamId/score)
  const handleAdjustScore = async (teamId: string, delta: number) => {
    if (!roomPIN || !roomVal || !roomVal.teams) return;
    const team = roomVal.teams[teamId];
    if (!team) return;

    const targetScore = Math.max(0, (team.score || 0) + delta);
    const scorePath = ref(db, `rooms/${roomPIN}/teams/${teamId}/score`);
    await set(scorePath, targetScore);
  };

  // Terminal Delete Room & Reset State
  const handleTerminateRoom = async () => {
    if (!roomPIN) return;
    if (window.confirm("هل أنت متأكد من رغبتك في قفل ساحة المعترك وحل المجموعات نهائياً؟")) {
      await set(ref(db, `rooms/${roomPIN}`), null);
      localStorage.removeItem('school_teacher_active_room_pin');
      setRoomPIN('');
      setRoomVal(null);
    }
  };

  // Access check
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4" dir="rtl">
        <div className="bg-[#0c1424] border-2 border-[#0038A8]/30 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center max-w-sm w-full transition-all">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-[#10192e] p-4 rounded-full border border-indigo-600/30 text-indigo-400">
              <Lock className="w-8 h-8 animate-pulse text-[#F59E0B]" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">بوابة الأستاذ المؤتمن 🇲🇦🔑</h3>
              <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                رمز السحب مؤمن ديدكتيكياً. يرجى كتابة الرقم السري المعتمد للاستمرار.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4">
            <input
              type="password"
              placeholder="الرمز السري الخاص بك"
              value={passcode}
              onChange={(e) => {
                setPasscodeError(null);
                setPasscode(e.target.value);
              }}
              className="w-full text-center tracking-[0.3em] font-mono font-black text-2xl bg-slate-900 border-2 border-indigo-950 text-white focus:border-[#0038A8] focus:ring-1 focus:ring-blue-700 outline-none p-3.5 rounded-2xl transition-all"
              autoFocus
            />

            {passcodeError && (
              <p className="text-xs text-rose-400 font-bold bg-rose-950/20 p-2 text-center rounded-xl border border-rose-900/30">
                {passcodeError}
              </p>
            )}

            <button
              type="submit"
              className="w-full font-black text-xs py-4 rounded-xl bg-gradient-to-r from-[#0038A8] to-indigo-700 hover:scale-[1.01] text-white transition-all cursor-pointer shadow-md"
            >
              تأكيد الدخول الآمن 🚀
            </button>
          </form>

          <p className="text-[11px] text-amber-500 font-bold leading-none">
            رمز المرور الافتراضي: <span className="underline font-mono text-white text-xs">2026</span>
          </p>
          <button onClick={onBackToMain} className="text-xs text-slate-400 hover:text-white underline font-semibold block mx-auto">
            الرجوع للبوابة الاستقبالية
          </button>
        </div>
      </div>
    );
  }

  // Active Live Competition Admin cockpit
  if (roomPIN && roomVal) {
    const activeQ = roomVal.currentQuestion;
    const teamsList = roomVal.teams ? Object.values(roomVal.teams) : [];
    const responsesList = roomVal.responses ? Object.values(roomVal.responses) : [];

    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-8 text-right space-y-6" dir="rtl">
        {/* Cockpit header with real pin */}
        <header className="bg-gradient-to-r from-[#0038A8] to-indigo-900 text-white rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/15">
              <Laptop className="w-6 h-6 text-yellow-405 text-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black">غرفة الأستاذ النشطة: معترك الكنز ⛵🇲🇦</h1>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-black animate-pulse">
                  غرفة متزامنة 🟢
                </span>
              </div>
              <p className="text-xs text-slate-300 font-bold mt-1">
                المستوى الدراسي: <span className="text-amber-300 font-black">{selectedLevel}</span> • المادة: <span className="text-amber-300 font-black">{selectedSubject}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-slate-950/80 border border-amber-500/25 px-5 py-2.5 rounded-2xl text-center">
              <p className="text-[9px] text-slate-400 font-black">رمز دخول المجموعات PIN</p>
              <p className="text-3xl font-mono tracking-widest font-black text-amber-400">{roomPIN}</p>
            </div>

            <button
              onClick={handleTerminateRoom}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0"
            >
              إنهاء الدورة كلياً 🛑
            </button>
          </div>
        </header>

        {/* Dynamic State Machine Controllers Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Block (5 columns): Active Connected Teams Monitoring & Manual score adjustments */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-5 border border-indigo-950 text-white space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-indigo-950 pb-2">
                <h3 className="font-extrabold text-xs text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#F59E0B]" />
                  <span>مجموعات وفرسان القسم المتصلة ({teamsList.length})</span>
                </h3>
                <span className="text-[9px] text-[#00E5FF] font-black">تحكم لحظي للأستاذ</span>
              </div>

              {teamsList.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <span className="text-4xl animate-bounce">🏝️</span>
                  <p className="text-xs font-black">بانتظار التحاق سفن المجموعات بالحصن...</p>
                  <p className="text-[9px] text-slate-650 max-w-sm mx-auto leading-relaxed">
                    اطلب من المتعلمين الدخول باسم الفريق والرمز PIN <span className="font-mono text-amber-400 font-extrabold">{roomPIN}</span> والضغط على إبحار.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {teamsList.map((team) => {
                    const responseState = roomVal.responses?.[team.id];
                    return (
                      <div key={team.id} className="bg-slate-950 border border-indigo-950 p-3 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{team.avatar || '🦁'}</span>
                            <div>
                              <p className="text-xs font-black text-white">{team.teamName}</p>
                              <p className="text-[10px] text-amber-400 font-bold">{team.score || 0} ذهبية ⭐</p>
                            </div>
                          </div>

                          {/* grading direct buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleAdjustScore(team.id, 200)}
                              className="bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-900/30 shrink-0"
                            >
                              +200
                            </button>
                            <button
                              onClick={() => handleAdjustScore(team.id, -200)}
                              className="bg-rose-950/45 text-rose-400 border border-rose-900 px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer hover:bg-rose-900/40 shrink-0"
                            >
                              -200
                            </button>
                          </div>
                        </div>

                        {/* Live answers monitored dynamically as requested */}
                        {responseState && (
                          <div className="text-[10px] bg-slate-900 border border-indigo-900/40 p-2.5 rounded-xl space-y-1 mt-1 text-right">
                            <p className="text-amber-400 font-black">الجواب الذي أرسلوه فوراً:</p>
                            <p className="text-slate-100 font-bold">"{responseState.selectedAnswer}"</p>
                            <span className={`inline-block text-[9.5px] font-black px-1.5 py-0.5 rounded ${responseState.isCorrect ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900' : 'bg-rose-950/50 text-rose-400 border border-rose-905'}`}>
                              {responseState.isCorrect ? '✓ صحيح فقهياً/منهجياً' : '✗ يحتاج مراجعة ديدكتيكية'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Block (7 columns): State Machine controls */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* SETUP STATE DISPLAY AND START COMPETITION CONTROLLER */}
            {roomVal.status === 'setup' && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 border-2 border-emerald-500/30 shadow-2xl space-y-4">
                <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
                  <Anchor className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>التحضير جاهز! جاهز للإبحار نحو قلاع المعرفة</span>
                </h3>
                <p className="text-xs text-slate-350 leading-relaxed font-bold">
                  لقد قمت بنجاح ببناء وتصدير قائمة من <span className="text-[#00E5FF] font-black">{poolQuestions.length} أسئلة بيداغوجية</span> متزامنة حاسمة لشواطئ ومحطات هذه الدورة المغربية الممتعة.
                </p>

                <div className="border border-indigo-950 bg-slate-950/50 p-4 rounded-xl space-y-1">
                  <p className="text-xs text-amber-400 font-black">معلومات الحصة المقررة:</p>
                  <p className="text-[10px] text-slate-300 font-bold">
                    • المستوى: {selectedLevel} | المادة: {selectedSubject} <br />
                    • مجموع الأسئلة: {poolQuestions.length} تحدٍ فاعل
                  </p>
                </div>

                <button
                  onClick={handleStartCompetition}
                  className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:scale-[1.01] text-slate-950 font-black text-xs transition-all shadow-lg cursor-pointer"
                >
                  بـدء المـظفـرة والمسـابقة الجـماعية 🔥🚀
                </button>
              </div>
            )}

            {/* PLAYING STATE OR REVEAL CONTROLLER */}
            {(roomVal.status === 'playing' || roomVal.status === 'reveal') && activeQ && (
              <div className="bg-[#0b121f] rounded-3xl p-5 md:p-6 text-white border border-indigo-950 space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-indigo-950 pb-3">
                  <span className="text-xs bg-[#0038A8] px-3 py-1 rounded-full font-black text-white">
                    {roomVal.status === 'playing' ? 'المغامرة تشتعل الآن! (تفكير وحسم)' : 'إشهار وكشف الجواب الصائب'}
                  </span>

                  <span className="text-[10px] font-black text-slate-405 text-slate-400">
                    السؤال {roomVal.currentQuestionIndex + 1} من {poolQuestions.length}
                  </span>
                </div>

                {/* Question Info card */}
                <div className="bg-slate-950 p-6 rounded-2xl border border-indigo-950 space-y-3">
                  <span className="text-[9px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase">
                    تحدي: {activeQ.type === 'mcq' ? 'اختيار من متعدد QCM' : 'نمط مكتوب ✏️'} • {activeQ.points} نقطة
                  </span>
                  <h4 className="text-sm md:text-base font-black text-amber-300 leading-relaxed whitespace-pre-wrap">{activeQ.text}</h4>
                  
                  {activeQ.options && activeQ.options.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2">
                      {activeQ.options.map((opt, i) => (
                        <div 
                          key={i} 
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            opt === activeQ.correctAnswer 
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                              : 'bg-slate-900 border-indigo-950 text-slate-350'
                          }`}
                        >
                          <span>{opt}</span>
                          {opt === activeQ.correctAnswer && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats indicators */}
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-indigo-950/50 flex justify-between items-center text-xs text-slate-400 font-bold">
                  <span>الأجوبة المقدمة:</span>
                  <span className="text-amber-400 font-black">{responsesList.length} من أصل {teamsList.length} مجموعات</span>
                </div>

                {/* State Machine Action Triggers */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {roomVal.status === 'playing' && (
                    <button
                      onClick={handleRevealAnswer}
                      className="flex-1 w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs hover:scale-[1.01] cursor-pointer transition-all shadow"
                    >
                      كشف الإجابة الصحيحة وتجميد اللعب 👁️✨
                    </button>
                  )}

                  {roomVal.status === 'reveal' && (
                    <button
                      onClick={handleNextQuestion}
                      className="flex-1 w-full py-4 rounded-xl bg-gradient-to-r from-[#0038A8] to-indigo-600 text-white font-black text-xs hover:scale-[1.01] cursor-pointer transition-all shadow"
                    >
                      {roomVal.currentQuestionIndex + 1 < poolQuestions.length ? 'الانتقال للسؤال الموالي 🚀' : 'الذهاب لبوديوم التتويج النهائي 🏆👑'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FINISHED STATE podim controller */}
            {roomVal.status === 'finished' && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-indigo-950 text-center space-y-5 shadow-2xl">
                <span className="text-6xl animate-bounce block">👑🏆🎉</span>
                <h3 className="text-xl font-black text-amber-250">انتهت المغامرة بسلام وتوج الأبطال!</h3>
                <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto leading-relaxed">
                  تم رصد صدارة النقاط وإظهار جدول التتويج الأيقوني على شاشة العرض الكبرى لفرسان الصف المغاربة.
                </p>

                <div className="py-2.5">
                  <div className="max-w-xs mx-auto space-y-2 text-right">
                    {[...teamsList].sort((a,b) => b.score - a.score).map((team, index) => (
                      <div key={team.id} className="bg-slate-950 border border-indigo-955 p-3 rounded-xl flex items-center justify-between text-xs font-bold">
                        <span>#{index + 1} {team.avatar} {team.teamName}</span>
                        <span className="text-amber-400 font-black">{team.score} ذهبية</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-indigo-950 pt-4">
                  <button
                    onClick={() => {
                      setPoolQuestions([]);
                      setRoomVal(null);
                      setRoomPIN('');
                      localStorage.removeItem('school_teacher_active_room_pin');
                    }}
                    className="bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-black hover:text-white px-5 py-3 rounded-xl transition-all cursor-pointer text-xs"
                  >
                    بناء جولة ومعترك جديد
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    );
  }

  // Question generation draft screen (gameState === 'setup')
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 text-right space-y-8 animate-fade-in font-sans" dir="rtl">
      
      {/* Moroccan layout Title Banner */}
      <header className="bg-gradient-to-r from-[#0038A8] to-indigo-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl border border-indigo-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <span className="bg-white/10 p-2 rounded-2xl">💻</span>
            <span>الأستاذ - مولد أسئلة الجيل بـ Gemini AI 🔮🇲🇦</span>
          </h1>
          <p className="text-xs text-indigo-150 leading-relaxed font-semibold max-w-2xl text-slate-200">
            أهلاً بك في فلك الأستاذ! حدد المستوى والموضوع لنولّد لك بدقة بيداغوجية المغربية أسئلة متكاملة عبر Gemini AI، ودرّب التلاميذ بتنافس متزامن حقيقي.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-rose-950/45 hover:bg-rose-900 border border-rose-800 text-rose-300 font-extrabold text-xs px-4  py-3.5 rounded-2xl flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          تسجيل الخروج 🔐
        </button>
      </header>

      {/* Forms and pools layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Parametring (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 border border-indigo-950 text-white space-y-6">
            <div className="flex items-center gap-2 border-b border-indigo-950 pb-2.5">
              <Settings className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm">أولاً: صياغة وتوليد أسئلة الجيل</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
              {/* Level select */}
              <div className="space-y-1.5">
                <label className="text-slate-350 text-slate-300 block">المستوى الدراسي المقرّر:</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-indigo-950 p-3 rounded-xl outline-none text-slate-100 cursor-pointer focus:border-[#0038A8] transition-all"
                >
                  <option value="المستوى الأول">المستوى الأول (1 AP)</option>
                  <option value="المستوى الثاني">المستوى الثاني (2 AP)</option>
                  <option value="المستوى الثالث">المستوى الثالث (3 AP)</option>
                  <option value="المستوى الرابع">المستوى الرابع (4 AP)</option>
                  <option value="المستوى الخامس">المستوى الخامس (5 AP)</option>
                  <option value="المستوى السادس">المستوى السادس (6 AP)</option>
                </select>
              </div>

              {/* Subject select */}
              <div className="space-y-1.5">
                <label className="text-slate-355 text-slate-300 block">المادة والقلعة:</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-indigo-950 p-3 rounded-xl outline-none text-slate-100 cursor-pointer focus:border-[#0038A8] transition-all"
                >
                  <option value="اللغة العربية">قلعة الضاد (اللغة العربية)</option>
                  <option value="الرياضيات">قلعة الخوارزمي (الرياضيات)</option>
                  <option value="التربية الإسلامية">قلعة الإيمان (التربية الإسلامية)</option>
                  <option value="النشاط العلمي">قلعة ابن سينا (النشاط العلمي)</option>
                </select>
              </div>

              {/* Questions count */}
              <div className="space-y-1.5">
                <label className="text-slate-355 text-slate-300 block">عدد الأسئلة المطلوبة:</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border-2 border-indigo-950 p-3 rounded-xl outline-none text-slate-100 cursor-pointer focus:border-[#0038A8] transition-all"
                >
                  <option value={1}>سؤال واحد (1)</option>
                  <option value={2}>سؤالان (2)</option>
                  <option value={3}>ثلاثة أسئلة (3)</option>
                  <option value={5}>خمسة أسئلة (5)</option>
                </select>
              </div>

              {/* Type Select */}
              <div className="space-y-1.5">
                <label className="text-slate-355 text-slate-300 block">نمط ونوعية الأسئلة:</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-indigo-950 p-3 rounded-xl outline-none text-slate-100 cursor-pointer focus:border-[#0038A8] transition-all"
                >
                  <option value="mcq">نمط QCM الخياري (أزرار ملونة ثلاثية الأبعاد)</option>
                  <option value="written">نمط كتابي تفاعلي (صندوق إدخال نصي)</option>
                </select>
              </div>

              {/* Topic text */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-355 text-slate-300 block">الموضوع أو معايير بيداغوجية للدرس (اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: فرائض الصلاة والوضوء، مفعول مطلق، محيط ومساحة..."
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-slate-950 border-2 border-indigo-950 p-3 text-slate-100 rounded-xl outline-none placeholder:text-slate-700"
                />
              </div>

            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={isGenerating}
              className={`w-full py-4.5 rounded-2xl text-slate-950 font-black text-xs transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer ${
                isGenerating ? 'bg-amber-100/30 text-slate-400 cursor-wait' : 'bg-[#00E5FF] hover:bg-sky-400'
              }`}
            >
              <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
              <span>{isGenerating ? 'بصانع التمريض البيداغوجي الفوري... ⏳' : 'توليد وتنشيط بيداغوجي بـ Gemini API 🪄'}</span>
            </button>

            {generationError && (
              <p className="text-xs text-rose-400 bg-rose-950/20 p-2 text-center rounded-xl border border-rose-900/30">
                {generationError}
              </p>
            )}

          </div>
        </div>

        {/* Preview questions (1 col) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-5 border border-indigo-950 text-white space-y-4 max-h-[380px] overflow-y-auto">
            <h3 className="font-extrabold text-xs text-amber-200 flex items-center gap-1.5 pb-2 border-b border-indigo-950">
              <Award className="w-4 h-4 text-[#00E5FF]" />
              <span>معاينة الأسئلة في الخزينة ({poolQuestions.length})</span>
            </h3>

            {poolQuestions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <span className="text-3xl">⛵</span>
                <p className="text-xs font-black">جاهز لاستقبال المعترك!</p>
                <p className="text-[10px] text-slate-650 leading-relaxed">أدخل الخصائص على اليمين ثم اضغط توليد لتفجير أسئلة Gemini ومراجعتها هنا.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {poolQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-indigo-950 space-y-2 relative">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="bg-[#0038A8] text-white px-2 py-0.5 rounded">سؤال {idx + 1}</span>
                      <button 
                        onClick={() => {
                          const updated = poolQuestions.filter((_, i) => i !== idx);
                          setPoolQuestions(updated);
                        }}
                        className="text-rose-450 text-rose-400 hover:text-rose-300 font-bold"
                      >
                        حذف
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-200">{q.text}</p>
                    <p className="text-[10px] text-emerald-400 font-bold">✓ الجواب: {q.correctAnswer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Launch room panel */}
          <div className="p-5.5 rounded-3xl border-2 border-emerald-500/30 bg-slate-900 text-center text-white space-y-4">
            <h4 className="text-emerald-400 text-sm font-black flex items-center justify-center gap-1.5">
              <Play className="w-5 h-5" />
              <span>تفعيل وبدء المعترك الصفي</span>
            </h4>
            <p className="text-[10.5px] text-slate-400 leading-relaxed font-bold">
              سيقوم خادم الغرف بتسجيل PIN فريد. وجه تلاميذك وشاشة العرض الكبرى للدخول بالرقم واللحاق بالدورة!
            </p>

            <button
              onClick={handleLaunchRoom}
              disabled={poolQuestions.length === 0}
              className={`w-full py-4 rounded-xl text-slate-950 font-black text-xs transition-all ${
                poolQuestions.length > 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:scale-[1.01] cursor-pointer' : 'bg-slate-950 border border-indigo-950 text-slate-550'
              }`}
            >
              تفعيل الغرفة وسحب رمز PIN 🌐📡
            </button>

            <button onClick={onBackToMain} className="text-xs text-slate-400 hover:text-white underline block mx-auto font-black">
              العودة للبوابة الرئيسية
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
