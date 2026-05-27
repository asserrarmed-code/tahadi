import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Check, Clock, Sparkles, AlertCircle, 
  Tv, Play, Award, Volume2, Gamepad2, Shield, Heart, HelpCircle, 
  Flame, Anchor, Swords
} from 'lucide-react';
import { Room, Player, Question } from '../types';
import { listenToRoom } from '../lib/firebase';

interface ProjectorViewProps {
  onBackToMain: () => void;
}

export default function ProjectorView({ onBackToMain }: ProjectorViewProps) {
  const [pinInput, setPinInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<string | null>(() => localStorage.getItem('school_projector_active_room_pin'));

  // Sync and listen to the active room whenever activePin changes (on mount and when connected)
  useEffect(() => {
    if (activePin) {
      setPinInput(activePin);
      setLoading(true);
      const unsubscribe = listenToRoom(activePin, (room) => {
        setLoading(false);
        if (!room) {
          setError('تعذر العثور على هذه الحصة. يرجى مراجعة الأستاذ للتأكد من الرقم.');
          setCurrentRoom(null);
          return;
        }
        setCurrentRoom(room);
      });
      return () => unsubscribe();
    } else {
      setCurrentRoom(null);
    }
  }, [activePin]);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pinInput.trim()) {
      setError('المرجو إدخال رمز الغرفة PIN لتنشيط الشاشة الكبرى!');
      return;
    }

    localStorage.setItem('school_projector_active_room_pin', pinInput.trim());
    setActivePin(pinInput.trim());
  };

  const handleDisconnect = () => {
    localStorage.removeItem('school_projector_active_room_pin');
    setCurrentRoom(null);
    setPinInput('');
    setActivePin(null);
  };

  // State calculations
  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  const totalPlayers = currentRoom ? Object.keys(currentRoom.players).length : 0;
  const playersList = currentRoom ? Object.values(currentRoom.players) : [];
  const answeredCount = currentRoom ? playersList.filter((p: Player) => p.answeredThisRound).length : 0;

  // Subjects coordinates mapping
  const islandStations = [
    { name: 'التربية الإسلامية', icon: '🕌', title: 'قلعة الإيمان', x: 23, y: 18 },
    { name: 'اللغة العربية', icon: '📖', title: 'قلعة الضاد', x: 50, y: 15 },
    { name: 'الرياضيات', icon: '📐', title: 'قلعة الخوارزمي', x: 77, y: 22 },
    { name: 'النشاط العلمي', icon: '🔬', title: 'قلعة ابن سينا', x: 78, y: 62 },
    { name: 'الاجتماعيات', icon: '🌍', title: 'قلعة ابن بطوطة', x: 50, y: 75 },
    { name: 'اللغة الفرنسية', icon: '🇫🇷', title: 'قلعة Molière', x: 22, y: 58 },
  ];

  // Render Pin Connection Card
  if (!currentRoom) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" dir="rtl">
        <div id="projector-pin-card" className="bg-slate-900/95 text-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full border border-indigo-500/20 backdrop-blur-md space-y-6 text-center">
          <div className="space-y-3">
            <div className="inline-flex bg-indigo-500/10 p-4 rounded-full border border-indigo-500/20 text-yellow-405 text-yellow-400">
              <Tv className="w-12 h-12 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-amber-205">شاشـة العـرض الكبـرى للتعلم 🎥✨</h2>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold max-w-sm mx-auto">
              اربط هذه الشاشة الإسقاطية بالحاسوب أو شاشة التلفاز التفاعلية لمتابعة "جزيرة الكنز" وإشارات قلاع المواد الست المتبادلة بين التلاميذ.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1.5">
              <input
                type="number"
                placeholder="أدخل الرمز PIN المكون من 4 أركان"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-[0.25em] font-mono font-black text-3xl p-3.5 bg-slate-950 border border-indigo-500/35 focus:border-amber-400 text-amber-300 rounded-2xl outline-none transition-all placeholder-indigo-950"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-rose-300 font-extrabold flex items-center justify-center gap-1 bg-red-950/40 border border-red-500/20 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-4.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-teal-400 hover:scale-[1.01] text-slate-950 font-black text-xs transition-all shadow-lg cursor-pointer"
            >
              <span>{loading ? 'جاري العثور على البث الروحي للغرفة...' : 'تثبيت بث الجزيرة الكبرى 🏝️'}</span>
            </button>
          </form>

          <button
            onClick={onBackToMain}
            className="text-xs text-slate-400 hover:text-white underline font-bold mt-2"
          >
            الرجوع للبوابة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  // Active projection screen layouts
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 text-right space-y-5 text-white animate-fade-in" dir="rtl">
      
      {/* Upper info control header */}
      <header className="bg-slate-900/90 rounded-3xl p-4.5 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-500/20 backdrop-blur-md">
        <div className="flex items-center gap-4.5">
          <div className="bg-amber-400/10 p-3 rounded-2xl border border-amber-400/20 text-amber-450 text-amber-400">
            <Tv className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-amber-100">بث المغامرة الصفي المباشر 🎥🏝️</h1>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-900 px-3 py-0.5 rounded-full font-black animate-pulse">
                لوحة جزيرة الكنز متزامنة 🟢
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              مستوى الحصة: <span className="text-teal-300 font-black">{currentRoom.activeQuiz?.level || 'المشترك'}</span> 
              {" • "} مسار: <span className="text-teal-300 font-extrabold">{currentRoom.activeQuiz?.title}</span>
            </p>
          </div>
        </div>

        {/* PIN presentation block */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-950/80 border border-indigo-500/30 py-2 px-5 rounded-2xl text-center">
            <p className="text-[9px] text-slate-400 font-black tracking-wider uppercase">رابط دخول الأبطال بالرمز PIN:</p>
            <p className="text-3xl font-mono text-amber-300 tracking-widest font-extrabold">{currentRoom.pin}</p>
          </div>

          <button
            onClick={handleDisconnect}
            className="text-[10px] border border-slate-800 bg-slate-905 hover:bg-slate-800 text-slate-400 hover:text-white px-3.5 py-2.5 rounded-xl font-black transition-all"
          >
            قطع الاتصال 🔌
          </button>
        </div>
      </header>

      {/* RENDER TREASURE MAP VIEW (LOBBY + INTERMISSIONS AND LEADERBOARD TIMES) */}
      {(currentRoom.state === 'waiting' || currentRoom.state === 'leaderboard') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* THE DIGITAL MAP SYSTEM (Lg = 8 cols) */}
          <div className="lg:col-span-8 bg-slate-950/90 border border-indigo-550/20 rounded-3xl p-4.5 min-h-[500px] relative overflow-hidden flex flex-col justify-between shadow-2xl">
            {/* Background Map Visual elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.2)_0%,rgba(15,23,42,0.85)_100%)] pointer-events-none"></div>
            
            {/* Map Contours Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-25 pointer-events-none"></div>

            {/* Path SVG System */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path 
                d="M 8,85 Q 15,48 23,18 Q 36,16 50,15 Q 63,18 77,22 Q 77,42 78,62 Q 64,68 50,75 Q 36,66 22,58 Q 36,51 50,45" 
                fill="none" 
                stroke="#d97706" 
                strokeWidth="1.2" 
                strokeDasharray="3,3" 
                className="opacity-70 animate-pulse"
              />
            </svg>

            {/* Map Header */}
            <div className="relative z-10 flex justify-between items-center bg-slate-900/40 p-3 rounded-2xl border border-indigo-500/10">
              <span className="text-xs font-black text-amber-200 flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-amber-300" />
                خريطة جزيرة المستكشف الرقمية الصفيّة 🏝️🗺️
              </span>
              <span className="text-[10px] text-slate-400 font-extrabold">المسار الذهبي نحو كنز المعرفة</span>
            </div>

            {/* RENDER PLACEMENTS OF STATIONS */}
            <div className="relative h-[380px] w-full z-10">
              
              {/* STAGE Harbor Start */}
              <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: '8%', top: '85%' }}>
                <div className="w-12 h-12 rounded-full bg-slate-900/90 border border-amber-400 text-amber-200 flex items-center justify-center shadow-lg hover:scale-115 transition-transform">
                  <span className="text-2xl animate-bounce">⛵</span>
                </div>
                <span className="text-[9px] font-black text-slate-400 block mt-1">مرفأ الانطلاق</span>
              </div>

              {/* RENDER CASTLES */}
              {islandStations.map((station) => {
                const isCompleted = currentRoom.completedSubjects?.[station.name] || false;
                const isActive = currentRoom.activeSubject === station.name;

                return (
                  <div 
                    key={station.name} 
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center transition-all group"
                    style={{ left: `${station.x}%`, top: `${station.y}%` }}
                  >
                    {/* Glowing effect inside items */}
                    {isActive ? (
                      <div className="absolute inset-0 -m-5 bg-red-405/20 bg-amber-500/20 rounded-full blur-xl animate-ping" style={{ animationDuration: '2.5s' }}></div>
                    ) : null}
                    {isCompleted ? (
                      <div className="absolute inset-0 -m-3 bg-emerald-500/15 rounded-full blur-lg"></div>
                    ) : null}

                    {/* Castle Icon core box */}
                    <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl relative transition-all border duration-500 ${
                      isActive 
                        ? 'bg-gradient-to-b from-amber-500 to-red-600 border-yellow-300 scale-120 z-20 ring-4 ring-yellow-400animate-pulse' 
                        : isCompleted
                          ? 'bg-emerald-950/90 border-emerald-400/90 text-emerald-305'
                          : 'bg-slate-900/90 border-indigo-500/30 text-indigo-300 group-hover:border-amber-400/50'
                    }`}>
                      <span className="text-2xl">{station.icon}</span>
                      
                      {/* Check badge when completed */}
                      {isCompleted && (
                        <div className="absolute -top-1 -right-1 bg-emerald-400 text-slate-950 rounded-full p-0.5 border border-white">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                      {/* Active sign */}
                      {isActive && (
                        <div className="absolute -top-2.5 bg-yellow-405 bg-red-500 text-white font-black text-[8px] px-2 py-0.5 rounded-full border border-yellow-300 animate-bounce">
                          تحدي!
                        </div>
                      )}
                    </div>

                    <p className="text-[9px] font-black text-white mt-1.5 drop-shadow">
                      {station.title}
                    </p>
                    <p className="text-[8px] text-slate-400 font-extrabold">
                      ({station.name})
                    </p>

                    {/* Show miniatures of teams positioned at this station based on score category */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-30">
                      {playersList
                        .filter((p: Player) => {
                          const numCompleted = Object.values(currentRoom.completedSubjects || {}).filter(Boolean).length;
                          // Dynamically scale player progress mapping to subject index
                          const indexForPlayer = Math.min(6, Math.floor((p.score / 5000) * 6));
                          const stationIndex = islandStations.findIndex(s => s.name === station.name);
                          return indexForPlayer === stationIndex && p.score > 0;
                        })
                        .slice(0, 3)
                        .map((p: Player) => (
                          <span 
                            key={p.id}
                            className="text-xs bg-slate-950 border border-amber-300 rounded-full p-0.5 w-5 h-5 flex items-center justify-center animate-bounce shadow"
                            title={p.name}
                          >
                            {p.avatar}
                          </span>
                        ))}
                    </div>

                  </div>
                );
              })}

              {/* STAGE Central Treasure Chest Final */}
              <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: '50%', top: '45%' }}>
                {/* Check if ALL 6 subjects are completed */}
                {(() => {
                  const numCompleted = Object.values(currentRoom.completedSubjects || {}).filter(Boolean).length;
                  const allDone = numCompleted >= 6;

                  return (
                    <div className={`w-18 h-18 rounded-3xl flex items-center justify-center shadow-2xl transition-transform cursor-move border relative ${
                      allDone 
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-600 border-yellow-300 scale-110 z-20 animate-wiggle' 
                        : 'bg-slate-950/90 border-dotted border-amber-500/45 text-amber-500/40'
                    }`}>
                      {allDone ? (
                        <>
                          <div className="absolute inset-0 bg-yellow-500/20 rounded-3xl blur-md animate-ping"></div>
                          <span className="text-4xl animate-bounce">👑👑</span>
                        </>
                      ) : (
                        <span className="text-3xl filter grayscale opacity-40">🏴‍☠️🎁</span>
                      )}
                    </div>
                  );
                })()}
                <span className="text-[10px] font-black text-amber-200 block mt-1.5">صندوق الكنز المعظم</span>
              </div>

            </div>

            {/* Map footer explaining joining */}
            <div className="relative z-10 bg-slate-900/80 p-3 rounded-2xl flex justify-between items-center text-xs opacity-90 border border-indigo-500/10">
              <span className="text-slate-400 leading-none">⚠️ شروط النصر: حل قلاع المعرفة الست بنجاح ليفسح الطريق للكنز النهائي.</span>
              <div className="flex gap-2 text-[10px] font-black">
                <span className="flex items-center gap-1 text-teal-300">
                  <span className="w-2.5 h-2.5 bg-indigo-900 border border-indigo-400 rounded-full inline-block"></span>
                  قيد العبور
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 bg-emerald-950 border border-emerald-400 rounded-full inline-block"></span>
                  مكتملة
                </span>
              </div>
            </div>

          </div>

          {/* DOCKED PLAYERS LISTING (Lg = 4 cols) */}
          <div className="lg:col-span-4 bg-slate-900/95 border border-indigo-505/20 rounded-3xl p-5 shadow-2xl flex flex-col justify-between space-y-4">
            
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <span className="text-xs font-black text-slate-350 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-305" />
                  <span>طاقم فرسان ومجموعات القسم ({totalPlayers})</span>
                </span>
                <span className="text-[9px] text-teal-350 font-black tracking-widest animate-pulse">متصلون</span>
              </div>

              {/* List table */}
              {totalPlayers === 0 ? (
                <div className="py-20 text-center text-slate-500 text-xs font-black bg-slate-950/40 rounded-2xl border border-slate-805/50 border-dashed">
                  ⚠️ بانتظار التحاق سفن المتعلمين بالمرسى...⏳
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {playersList
                    .sort((a,b) => b.score - a.score)
                    .map((p) => (
                      <div 
                        key={p.id} 
                        className="bg-slate-950/80 border border-slate-800/85 p-3 rounded-2xl flex items-center justify-between hover:border-amber-400/30 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{p.avatar}</span>
                          <div>
                            <p className="text-xs font-black text-white truncate max-w-[120px]">{p.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                              {p.usedShield && <span className="text-blue-400 mr-1 opacity-90 inline-flex items-center gap-0.5">🛡️ الدرع</span>}
                              {p.usedPhilosopher && <span className="text-emerald-400 inline-flex items-center gap-0.5">💡 فيلسوف</span>}
                            </p>
                          </div>
                        </div>

                        <div className="text-left">
                          <p className="text-xs font-mono font-extrabold text-amber-400">{p.score} ⭐</p>
                          {p.streak && p.streak > 0 ? (
                            <p className="text-[8px] text-red-400 font-extrabold flex items-center justify-end gap-0.5 animate-pulse mt-0.5">
                              <Flame className="w-2.5 h-2.5 text-red-500" />
                              <span>{p.streak} سلسلة</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Large PIN Board info strictly inside waiting */}
            {currentRoom.state === 'waiting' && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/20 text-center space-y-1">
                <span className="text-3xl animate-bounce block">🧭</span>
                <p className="text-xs font-black text-amber-205">نظام المجموعات المغربي</p>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  تحلَّقوا في مجموعات صفيّة، اتحدوا على اسم الفريق، واستخدموا الذخائر السحرية لفك شفرات القلاع بنجاح!
                </p>
              </div>
            )}

            {/* Quick stats on powerups used to show live telemetry */}
            {currentRoom.state === 'leaderboard' && (
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-805 space-y-2">
                <p className="text-[10px] text-slate-405 font-black flex items-center gap-1.5 uppercase border-b border-slate-800 pb-1">
                  <Swords className="w-3.5 h-3.5 text-red-400" />
                  ذخائر المجموعات المستهلكة باللعبة:
                </p>
                <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-extrabold text-slate-300 text-center">
                  <div className="bg-emerald-950/20 border border-emerald-900 p-1.5 rounded-lg">
                    <p className="text-emerald-400 font-mono text-xs font-black">{playersList.filter(p => p.usedPhilosopher).length}</p>
                    <p className="mt-0.5">فيلسوف الصف</p>
                  </div>
                  <div className="bg-blue-950/20 border border-blue-900 p-1.5 rounded-lg">
                    <p className="text-blue-400 font-mono text-xs font-black">{playersList.filter(p => p.usedShield).length}</p>
                    <p className="mt-0.5">درع الأطلس</p>
                  </div>
                  <div className="bg-amber-950/20 border border-amber-900 p-1.5 rounded-lg">
                    <p className="text-amber-400 font-mono text-xs font-black">{playersList.filter(p => p.usedTimeQuake).length}</p>
                    <p className="mt-0.5">زلزال الوقت</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* QUESTION INTERMISSION COUNTDOWN MOVEMENT */}
      {currentRoom.state === 'question_countdown' && (
        <div className="bg-slate-950 rounded-3xl p-8 md:p-12 shadow-2xl border border-rose-500/20 text-center min-h-[400px] flex flex-col justify-center items-center space-y-6">
          <div className="relative">
            <span className="text-7xl animate-pulse block">🧭🚀</span>
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-xl animate-ping"></div>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-amber-250">
            السحاب ينجلي لفتح بوابة قلعة <span className="text-yellow-405 font-black">({currentRoom.activeSubject})</span>!
          </h2>
          <p className="text-sm text-slate-405 max-w-sm leading-relaxed font-bold">
            يتأهب المعلم الذكي والـ AI لتفجير مسألة التحدي المغربي. مجموعات، تيقَّظوا جيداً للتواطؤ!
          </p>
          <div className="w-24 h-24 rounded-full bg-slate-900 border-4 border-amber-400 flex items-center justify-center shadow-2xl">
            <span className="text-4xl font-mono font-black text-amber-300 animate-ping">{currentRoom.secondsRemaining}</span>
          </div>
        </div>
      )}

      {/* ACTIVE RUNNING QUESTION BOARD (Surgical display) */}
      {currentRoom.state === 'question_active' && activeQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-stretch">
          
          {/* Main Question view left */}
          <div className="lg:col-span-3 bg-slate-950 border border-indigo-505/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 flex flex-col justify-between relative overflow-hidden">
            {currentRoom.multiplierActive && (
              <div className="absolute top-4 left-4 bg-red-655 bg-rose-650 text-white py-1.5 px-3.5 rounded-full text-[10px] font-black animate-pulse border border-rose-400 flex items-center gap-1 shadow">
                <Flame className="w-3.5 h-3.5 animate-spin text-yellow-300" />
                <span>فرصة مضاعفة النقاط نشطة (المستوى مغامرة)!</span>
              </div>
            )}

            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-205 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full inline-block">
                مادة {currentRoom.activeSubject} • تحدي المحطة المغربية
              </span>
              <h2 className="text-lg md:text-2xl font-black text-white leading-relaxed bg-slate-902 bg-slate-900 border border-slate-812 p-6 rounded-2xl">
                {activeQuestion.text}
              </h2>
            </div>

            {/* MCQ Colored Options */}
            {activeQuestion.type === 'mcq' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { bg: 'bg-rose-500/10 border-rose-500/40 hover:border-rose-400', icon: '🔺', titleColor: 'text-rose-400' },
                  { bg: 'bg-indigo-650/10 border-indigo-500/40 hover:border-indigo-400', icon: '🔷', titleColor: 'text-indigo-400' },
                  { bg: 'bg-amber-600/10 border-amber-500/40 hover:border-amber-450', icon: '🟡', titleColor: 'text-amber-400' },
                  { bg: 'bg-emerald-600/10 border-emerald-500/40 hover:border-emerald-400', icon: '🟩', titleColor: 'text-emerald-400' }
                ].map((decor, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4.5 rounded-2xl border-2 ${decor.bg} flex items-center gap-3.5 shadow-sm transition-all`}
                  >
                    <span className="text-2xl">{decor.icon}</span>
                    <span className="text-sm font-black text-slate-100">{activeQuestion.options[idx]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Written design */}
            {activeQuestion.type === 'written' && (
              <div className="bg-slate-900 border border-indigo-900/40 p-10 rounded-3xl text-center space-y-4">
                <span className="text-6xl block animate-bounce">✏️</span>
                <p className="text-base font-black text-amber-205">سجلت المحطة سؤالاً مكتوباً ورقة مغربية ممتازة!</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-lg mx-auto">
                  يرجى صياغة الإجابة بدقة متناهية عبر شاشات المتعلمين، ومراجعتها قبل الإرسال لتكسب المجموعات كامل جواهر المحطة!
                </p>
              </div>
            )}

            {/* Oral Question */}
            {activeQuestion.type === 'oral' && (
              <div className="bg-slate-900 border border-indigo-900/40 p-10 rounded-3xl text-center space-y-4">
                <span className="text-6xl block animate-pulse">🗣️💬</span>
                <p className="text-base font-black text-amber-205">المحاججة والالتحام الشفهي المباشر!</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-lg mx-auto">
                  قفوا بكل كرامة، ألقوا الإجابة بالتعبير والمصطلح البيداغوجي المبهج أمام الرفاق. يقوم المعلم بضخ التنقيط رصيداً فوراً!
                </p>
              </div>
            )}

            {/* Real-time responses progress indicators */}
            <div className="border-t border-slate-900 pt-4 flex items-center justify-between gap-4">
              <span className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-teal-400" />
                <span>إجابات المجموعات الراهنة ({answeredCount} / {totalPlayers})</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-black text-amber-400">
                  {totalPlayers > 0 ? Math.round((answeredCount / totalPlayers) * 100) : 0}% مكتمل
                </span>
                <div className="w-44 h-2.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${totalPlayers > 0 ? (answeredCount / totalPlayers) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          {/* Running Clock Timer Right */}
          <div className="lg:col-span-1 bg-slate-950 border border-indigo-505/20 rounded-3xl p-6 shadow-2xl flex flex-col justify-center items-center text-center space-y-6 relative">
            <p className="text-xs font-black text-slate-400 tracking-wider">العد التنازلي للمحطة ⏰</p>
            <div className={`text-6xl md:text-7xl font-mono font-black select-none ${
              currentRoom.secondsRemaining <= 5 ? 'text-rose-500 animate-ping' : 'text-amber-300'
            }`}>
              {currentRoom.secondsRemaining}
            </div>
            
            {/* Display list of who answered or used magic cards */}
            <div className="w-full border-t border-slate-900 pt-4 text-right space-y-2">
              <p className="text-[9px] text-slate-450 font-black">أدوار المجموعات:</p>
              {playersList.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-[10px] font-semibold border-b border-slate-905/40 pb-1">
                  <span className="truncate max-w-[60px]">{p.avatar} {p.name}</span>
                  <span>
                    {p.answeredThisRound ? (
                      <span className="text-emerald-450 text-emerald-400 font-extrabold flex items-center gap-0.5">🟢 أرسل</span>
                    ) : (
                      <span className="text-amber-400 font-extrabold flex items-center gap-0.5">⌛ يفكر</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* QUESTION EXPIRED: REACTION AND SOLUTIONS MAP ACCORD */}
      {currentRoom.state === 'question_result' && activeQuestion && (
        <div className="bg-slate-950 border border-indigo-505/20 rounded-3xl p-8 shadow-2xl space-y-7 relative overflow-hidden">
          <div className="text-center space-y-1">
            <span className="text-5xl animate-bounce block">🎉👁️</span>
            <h2 className="text-2xl font-black text-amber-200">انتهت جولة القلعة! الجواب الذهبي الصحيح هو:</h2>
          </div>

          <div className="bg-emerald-950/40 border-2 border-emerald-500/30 p-5 rounded-2xl text-center max-w-xl mx-auto space-y-1.5 shadow">
            <p className="text-xs text-emerald-400 font-black">المعطى المنهجي الصائب:</p>
            <p className="text-lg md:text-xl font-black text-white">"{activeQuestion.options[activeQuestion.correctIndex || 0]}"</p>
          </div>

          {/* Table summary of this rounds results */}
          <div className="border-t border-slate-900 pt-6 space-y-4">
            <h4 className="text-xs text-slate-400 font-black">أختام وجواهر الجولة الحالية للمجموعات:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {playersList.map((p) => (
                <div 
                  key={p.id} 
                  className={`p-3.5 rounded-2xl border text-xs font-black flex items-center justify-between ${
                    p.isCorrect
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/25 border-rose-500/35 text-rose-350 text-rose-350'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl shrink-0">{p.avatar}</span>
                    <span className="font-extrabold truncate max-w-[100px]">{p.name}</span>
                  </div>
                  <div className="text-left font-extrabold">
                    {p.isCorrect ? (
                      <span className="text-emerald-400 block font-black">+{p.pointsGained} ذهب ⭐</span>
                    ) : p.usedShield ? (
                      <span className="text-blue-400 block font-black">🛡️ درع صد الخسارة!</span>
                    ) : (
                      <span className="text-rose-400 block font-bold">خسر -300 ذهبية ❌</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FINAL PODIUM WRAPPERS AND CONGRATS */}
      {currentRoom.state === 'finished' && (
        <div className="bg-slate-950 border border-indigo-500/20 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-8 relative overflow-hidden">
          
          <div className="space-y-2">
            <span className="text-7xl block animate-bounce">🎁👑🏆🏴‍☠️</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-amber-250">تتـويج أبطـال جـزيرة الكنـز الصفيّـة!</h2>
            <p className="text-sm text-slate-350 max-w-xl mx-auto leading-relaxed font-bold">
              نهنئكم جميعاً على فك شفرات القلاع الست بالكامل وصناعة التعلم بالمثابرة واللعب الذكي الدائم.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-3xl mx-auto pt-10 pb-4">
            {(() => {
              const sorted = [...playersList].sort((a, b) => b.score - a.score);
              const p1 = sorted[0];
              const p2 = sorted[1];
              const p3 = sorted[2];

              return (
                <>
                  {/* #2 Ranked */}
                  {p2 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full md:w-56 text-center space-y-3 flex flex-col justify-end items-center md:h-64 shadow-lg border-t-4 border-t-slate-400 order-2 md:order-1">
                      <span className="text-4xl">{p2.avatar}</span>
                      <p className="font-extrabold text-xs truncate max-w-[140px]">{p2.name}</p>
                      <p className="text-[10px] bg-slate-950 border border-slate-800 text-amber-300 px-3 py-1 rounded-full font-black -mt-1">{p2.score} ذخر ذهبي</p>
                      <div className="bg-slate-800 text-white font-black text-sm py-3.5 w-full rounded-xl uppercase">المرتبة الثانية 🥈</div>
                    </div>
                  )}

                  {/* #1 Champion Tallest */}
                  {p1 && (
                    <div className="bg-slate-900 border border-amber-400 rounded-2xl p-6 w-full md:w-64 text-center space-y-4 flex flex-col justify-end items-center md:h-76 shadow-2xl border-t-4 border-t-amber-400 order-1 md:order-2 ring-4 ring-amber-400">
                      <span className="text-5xl animate-bounce">🥇🥇</span>
                      <span className="text-5xl block -mt-2">{p1.avatar}</span>
                      <p className="font-black text-sm truncate max-w-[160px] text-teal-300">{p1.name}</p>
                      <p className="text-xs bg-amber-400 text-slate-950 px-4 py-1 rounded-full font-black -mt-1.5">{p1.score} ذهب جبار</p>
                      <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-base py-4 w-full rounded-xl shadow">البطل الذهبي للجزيرة 👑🏆</div>
                    </div>
                  )}

                  {/* #3 Ranked */}
                  {p3 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full md:w-52 text-center space-y-3 flex flex-col justify-end items-center md:h-56 shadow-lg border-t-4 border-t-amber-800 order-3">
                      <span className="text-4xl">{p3.avatar}</span>
                      <p className="font-extrabold text-xs truncate max-w-[130px]">{p3.name}</p>
                      <p className="text-[10px] bg-slate-950 border border-slate-800 text-amber-300 px-3 py-1 rounded-full font-black -mt-1">{p3.score} ذخر ذهبي</p>
                      <div className="bg-amber-955 bg-amber-900 text-white font-black text-xs py-3 w-full rounded-xl uppercase">المرتبة الثالثة 🥉</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <p className="text-xs text-slate-405 font-bold">
            انتهت رحلة الاستكشاف مغامرة اليوم. مبارك لفرسان الفصل! 💾✨
          </p>
        </div>
      )}

    </div>
  );
}
