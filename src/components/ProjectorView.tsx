import React, { useState, useEffect } from 'react';
import { 
  Trophy, Users, Check, X, Clock, Sparkles, AlertCircle, ArrowLeft, 
  Tv, Play, Award, Volume2, Gamepad2, Layers 
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

  // Monitor room PIN stored in local space if any
  useEffect(() => {
    const savedPin = localStorage.getItem('school_projector_active_room_pin');
    if (savedPin) {
      setPinInput(savedPin);
      setLoading(true);
      const unsubscribe = listenToRoom(savedPin, (room) => {
        setCurrentRoom(room);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pinInput.trim()) {
      setError('المرجو إدخال رمز الغرفة PIN لتنشيط الشاشة الكبرى!');
      return;
    }

    setLoading(true);
    localStorage.setItem('school_projector_active_room_pin', pinInput.trim());
    
    const unsubscribe = listenToRoom(pinInput.trim(), (room) => {
      setLoading(false);
      if (!room) {
        setError('تعذر العثور على هذه الحصة. يرجى مراجعة الأستاذ للتأكد من الرقم.');
        setCurrentRoom(null);
        return;
      }
      setCurrentRoom(room);
    });

    return () => unsubscribe();
  };

  const handleDisconnect = () => {
    localStorage.removeItem('school_projector_active_room_pin');
    setCurrentRoom(null);
    setPinInput('');
  };

  // Extract states details
  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  const totalPlayers = currentRoom ? Object.keys(currentRoom.players).length : 0;
  const playersList = currentRoom ? Object.values(currentRoom.players) : [];
  const answeredCount = currentRoom ? playersList.filter((p: any) => p.answeredThisRound).length : 0;

  // Render Login pin input of projector first
  if (!currentRoom) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 bg-slate-900" dir="rtl">
        <div id="projector-pin-card" className="bg-slate-950 text-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-md w-full border border-slate-800 space-y-6 text-center">
          <div className="space-y-3">
            <div className="inline-flex bg-slate-800 p-4 rounded-full border border-slate-700 text-teal-400">
              <Tv className="w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-xl md:text-2xl font-black">شاشـة العـرض الكبـرى للقسم 📺</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto">
              أدخل رمز PIN الذي قمت بتشكيله في لوحة الأستاذ لربط شاشة الإسقاط (البروجيكتور) لمتابعة التناقش المباشر والمجموعات.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1.5">
              <input
                type="number"
                placeholder="أدخل الرمز المكون من 4 أرقام"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-[0.2em] font-mono font-black text-2xl p-3.5 bg-slate-900 border-2 border-slate-750 focus:border-teal-400 rounded-2xl outline-none transition-all"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-rose-450 font-black flex items-center justify-center gap-1 bg-rose-950/40 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm transition-all shadow-md hover:shadow-teal-900/10 cursor-pointer"
            >
              <span>{loading ? 'جاري الاتصال بقاعدة البيانات...' : 'تنشيط شاشة الإسقاط التفاعلية ✨'}</span>
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
    <div className="w-full max-w-6xl mx-auto px-4 py-8 text-right space-y-6 text-white" dir="rtl">
      
      {/* Upper info panel */}
      <header className="bg-slate-950 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20 text-teal-400">
            <Tv className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black">منصة الإسقاط المباشر والصبورة 🎥</h1>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-3 py-0.5 rounded-full font-black animate-pulse">
                متصل وبث فوري 🟢
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-1">
              اسم التحدي: {" "}
              <span className="text-teal-300 font-black">{currentRoom.activeQuiz?.title}</span>
            </p>
          </div>
        </div>

        {/* Big PIN instructions on sides */}
        <div className="flex items-center gap-4">
          <div className="text-center md:text-left bg-slate-900 py-2.5 px-4 rounded-2xl border border-slate-800">
            <p className="text-[9px] text-slate-400 font-extrabold">الالتحاق للحصة بالرمز:</p>
            <p className="text-2xl font-mono text-teal-350 tracking-wider font-extrabold">{currentRoom.pin}</p>
          </div>

          <button
            onClick={handleDisconnect}
            className="text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-350 px-4 py-3 rounded-2xl font-black transition-all"
          >
            قطع الاتصال 🔌
          </button>
        </div>
      </header>

      {/* LOBBY / SETUP WAITING SCREEN */}
      {currentRoom.state === 'waiting' && (
        <div className="bg-slate-950 rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-805 text-center min-h-[500px] flex flex-col justify-between items-center space-y-8">
          
          <div className="space-y-3">
            <span className="text-6xl animate-bounce">🏫🎮🧑‍🏫</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">مرحبا بكم في حصتنا التفاعلية!</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed font-semibold">
              افتح لوحة الدخول، أدخل اسمك واسم فريقك وانضم فوراً للتتويج.
            </p>
          </div>

          {/* Large connection board */}
          <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-3xl inline-block max-w-md w-full space-y-3">
            <p className="text-xs text-teal-400 font-black uppercase tracking-wider">طلب انضمام التلاميذ الفوري</p>
            <p className="text-5xl md:text-6xl font-extrabold tracking-[0.2em] font-mono text-white animate-pulse">{currentRoom.pin}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
              (اكتب هذا الرقم PIN في خانة رقم الغرفة لتسجيل الحضور)
            </p>
          </div>

          {/* Connected players list in visual cards */}
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-400" />
                <span>فرسان وقادة الصف المتصلين ({totalPlayers})</span>
              </span>
              <span className="text-[10px] text-teal-350 tracking-widest font-black animate-pulse">شاشات القسم الكبرى</span>
            </div>

            {totalPlayers === 0 ? (
              <div className="py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed text-slate-500 text-xs font-black">
                بانتظار جلوس الطلاب والتحاق مجموعات الغرفة...🍉⏳
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {playersList.map((p: any) => (
                  <div key={p.id} className="bg-slate-900 border border-slate-800 py-3.5 px-3 rounded-2xl flex flex-col items-center gap-2 shadow-sm transition-transform hover:scale-105">
                    <span className="text-3xl">{p.avatar}</span>
                    <span className="text-xs font-black text-white truncate max-w-[110px]">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* QUESTION INTRO TIMER */}
      {currentRoom.state === 'question_countdown' && (
        <div className="bg-slate-950 rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-805 text-center min-h-[400px] flex flex-col justify-center items-center space-y-5">
          <span className="text-7xl">⚡</span>
          <h2 className="text-2xl md:text-3xl font-black text-teal-300">السؤال القادم في ثوانٍ معدودة...</h2>
          <p className="text-sm text-slate-400 max-w-sm font-semibold">استعدوا! دققوا في الموضوع واستحضروا المفاهيم والذكاء.</p>
          <div className="text-8xl font-mono font-black text-white animate-ping">{currentRoom.secondsRemaining}</div>
        </div>
      )}

      {/* ACTIVE PRESENTING QUESTION PANEL */}
      {currentRoom.state === 'question_active' && activeQuestion && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          
          {/* Main Question view left */}
          <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 flex flex-col justify-between">
            <h2 className="text-xl md:text-2xl font-black text-white leading-relaxed bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              {activeQuestion.text}
            </h2>

            {/* MCQ Colored Options */}
            {activeQuestion.type === 'mcq' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { bg: 'bg-rose-500/20 border-rose-500/50', icon: '🔺', titleColor: 'text-rose-400' },
                  { bg: 'bg-indigo-505/20 border-indigo-505/50 border-indigo-500/50', icon: '🔷', titleColor: 'text-indigo-400' },
                  { bg: 'bg-amber-555/20 border-amber-555/50 border-amber-500/50', icon: '🟡', titleColor: 'text-amber-400' },
                  { bg: 'bg-emerald-600/20 border-emerald-600/50', icon: '🟩', titleColor: 'text-emerald-400' }
                ].map((decor, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4.5 rounded-2xl border-2 ${decor.bg} flex items-center gap-3.5 shadow-sm`}
                  >
                    <span className="text-2xl">{decor.icon}</span>
                    <span className={`text-sm font-black text-slate-100`}>{activeQuestion.options[idx]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Written Question design */}
            {activeQuestion.type === 'written' && (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3">
                <span className="text-5xl block animate-pulse">✏️</span>
                <p className="text-base font-black text-teal-300">سؤال خطي مكتوب على منصاتكم!</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-md mx-auto">
                  يرجى تدوين الإجابة في المربع النصي الموجود بهواتفهم بدقة متناهية وإرسالها فوراً للأستاذ للتنقيط التلقائي.
                </p>
              </div>
            )}

            {/* Oral Question design */}
            {activeQuestion.type === 'oral' && (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-3">
                <span className="text-5xl block">🗣️💬</span>
                <p className="text-base font-black text-teal-300">المشاركة الشفهية والمحاورة!</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-md mx-auto">
                  اصغوا لبعض وشجِّعوا البطل المتكلم. سيقوم الأستاذ المشرف بضخ النقاط مباشرة من لوحته الخاصة.
                </p>
              </div>
            )}

            {/* Progress indicators */}
            <div className="border-t border-slate-900 pt-4 flex items-center justify-between gap-4">
              <span className="text-xs font-black text-slate-400">استجابة للتحدي:</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-black text-teal-300">{answeredCount}</span>
                <span className="text-xs text-slate-450 font-semibold">من أصل {totalPlayers} مجموعات صحية</span>
                <div className="w-40 h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${totalPlayers > 0 ? (answeredCount / totalPlayers) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          {/* Running Clock Right */}
          <div className="lg:col-span-1 bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-center items-center text-center space-y-4">
            <p className="text-xs font-black text-slate-400 tracking-wider">المؤقت التنازلي التفاعلي ⏰</p>
            <div className={`text-6xl md:text-7xl font-mono font-black py-4 select-none ${
              currentRoom.secondsRemaining <= 5 ? 'text-rose-550 text-rose-500 animate-ping' : 'text-teal-300'
            }`}>
              {currentRoom.secondsRemaining}
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold max-w-[130px] block">
              الوقت كالسيف في رصد العلامات مضيافاً
            </p>
          </div>

        </div>
      )}

      {/* QUESTION COMPLETED: SHOW CORRECT OPTION AND STATISTICS PIE */}
      {currentRoom.state === 'question_result' && activeQuestion && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <span className="text-4xl">👁️✅🎉</span>
            <h2 className="text-xl md:text-2xl font-black text-white">انتهى الوقت المقدر والحل الصحيح هو:</h2>
          </div>

          <div className="bg-emerald-900/20 border-2 border-emerald-500/40 p-5 rounded-2xl text-center max-w-xl mx-auto space-y-2">
            <p className="text-xs text-emerald-400 font-black">الجواب البيداغوجي المعتمد في المنهاج:</p>
            <p className="text-lg md:text-xl font-bold text-white">"{activeQuestion.options[activeQuestion.correctIndex || 0]}"</p>
          </div>

          {/* Connected players stats summary grid */}
          <div className="border-t border-slate-900 pt-6 space-y-4">
            <h4 className="text-xs text-slate-400 font-black">تقرير ملخص المشاركين في هذه الجولة:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {playersList.map((p: any) => (
                <div 
                  key={p.id} 
                  className={`p-3.5 rounded-2xl border text-xs font-black flex items-center justify-between ${
                    p.isCorrect
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-450 text-emerald-300'
                      : 'bg-rose-950/25 border-rose-500/30 text-rose-450 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl shrink-0">{p.avatar}</span>
                    <span className="font-extrabold truncate max-w-[110px]">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-bold">
                    {p.isCorrect ? `+${p.pointsGained} نقطة ⭐` : 'لم يصب الجواب'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MID-GAME LEADERBOARD VIEW */}
      {currentRoom.state === 'leaderboard' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-6">
          <div className="space-y-1">
            <span className="text-5xl animate-bounce block">🏆🥇🎖️</span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white">أبطال الصدارة والترتيب المباشر!</h2>
            <p className="text-sm text-slate-400 font-semibold">ملخص درجات المجموعات في هذه اللحظة:</p>
          </div>

          <div className="max-w-xl mx-auto w-full space-y-3.5 pt-4">
            {playersList
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 5)
              .map((p: any, idx) => (
                <div 
                  key={p.id} 
                  className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-teal-500/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-800 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="text-3xl shrink-0">{p.avatar}</span>
                    <span className="font-extrabold text-sm text-white truncate max-w-xs">{p.name}</span>
                  </div>
                  <span className="font-black text-sm bg-teal-500/10 text-teal-400 border border-teal-500/20 px-4 py-1.5 rounded-xl">
                    {p.score} نقطة🎖️
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* FINAL PODIUM WRAPPERS AND CONGRATS */}
      {currentRoom.state === 'finished' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl text-center space-y-8 animate-fade-in relative overflow-hidden">
          
          <div className="space-y-2">
            <span className="text-6xl block">🌟🏆🎉✨</span>
            <h2 className="text-2xl md:text-4xl font-black text-white">تتـويج أبطـال كاهـوت الصـف المـغربـي!</h2>
            <p className="text-sm text-slate-400 font-semibold leading-relaxed max-w-xl mx-auto">
              نهنئ المجموعات الفائزة وجميع المشاركين على روح التعلم والمثابرة اليوم.
            </p>
          </div>

          {/* Giant Olympic Podium structures */}
          <div className="flex flex-col md:flex-row justify-center items-end gap-6 max-w-3xl mx-auto pt-10 pb-4">
            {(() => {
              const sorted = [...playersList].sort((a: any, b: any) => b.score - a.score);
              const p1 = sorted[0];
              const p2 = sorted[1];
              const p3 = sorted[2];

              return (
                <>
                  {/* Ranked #2 */}
                  {p2 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full md:w-56 text-center space-y-3 flex flex-col justify-end items-center md:h-64 shadow-lg border-t-4 border-t-slate-350 order-2 md:order-1">
                      <span className="text-4xl">{p2.avatar}</span>
                      <p className="font-extrabold text-xs truncate max-w-[150px]">{p2.name}</p>
                      <p className="text-[10px] bg-slate-100 text-slate-950 px-2.5 py-0.5 rounded-full font-black -mt-1">{p2.score} نقطة</p>
                      <div className="bg-slate-805 bg-slate-800 text-white font-black text-base py-3 w-full rounded-xl">المرتبة الثانية 🥈</div>
                    </div>
                  )}

                  {/* Ranked #1 (Center and Tallest) */}
                  {p1 && (
                    <div className="bg-slate-900 border border-slate-750 rounded-2xl p-6 w-full md:w-64 text-center space-y-4 flex flex-col justify-end items-center md:h-76 shadow-2xl border-t-4 border-t-amber-400 order-1 md:order-2 ring-2 ring-amber-300">
                      <span className="text-5xl animate-bounce">🥇</span>
                      <span className="text-5xl block -mt-2">{p1.avatar}</span>
                      <p className="font-exrabold text-sm truncate max-w-[170px] font-black text-teal-300">{p1.name}</p>
                      <p className="text-xs bg-amber-400 text-slate-950 px-3 py-1 rounded-full font-black -mt-1.5">{p1.score} نقطة جبارة</p>
                      <div className="bg-amber-400 text-slate-950 font-black text-lg py-4.5 w-full rounded-xl shadow-lg">البطل الذهبي للقسم 👑</div>
                    </div>
                  )}

                  {/* Ranked #3 */}
                  {p3 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full md:w-52 text-center space-y-3 flex flex-col justify-end items-center md:h-56 shadow-lg border-t-4 border-t-amber-800 order-3">
                      <span className="text-4xl">{p3.avatar}</span>
                      <p className="font-extrabold text-xs truncate max-w-[140px]">{p3.name}</p>
                      <p className="text-[10px] bg-slate-100 text-slate-950 px-2.5 py-0.5 rounded-full font-black -mt-1">{p3.score} نقطة</p>
                      <div className="bg-amber-805 bg-amber-900 text-white font-black text-xs py-3 w-full rounded-xl">المرتبة الثالثة 🥉</div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <p className="text-[11px] text-slate-400 font-bold">
            انتهت الحصة. مبارك للفائزين! 💻✨
          </p>
        </div>
      )}

    </div>
  );
}
