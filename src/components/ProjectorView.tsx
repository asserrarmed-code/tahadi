import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Check, Clock, Sparkles, AlertCircle, 
  Tv, Award, Shield, Flame, Anchor, Swords
} from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

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

interface ProjectorViewProps {
  onBackToMain: () => void;
}

export default function ProjectorView({ onBackToMain }: ProjectorViewProps) {
  const [pinInput, setPinInput] = useState('');
  const [roomVal, setRoomVal] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<string | null>(() => {
    return localStorage.getItem('school_projector_active_room_pin');
  });

  // Local Countdown Timer
  const [secondsRemaining, setSecondsRemaining] = useState(40);

  // Sync and listen to the active room whenever activePin changes (on mount and when connected)
  useEffect(() => {
    if (activePin) {
      setPinInput(activePin);
      setLoading(true);
      const roomRef = ref(db, `rooms/${activePin}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        setLoading(false);
        if (snapshot.exists()) {
          const val = snapshot.val() as RoomState;
          setRoomVal(val);
          setErrorHeader(null);
        } else {
          setErrorHeader('تعذر العثور على بث متزامن لهذه الغرفة. يرجى تزويد الأستاذ بالرمز.');
          setRoomVal(null);
        }
      });
      return () => unsubscribe();
    } else {
      setRoomVal(null);
    }
  }, [activePin]);

  // Countdown clock ticking controller
  useEffect(() => {
    if (roomVal && roomVal.status === 'playing') {
      // Initialize with default 40s or depending on parameters
      setSecondsRemaining(40);
    }
  }, [roomVal?.currentQuestionIndex, roomVal?.status]);

  useEffect(() => {
    let interval: any = null;
    if (roomVal && roomVal.status === 'playing' && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [roomVal?.status, secondsRemaining]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorHeader(null);
    if (!pinInput.trim()) {
      setErrorHeader('المرجو كتابة رمز الغرفة PIN لتنشيط الشاشة الكبرى!');
      return;
    }

    localStorage.setItem('school_projector_active_room_pin', pinInput.trim());
    setActivePin(pinInput.trim());
  };

  const handleDisconnect = () => {
    localStorage.removeItem('school_projector_active_room_pin');
    setRoomVal(null);
    setPinInput('');
    setActivePin(null);
  };

  // Lobby Login Template
  if (!roomVal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 font-sans" dir="rtl">
        <div className="bg-[#0c1424] border-2 border-indigo-900/40 text-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full text-center space-y-6">
          <div className="space-y-3">
            <div className="inline-flex bg-indigo-500/10 p-4 rounded-full border border-indigo-500/20 text-[#0038A8]">
              <Tv className="w-12 h-12 animate-pulse text-[#F59E0B]" />
            </div>
            <h2 className="text-2xl font-black text-amber-300">شاشـة العـرض الكبـرى للتعلم 🎥✨</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto">
              اربط هذه الشاشة الإسقاطية بالحاسوب أو صبورة الفصل التفاعلية لمتابعة تفجير وإشارات قلاع المواد المتبادلة بين التلاميذ.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <input
              type="number"
              placeholder="اكتب رمز غرفتك المكون من 4 أرقام"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full text-center tracking-[0.25em] font-mono font-black text-3xl p-3.5 bg-slate-900 border border-indigo-950 text-amber-300 rounded-2xl outline-none focus:border-[#0038A8] transition-all"
              disabled={loading}
              autoFocus
            />

            {errorHeader && (
              <p className="text-xs text-rose-305 text-rose-405 flex items-center justify-center gap-1 bg-red-950/20 p-2.5 rounded-xl border border-rose-950">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorHeader}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-4.5 rounded-2xl bg-gradient-to-r from-amber-400 to-teal-400 text-slate-950 font-black text-xs transition-all shadow hover:scale-[1.01] cursor-pointer"
            >
              <span>{loading ? 'جاري العثور على بث الغرفة الفوري...' : 'تثبيت بث الجزيرة الكبرى 🏝️'}</span>
            </button>
          </form>

          <button onClick={onBackToMain} className="text-xs text-slate-500 hover:text-white underline font-black block mx-auto">
            الرجوع للبوابة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  // Active projection screen layouts
  const teamsList = roomVal.teams ? Object.values(roomVal.teams) : [];
  const responsesCount = roomVal.responses ? Object.keys(roomVal.responses).length : 0;
  const activeQ = roomVal.currentQuestion;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 text-right space-y-6 text-white font-sans" dir="rtl">
      
      {/* Cockpit upper bar */}
      <header className="bg-slate-900 rounded-3xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-950 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-3 rounded-2xl border border-indigo-950 text-amber-400 animate-spin" style={{ animationDuration: '8s' }}>
            <Anchor className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-amber-350">بث المغامرة الصفي المباشر 🎥🏝️</h1>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              رصيف المجموعات: متصل الآن وتنافسي بشكل متزامن دقيق عبر Firebase.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-950 border border-indigo-950 py-2 px-5 rounded-2xl text-center shadow-inner">
            <p className="text-[9px] text-[#00E5FF] font-black tracking-widest uppercase">رقم دخول التلاميذ PIN:</p>
            <p className="text-3xl font-mono text-amber-405 text-amber-400 tracking-widest font-black leading-none mt-1">{roomVal.pin}</p>
          </div>

          <button
            onClick={handleDisconnect}
            className="text-[10px] border border-indigo-950 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white px-3.5 py-2.5 rounded-xl font-black transition-all cursor-pointer"
          >
            قطع البث 🔌
          </button>
        </div>
      </header>

      {/* SETUP / WAITING LOBBY IN CLASSROOM */}
      {roomVal.status === 'setup' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Left Block (2 columns): Treasure Map */}
          <div className="md:col-span-2 bg-[#0a1122]/90 border border-indigo-950 rounded-3xl p-6 min-h-[420px] relative overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,56,168,0.15)_0%,rgba(5,10,20,0.9)_100%)] pointer-events-none"></div>

            <div className="relative z-10 flex justify-between items-center bg-slate-900 border border-indigo-950 p-3.5 rounded-2xl shadow">
              <span className="text-xs font-black text-amber-250 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                خريطة المسابقة والقلعة الذهبية للتلاميذ 🗺️🇲🇦
              </span>
              <span className="text-[11px] font-mono text-[#00E5FF] font-black">غرفة الحصن: {roomVal.pin}</span>
            </div>

            {/* Simulated nice island coordinates */}
            <div className="relative h-[280px] w-full z-10 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-sm">
                <span className="text-7xl animate-bounce block">🛖⛵🌴</span>
                <p className="text-lg font-black text-amber-300">سفن المجموعات تتأهب للانطلاق!</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  يا فرسان الفصل! توجهوا لشاشات الدخول عبر الجوال أو اللوحة، واكتبوا اسم مجموعتكم للالتحاق بالحصن الآن.
                </p>
              </div>
            </div>

            <div className="relative z-10 bg-slate-900 p-2.5 rounded-xl text-center text-[10px] text-slate-500 border border-indigo-950">
              💡 بمجرد انطلاق المعترك من الأستاذ، سيتم التنقل تلقائياً عبر الأقسام والأسئلة لجمع الأوراق الذهبية.
            </div>
          </div>

          {/* Connected teams lists */}
          <div className="md:col-span-1 bg-slate-900 rounded-3xl p-5 border border-indigo-900 flex flex-col justify-between space-y-4 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-300 border-b border-indigo-950 pb-2 flex items-center gap-1.5 uppercase">
                <Users className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>الفرسان المتصلون الآن ({teamsList.length})</span>
              </h3>

              {teamsList.length === 0 ? (
                <p className="text-slate-500 py-24 text-center font-bold text-xs border border-indigo-955 border-dashed rounded-2xl">
                  في انتظار التحاق سفن المجموعات... ⏳
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pl-1">
                  {teamsList.map((team) => (
                    <div key={team.id} className="bg-slate-950 border border-indigo-950 p-2.5 rounded-xl flex items-center gap-2 text-right">
                      <span className="text-2xl">{team.avatar}</span>
                      <span className="text-[11px] font-extrabold truncate text-slate-100">{team.teamName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-indigo-950 text-center text-[9px] text-teal-350 font-black animate-pulse">
              🔔 وجهوا نظركم للصبورة، المسابقة ستبدأ في لحظات!
            </div>
          </div>
        </div>
      )}

      {/* PLAYING STATE: SHOW CURRENT QUESTION & PREVENT SHOWING ANSWER */}
      {roomVal.status === 'playing' && activeQ && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          
          {/* Main Question view left */}
          <div className="lg:col-span-3 bg-slate-905 bg-[#0a0f1d] border border-indigo-950 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative shadow-2xl overflow-hidden min-h-[420px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,10,60,0.15)_0%,rgba(5,10,20,0.95)_100%)] pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
              <h4 className="text-xs font-black text-amber-400 bg-slate-900 border border-indigo-955 px-3 py-1.5 rounded-full inline-block">
                🏴‍☠️ المحطة الحالية • تحدي القسم التربوي المتزامن
              </h4>
              <h2 className="text-base md:text-2xl font-black text-slate-100 leading-relaxed bg-slate-950 border border-indigo-950/60 p-6 md:p-8 rounded-2xl shadow-inner text-center whitespace-pre-wrap break-words">
                {activeQ.text}
              </h2>
            </div>

            {/* MCQ Colored Options - Hides Correct Answer completely! */}
            {activeQ.type === 'mcq' && (
              <div className="relative z-10 grid grid-cols-2 gap-4 pb-2 pt-4">
                {[
                  { bg: 'bg-rose-950/20 border-rose-900/40', symbol: '🔺', titleColor: 'text-rose-400' },
                  { bg: 'bg-indigo-950/20 border-indigo-900/40', symbol: '🔷', titleColor: 'text-indigo-400' },
                  { bg: 'bg-amber-950/20 border-amber-900/45', symbol: '🟡', titleColor: 'text-amber-400' },
                  { bg: 'bg-emerald-950/20 border-emerald-900/40', symbol: '🟩', titleColor: 'text-emerald-400' }
                ].map((decor, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 h-[75px] rounded-2xl border-2 flex items-center gap-3.5 shadow-sm ${decor.bg}`}
                  >
                    <span className="text-xl">{decor.symbol}</span>
                    <span className="text-xs font-extrabold text-slate-200">{activeQ.options[idx]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Written Question panel */}
            {activeQ.type === 'written' && (
              <div className="relative z-10 bg-slate-950 border border-indigo-950/50 p-10 rounded-3xl text-center space-y-3">
                <span className="text-5xl block animate-bounce">✏️</span>
                <p className="text-sm font-black text-amber-200">سؤال كتابي تفعيلي على شاشة المتعلمين!</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  ركِّزوا جيداً مع رفاقكم، اكتبوا الكلمة أو العبارة بدقة منهجية بيداغوجية، ثم اضغطوا إرسال لحصد الذهب الصالح!
                </p>
              </div>
            )}

            {/* Real-time responses progress indicators */}
            <div className="relative z-10 border-t border-indigo-950 pt-4 flex items-center justify-between gap-4">
              <span className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#00E5FF]" />
                <span>إجابات المجموعات الراهنة ({responsesCount} من أصل {teamsList.length})</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-black text-amber-400">
                  {teamsList.length > 0 ? Math.round((responsesCount / teamsList.length) * 100) : 0}% حسموا
                </span>
                <div className="w-40 h-2.5 bg-slate-950 border border-indigo-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-teal-400 transition-all duration-300"
                    style={{ width: `${teamsList.length > 0 ? (responsesCount / teamsList.length) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          {/* Right column: Ticking Clock Timer and suspension details of who submitted */}
          <div className="lg:col-span-1 bg-slate-900 border border-indigo-950 rounded-3xl p-5 flex flex-col justify-center items-center text-center space-y-6 relative shadow-2xl">
            <p className="text-xs font-black text-slate-400">الوقت التنازلي التنافسي ⏰</p>
            <div className={`text-6xl md:text-7xl font-mono font-black ${
              secondsRemaining <= 6 ? 'text-rose-500 animate-ping' : 'text-amber-300 animate-pulse'
            }`}>
              {secondsRemaining}
            </div>

            {/* Shows teams submitted without highlighting whether correct/incorrect to maintain extreme classroom suspense (Kahoot-style)! */}
            <div className="w-full border-t border-indigo-950/65 pt-4 text-right space-y-2">
              <p className="text-[9px] text-[#00E5FF] font-black uppercase pb-1 border-b border-indigo-950/20">حالة طاقم المجموعات الراهنة:</p>
              {teamsList.map((team) => {
                const hasAnswered = roomVal.responses?.[team.id];
                return (
                  <div key={team.id} className="flex justify-between items-center text-[10px] font-semibold border-b border-indigo-955/20 pb-1">
                    <span className="truncate max-w-[70px]">{team.avatar} {team.teamName}</span>
                    <span>
                      {hasAnswered ? (
                        <span className="text-emerald-400 font-black flex items-center gap-0.5">🟢 تم الإرسال</span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">🤔 يفكر...</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* REVEAL CORRECT ANSWER: GLOWS GREEN ON SOCRATIC TRUTH */}
      {roomVal.status === 'reveal' && activeQ && (
        <div className="bg-[#0a0f1d] border border-indigo-950 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl">
          <div className="relative space-y-1">
            <span className="text-5xl animate-bounce block">✨🪐👁️</span>
            <h2 className="text-xl md:text-2xl font-black text-amber-250">انتهت جولة المعترك! الجواب الذهبي الصميم هو:</h2>
          </div>

          {/* Highlight options correctly in sparkling emerald green */}
          <div className="w-full max-w-xl bg-emerald-950/40 border-2 border-emerald-500 p-5 rounded-3xl shadow-lg shadow-emerald-950/50 space-y-1 my-3 animate-pulse">
            <p className="text-[9px] text-emerald-450 text-emerald-400 font-black tracking-wide">الخلاصة البيداغوجية الصاحبة:</p>
            <p className="text-sm md:text-lg font-black text-white">"{activeQ.correctAnswer}"</p>
          </div>

          {/* Scoreboard listing live standings after this round */}
          <div className="w-full border-t border-indigo-950 pt-5 space-y-4 text-right">
            <h3 className="text-xs font-black text-slate-400 flex items-center gap-1.5 uppercase">
              <Trophy className="w-4 h-4 text-yellow-405 text-yellow-400" />
              <span>ترتيب صدارة المجموعات والفرسان الراهنة:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-black text-xs">
              {[...teamsList].sort((a,b) => b.score - a.score).map((team, idx) => {
                const isWinnerThisRound = roomVal.responses?.[team.id]?.isCorrect;
                return (
                  <div key={team.id} className="bg-slate-950/80 border border-indigo-950 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">#{idx + 1} {team.avatar}</span>
                      <span className="truncate max-w-[110px] font-extrabold">{team.teamName}</span>
                    </div>

                    <div className="text-left">
                      <span className="text-amber-400 font-extrabold">{team.score || 0} ذهبية</span>
                      {isWinnerThisRound ? (
                        <p className="text-[8.5px] text-emerald-400 font-black mt-0.5 animate-bounce">موفقة +{activeQ.points} ⭐</p>
                      ) : (
                        <p className="text-[8.5px] text-slate-500 font-medium mt-0.5">حظ سعيد لاحقاً</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FINISHED PODIUM CONGRATULATION */}
      {roomVal.status === 'finished' && (
        <div className="bg-slate-950 border border-indigo-500/20 rounded-3xl p-6 md:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden min-h-[430px] flex flex-col justify-center items-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,10,70,0.15)_0%,rgba(5,10,15,1)_100%)] pointer-events-none"></div>

          <div className="relative z-10 space-y-2">
            <span className="text-7xl block animate-bounce">🏆⭐🎉👑</span>
            <h2 className="text-2xl md:text-3xl font-black text-amber-250">بوديوم المجموعات الذهبية المتوجة!</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-bold max-w-lg mx-auto">
              نهنئ المجموعات الفائزة وكل المتعلمين فرسان الفصل المغربي الرائد على مسارات جزيرة الكنز المباركة.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row justify-center items-end gap-5 max-w-2xl w-full pt-8 pb-3">
            {(() => {
              const sorted = [...teamsList].sort((a, b) => b.score - a.score);
              const p1 = sorted[0];
              const p2 = sorted[1];
              const p3 = sorted[2];

              return (
                <>
                  {/* #2 Ranked */}
                  {p2 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 w-full sm:w-48 text-center space-y-2.5 flex flex-col justify-end items-center h-52 shadow-md border-t-4 border-t-slate-400 order-2 sm:order-1">
                      <span className="text-3xl">{p2.avatar}</span>
                      <p className="font-extrabold text-[11px] truncate max-w-[125px]">{p2.teamName}</p>
                      <p className="text-[9.5px] bg-slate-950 text-amber-300 px-3 py-0.5 rounded-full font-black">{p2.score} ذهبية</p>
                      <div className="bg-slate-800 text-slate-200 font-black text-[11px] py-2.5 w-full rounded-xl">المرتبة الثانية 🥈</div>
                    </div>
                  )}

                  {/* #1 Champion Tallest */}
                  {p1 && (
                    <div className="bg-slate-900 border border-amber-500 rounded-2xl p-5.5 w-full sm:w-56 text-center space-y-3 flex flex-col justify-end items-center h-64 shadow-2xl border-t-4 border-t-amber-400 order-1 sm:order-2 ring-4 ring-amber-400">
                      <span className="text-4xl animate-bounce">👑🏆</span>
                      <span className="text-4xl block -mt-1">{p1.avatar}</span>
                      <p className="font-black text-xs truncate max-w-[145px] text-teal-30s text-emerald-400">{p1.teamName}</p>
                      <p className="text-[10px] bg-amber-400 text-slate-950 px-3.5 py-0.5 rounded-full font-black">{p1.score} ذهبية</p>
                      <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs py-3 w-full rounded-xl">البطلة الذهبية 🥇👑</div>
                    </div>
                  )}

                  {/* #3 Ranked */}
                  {p3 && (
                    <div className="bg-slate-900 border border-slate-804 rounded-2xl p-4 w-full sm:w-44 text-center space-y-2 flex flex-col justify-end items-center h-44 shadow-md border-t-4 border-t-amber-800 order-3">
                      <span className="text-3xl">{p3.avatar}</span>
                      <p className="font-extrabold text-[11px] truncate max-w-[120px]">{p3.teamName}</p>
                      <p className="text-[9.5px] bg-slate-950 text-amber-300 px-3 py-0.5 rounded-full font-black">{p3.score} ذهبية</p>
                      <div className="bg-amber-900 text-slate-200 font-black text-[10px] py-1.5 w-full rounded-lg">المرتبة الثالثة 🥉</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
