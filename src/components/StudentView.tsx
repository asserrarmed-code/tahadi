import React, { useState, useEffect } from 'react';
import { 
  Users, Check, X, Clock, AlertCircle, HelpCircle, Trophy, Sparkles, 
  Send, Brain, ArrowLeft, Volume2, ShieldAlert, Zap, Timer, HelpCircle as HintIcon,
  Shield, Flame, Sparkle
} from 'lucide-react';
import { Room, Player, Question } from '../types';
import { listenToRoom, joinPlayer, submitStudentAnswer, usePowerup } from '../lib/firebase';
import { MOROCCAN_AVATARS } from '../data';

interface StudentViewProps {
  onBackToMain: () => void;
}

export default function StudentView({ onBackToMain }: StudentViewProps) {
  // Local student credentials
  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('school_stud_playerId'));
  const [roomPin, setRoomPin] = useState<string>(() => localStorage.getItem('school_stud_room_pin') || '');
  const [studentName, setStudentName] = useState(() => localStorage.getItem('school_stud_name') || '');
  const [studentAvatar, setStudentAvatar] = useState(() => localStorage.getItem('school_stud_avatar') || '🦁');

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Written answer entry
  const [writtenInput, setWrittenInput] = useState('');
  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState(false);

  // Active earthquake shake feedback
  const [shakeScreen, setShakeScreen] = useState(false);

  // Listen to active room if registered
  useEffect(() => {
    if (roomPin && playerId) {
      const unsubscribe = listenToRoom(roomPin, (roomDetail) => {
        if (!roomDetail) {
          setError('انتهت الغرفة أو مَسَحَها الأستاذ 🛑');
          setCurrentRoom(null);
          return;
        }
        setCurrentRoom(roomDetail);
        
        // Match submitted state
        const pState = roomDetail.players[playerId];
        if (pState) {
          setHasSubmittedThisRound(pState.answeredThisRound || false);
        }
      });
      return () => unsubscribe();
    }
  }, [roomPin, playerId]);

  // Handle question reset For inputs and feedback
  useEffect(() => {
    if (currentRoom) {
      if (currentRoom.state === 'question_countdown' || currentRoom.state === 'waiting') {
        setWrittenInput('');
        setHasSubmittedThisRound(false);
      }
    }
  }, [currentRoom?.currentQuestionIndex, currentRoom?.state]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roomPin.trim() || !studentName.trim()) {
      setError('المرجو ملء جميع المعلومات للاتصال بالدورة التعليمية!');
      return;
    }

    setLoading(true);
    try {
      const { playerId: responsePid, room } = await joinPlayer(roomPin.trim(), studentName.trim(), studentAvatar);
      
      setPlayerId(responsePid);
      localStorage.setItem('school_stud_playerId', responsePid);
      localStorage.setItem('school_stud_room_pin', roomPin.trim());
      localStorage.setItem('school_stud_name', studentName.trim());
      localStorage.setItem('school_stud_avatar', studentAvatar);
      
      setCurrentRoom(room);
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالغرفة. تأكد من إدخال الرمز PIN الصحيح المعروض.');
    } finally {
      setLoading(false);
    }
  };

  const handleExit = () => {
    if (confirm('هل ترغب في مغادرة سفينة المغامرة هذه والعودة للبوابة؟')) {
      localStorage.removeItem('school_stud_playerId');
      localStorage.removeItem('school_stud_room_pin');
      setPlayerId(null);
      setCurrentRoom(null);
      onBackToMain();
    }
  };

  const handleSendMcqAnswer = async (idx: number) => {
    if (!currentRoom || !playerId || hasSubmittedThisRound) return;
    try {
      setHasSubmittedThisRound(true);
      await submitStudentAnswer(currentRoom.pin, playerId, idx);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء إرسال الجواب.');
      setHasSubmittedThisRound(false);
    }
  };

  const handleSendWrittenAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoom || !playerId || !writtenInput.trim() || hasSubmittedThisRound) return;
    try {
      setHasSubmittedThisRound(true);
      await submitStudentAnswer(currentRoom.pin, playerId, null, writtenInput.trim());
    } catch (e: any) {
      setError(e.message || 'خطأ في إرسال المذكرة المكتوبة.');
      setHasSubmittedThisRound(false);
    }
  };

  // Powerup trigger helpers
  const handleTriggerPhilosopher = async () => {
    if (!currentRoom || !playerId || !activeQuestion || hasSubmittedThisRound) return;
    const player = currentRoom.players[playerId];
    if (player?.usedPhilosopher) return;

    try {
      await usePowerup(currentRoom.pin, playerId, 'philosopher');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerShield = async () => {
    if (!currentRoom || !playerId || hasSubmittedThisRound) return;
    const player = currentRoom.players[playerId];
    if (player?.usedShield) return;

    try {
      await usePowerup(currentRoom.pin, playerId, 'shield');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerTimeQuake = async () => {
    if (!currentRoom || !playerId) return;
    const player = currentRoom.players[playerId];
    if (player?.usedTimeQuake) return;

    try {
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 800);
      await usePowerup(currentRoom.pin, playerId, 'timeQuake');
    } catch (e) {
      console.error(e);
    }
  };

  // Extract variables
  const activeQuestion = currentRoom && currentRoom.activeQuiz && currentRoom.currentQuestionIndex >= 0
    ? currentRoom.activeQuiz.questions[currentRoom.currentQuestionIndex]
    : null;

  const currentPlayer = currentRoom && playerId ? currentRoom.players[playerId] : null;

  // Render Login state first
  if (!playerId || !currentRoom) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950" dir="rtl">
        <div className="bg-slate-900/90 border border-indigo-500/30 text-right rounded-3xl p-6 md:p-8 shadow-2xl max-w-sm w-full space-y-6 backdrop-blur-md">
          <div className="text-center space-y-2">
            <span className="text-5xl animate-bounce inline-block">⛵🧭</span>
            <h2 className="text-xl md:text-2xl font-black text-amber-200 tracking-wide">تسجيل دخول المغامرين</h2>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              اكتب رمز الغرفة واللقب لتلتحق بطاقم المجموعات، ونوزّع عليك بطاقات الدعم السحرية لخريطة الكنز!
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-teal-300">رمز الغرفة (Room PIN):</label>
              <input
                type="number"
                placeholder="0000"
                value={roomPin}
                onChange={(e) => setRoomPin(e.target.value)}
                className="w-full text-center tracking-[0.25em] font-mono font-black text-2xl p-3 bg-slate-950/80 border-2 border-indigo-500/30 focus:border-amber-400 text-amber-300 rounded-2xl outline-none transition-all placeholder-indigo-900"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-teal-300">لقب البطل(ة) أو المجموعة:</label>
              <input
                type="text"
                placeholder="اكتب اسم مجموعتك الحماسي"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full text-xs font-bold p-3.5 bg-slate-950/80 border border-indigo-500/30 text-slate-200 focus:border-emerald-400 rounded-2xl outline-none"
                disabled={loading}
                maxLength={12}
              />
            </div>

            {/* Avatar Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-teal-300 block">شعار المجموعات المقررة:</label>
              <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-950/60 rounded-2xl border border-indigo-900/50">
                {MOROCCAN_AVATARS.map((av) => (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => setStudentAvatar(av.char)}
                    className={`p-2 text-xl rounded-xl transition-transform cursor-pointer ${
                      studentAvatar === av.char 
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 scale-110 shadow-lg font-black' 
                        : 'hover:bg-slate-800 text-indigo-200 bg-slate-900/40'
                    }`}
                    title={av.name}
                  >
                    {av.char}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-rose-500/30 text-rose-300 rounded-2xl text-[11px] font-bold text-center leading-relaxed">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-4 rounded-2xl font-black text-xs text-slate-950 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? 'bg-slate-700 text-slate-400 pointer-events-none'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-teal-400 hover:scale-[1.02]'
              }`}
            >
              <span>{loading ? 'جاري العثور على ساحة المغامرة...' : 'رسـوّ على جزيرة الكنز 🏝️'}</span>
            </button>
          </form>

          <button
            onClick={onBackToMain}
            className="text-[10px] text-slate-400 hover:text-white text-center block mx-auto underline mt-2"
          >
            الرجوع للصفحة الرئيسية للبوابة
          </button>
        </div>
      </div>
    );
  }

  // Active student playing screen
  return (
    <div className={`w-full max-w-lg mx-auto p-4 text-right space-y-4 transition-all ${shakeScreen ? 'animate-bounce' : ''}`} dir="rtl">
      
      {/* Dynamic Profile bar */}
      <header className="bg-slate-900/95 border border-amber-500/30 text-white rounded-3xl p-4 flex items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-4xl animate-pulse block">{currentPlayer?.avatar}</span>
            {currentPlayer?.usedShield && (
              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5 border border-white animate-spin" style={{ animationDuration: '3s' }}>
                <Shield className="w-3" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-sm text-yellow-200">{currentPlayer?.name}</h3>
              {currentPlayer?.streak && currentPlayer.streak > 0 ? (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-0.5 animate-pulse">
                  <Flame className="w-2.5 h-2.5 text-red-500" />
                  <span>{currentPlayer.streak}</span>
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-teal-300 font-extrabold mt-0.5">
              جواهر الرصيد: {currentPlayer?.score || 0} ذهبية 🪙
            </p>
          </div>
        </div>

        <button 
          onClick={handleExit}
          className="text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl font-bold transition-all border border-slate-755"
        >
          مغادرة الحصة 🚪
        </button>
      </header>

      {/* LOBBY / WAITING HARBOR */}
      {currentRoom.state === 'waiting' && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/20 text-center py-12 space-y-4">
          <div className="relative inline-block">
            <span className="text-6xl animate-bounce block">⛵</span>
            <div className="absolute -top-3 -right-3 animate-pulse bg-emerald-500 text-slate-950 font-black rounded-full px-2 py-0.5 text-[9px]">
              جاهز للإبحار!
            </div>
          </div>
          <h2 className="text-xl font-black text-amber-200">سفينتك راسية في المرفأ الرئيسي! ⚓</h2>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold max-w-xs mx-auto">
            مرحباً بك يا بطل! لقد تم تسجيل مجموعتك بنجاح. بمجرد أن يختار الأستاذ محطة من خريطة الكنز، تشتعل الملحمة هنا وتظهر التحديات فوراً!
          </p>
          <div className="inline-flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-full text-[10px] font-black text-teal-300 border border-indigo-900">
            <span>رقم غرفتك:</span>
            <span className="font-mono text-xs">{currentRoom.pin}</span>
          </div>
        </div>
      )}

      {/* COUNTDOWN START */}
      {currentRoom.state === 'question_countdown' && (
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl text-center py-12 space-y-4 border border-rose-500/20">
          <span className="text-3xl animate-pulse text-amber-300 block">استعد للتحدي القادم! 🔥</span>
          <p className="text-xs text-slate-400 font-bold">بوابة جزيرة {currentRoom.activeSubject || 'التحدي'} تفتح الآن...</p>
          <div className="w-20 h-20 rounded-full bg-slate-950 border-4 border-amber-400 flex items-center justify-center mx-auto shadow-xl">
            <span className="text-3xl font-black font-mono text-amber-300">{currentRoom.secondsRemaining}</span>
          </div>
        </div>
      )}

      {/* ACTIVE RUNNING QUESTION INTERFACE */}
      {currentRoom.state === 'question_active' && activeQuestion && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Header block with timers */}
          <div className="bg-slate-900/95 border border-indigo-700/30 rounded-3xl p-4 text-center space-y-2 relative shadow-lg">
            {currentRoom.multiplierActive && (
              <div className="absolute top-3 left-3 bg-red-500 text-white py-1 px-2.5 rounded-full text-[9px] font-black animate-pulse border border-red-400 flex items-center gap-1">
                <Flame className="w-3 h-3" />
                <span>مضاعفة دبل: مخاطرة!</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 border-b border-slate-850 pb-2">
              <span>وزن المادة: {activeQuestion.points} نقطة</span>
              <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-500/20">
                <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>مؤقت القسم: {currentRoom.secondsRemaining}ث</span>
              </span>
            </div>
            
            <p className="font-extrabold text-sm text-yellow-105 text-amber-100 py-2 leading-relaxed">
              {activeQuestion.text}
            </p>
          </div>

          {/* ACTIVE POWER-UPS CARDS PANEL */}
          <div id="assist-powerups" className="bg-slate-900/95 border border-amber-500/20 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-[10px] font-black text-slate-300">حقيبة الأدوات السحرية المتاحة (مرة واحدة):</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Philosopher's Smart Hint */}
              <button
                type="button"
                onClick={handleTriggerPhilosopher}
                disabled={!!currentPlayer?.usedPhilosopher || hasSubmittedThisRound}
                className={`p-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-1 transition-all border ${
                  currentPlayer?.usedPhilosopher
                    ? 'bg-slate-950/40 text-slate-550 border-slate-800 opacity-40 cursor-not-allowed'
                    : 'bg-emerald-900/20 hover:bg-emerald-900/35 text-emerald-350 border-emerald-500/30 hover:border-emerald-400 shadow-md'
                }`}
                title="استدعاء تلميح مغربي حكيم من ذكاء الـ Gemini"
              >
                <Brain className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                <span>🔮 بطاقة الفيلسوف</span>
              </button>

              {/* Protection Shield */}
              <button
                type="button"
                onClick={handleTriggerShield}
                disabled={!!currentPlayer?.usedShield || hasSubmittedThisRound}
                className={`p-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-1 transition-all border ${
                  currentPlayer?.usedShield
                    ? 'bg-slate-950/40 text-slate-550 border-slate-805 opacity-40 cursor-not-allowed'
                    : 'bg-blue-900/20 hover:bg-blue-900/35 text-blue-350 border-blue-500/30 hover:border-blue-400 shadow-md'
                }`}
                title="بطاقة تحمي نتيجتك من حسم النقاط عند الخطأ"
              >
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <span>🛡️ بطاقة الدرع</span>
              </button>

              {/* Time Quake */}
              <button
                type="button"
                onClick={handleTriggerTimeQuake}
                disabled={!!currentPlayer?.usedTimeQuake || hasSubmittedThisRound}
                className={`p-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-1 transition-all border ${
                  currentPlayer?.usedTimeQuake
                    ? 'bg-slate-950/40 text-slate-550 border-slate-805 opacity-40 cursor-not-allowed'
                    : 'bg-amber-900/20 hover:bg-amber-900/35 text-amber-350 border-amber-500/30 hover:border-amber-400 shadow-md'
                }`}
                title="إحداث زلزال وقتي وإضافة 15 ثانية للعداد المباشر"
              >
                <Timer className="w-4 h-4 text-amber-400 shrink-0" />
                <span>🌋 زلزال الوقت</span>
              </button>
            </div>

            {/* Smart Hint Bubble from Gemini */}
            {currentPlayer?.usedPhilosopher && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 text-emerald-250 rounded-xl text-[11px] font-bold text-center leading-relaxed animate-pulse">
                <span className="text-emerald-400 font-extrabold flex items-center justify-center gap-1 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-350" />
                  حكمة الفيلسوف Gemini:
                </span>
                👉 {currentPlayer?.philosopherHint || 'فكر بذكاء، الجواب أمامك في مقتطفات السؤال!'}
              </div>
            )}
          </div>

          {/* DYNAMIC VIEW FOR INTERACTIVE PARTICIPATION */}
          
          {/* MCQ Options with custom badges */}
          {activeQuestion.type === 'mcq' && (
            <div className="space-y-2.5">
              {hasSubmittedThisRound ? (
                <div className="py-12 text-center bg-slate-900 border border-indigo-500/20 rounded-3xl space-y-3 shadow-md">
                  <span className="text-5xl animate-bounce block">📤</span>
                  <p className="text-xs font-black text-emerald-400 block">لقد أرسلت إجابتك بنجاح!</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">في انتظار انتهاء المؤقت التنازلي للقسم أو إغلاق السؤال من الأستاذ.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  {[
                    { bg: 'bg-rose-600 hover:bg-rose-500', border: 'border-rose-800', icon: '🔺' },
                    { bg: 'bg-indigo-700 hover:bg-indigo-600', border: 'border-indigo-900', icon: '🔷' },
                    { bg: 'bg-amber-600 hover:bg-amber-500', border: 'border-amber-800', icon: '🟡' },
                    { bg: 'bg-emerald-700 hover:bg-emerald-600', border: 'border-emerald-900', icon: '🟩' }
                  ].map((style, oi) => {
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => handleSendMcqAnswer(oi)}
                        className={`w-full min-h-[95px] p-4 text-white font-extrabold text-xs rounded-2xl border-b-4 flex flex-col justify-between items-center transition-all ${style.bg} ${style.border} hover:shadow-lg active:scale-95 cursor-pointer`}
                      >
                        <span className="text-lg">{style.icon}</span>
                        <span className="text-center font-black mt-2 leading-snug">{activeQuestion.options[oi]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Written Answer entry */}
          {activeQuestion.type === 'written' && (
            <div className="bg-slate-900 p-5 shadow-lg border border-indigo-500/20 rounded-3xl space-y-3">
              {hasSubmittedThisRound ? (
                <div className="py-6 text-center space-y-3">
                  <span className="text-3xl animate-bounce">✏️</span>
                  <p className="text-xs font-black text-emerald-400">تم تسجيل جوابك الخطي بنجاح!</p>
                  <p className="text-[10px] text-slate-400">شاهد الشاشة الكبرى لتقييم الحكيم وإعلان التصفيات.</p>
                </div>
              ) : (
                <form onSubmit={handleSendWrittenAnswer} className="space-y-4">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-xs text-yellow-250 font-black block">اكتب إجابتك بدقة هنا:</label>
                    <input
                      type="text"
                      placeholder="اكتب المعطى أو الكلمة بتركيز تام..."
                      value={writtenInput}
                      onChange={(e) => setWrittenInput(e.target.value)}
                      className="w-full text-center text-sm font-black p-3.5 bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-650 rounded-2xl outline-none focus:border-emerald-400 transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 font-black text-xs text-slate-950 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-slate-950" />
                    <span>أرسل جوابي الخطي للأستاذ ✏️</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Oral view */}
          {activeQuestion.type === 'oral' && (
            <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-indigo-500/20 shadow-lg text-center space-y-4">
              <span className="text-5xl animate-pulse block">🗣️🗣️</span>
              <h4 className="font-extrabold text-base text-amber-200 leading-snug">تنبيه شفهي: استعــد لإلقاء المشاركة! 👋</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold max-w-sm mx-auto">
                هذا سؤال شفهي! قف مع مجموعتك والفظ إجابتك بصوت جهوري للأستاذ. سيقوم الأستاذ بالتنقيط اليدوي العادل من كمبيوتره ليضاف لرصيدك مباشرة!
              </p>
            </div>
          )}

        </div>
      )}

      {/* QUESTION TIME EXPIRED RESULT */}
      {currentRoom.state === 'question_result' && currentPlayer && (
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-505/20 text-center py-12 space-y-6">
          {currentPlayer.isCorrect ? (
            <div className="space-y-3">
              <span className="text-5xl animate-bounce block">✨🎉🟢</span>
              <h2 className="text-xl font-black text-emerald-400">إجابة صحيحة وموفقة! أحسنت</h2>
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/20 rounded-2xl inline-block">
                <p className="text-xs text-slate-400 font-bold">جواهر الذهب المكتسبة:</p>
                <p className="text-2xl font-black text-amber-400">+{currentPlayer.pointsGained} ذهبية ⭐</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <span className="text-5xl block animate-shake">🛡️❌</span>
              <h2 className="text-xl font-bold text-rose-450">محاولة جيدة، لكن غير موفقة!</h2>
              <p className="text-xs text-slate-300 font-bold max-w-xs mx-auto">
                حظ أوفر في المحطة التالية! تذكر القواعد المنهجية وركّز جيداً مع المجموعة.
              </p>
              
              {currentPlayer?.usedShield ? (
                <div className="p-3 bg-blue-950/65 border border-blue-500/30 rounded-xl inline-block text-[11px] font-bold text-blue-300 animate-pulse">
                  🛡️ تم صد الخسارة! بطاقة الدرع حمت رصيدك من خسارة (-300) ذهبية في هذه المحاولة!
                </div>
              ) : (
                <div className="p-3 bg-red-950/65 border border-rose-500/30 rounded-xl inline-block text-[11px] font-bold text-rose-300">
                  ❌ خسرت (-300) ذهبية بسبب الخطأ. استخدم بطاقة الدرع للمحطة القادمة!
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-800 pt-3">
            <p className="text-[10px] text-amber-300 font-black animate-pulse">
              انظر إلى البروجيكتور لمشاهدة المجموعات الهاربة أو المتقدمة بالخريطة!
            </p>
          </div>
        </div>
      )}

      {/* LEADERBOARD STANDBY VIEW */}
      {currentRoom.state === 'leaderboard' && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-505/20 text-center py-12 space-y-4">
          <span className="text-5xl animate-bounce block">🏆🔥🎖️</span>
          <h2 className="text-lg font-black text-amber-200 leading-snug">شاشة الرصيد نشطة الآن!</h2>
          <p className="text-xs text-slate-350 leading-relaxed font-semibold max-w-xs mx-auto">
            تابع تقدّم مجموعتكم نحو الكنز المعرفي على الصبورة وقارن ترتيبكم لمعرفة من يتصدر الحلف الآن.
          </p>
        </div>
      )}

      {/* FINISHED CONGRATS */}
      {currentRoom.state === 'finished' && (
        <div className="bg-gradient-to-br from-indigo-950 to-emerald-950 text-white rounded-3xl p-6 shadow-xl text-center py-12 space-y-6 border border-amber-500/25">
          <span className="text-6xl animate-pulse block">🎁👑🏴‍☠️</span>
          <h2 className="text-xl font-black text-amber-200">لقد وصلتم لصندوق الكنز التعليمي!</h2>
          
          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl space-y-2">
            <p className="text-xs text-amber-300">كنوز وذهب مجموعتكم الإجمالي:</p>
            <p className="text-3xl font-black text-amber-400">{currentPlayer?.score || 0} ذهبية 🏅</p>
          </div>
          
          <p className="text-[11px] text-slate-300 font-bold leading-relaxed max-w-xs mx-auto">
            مبارك لكل الفائزين والمبادرين المغامرين بصفنا الاستثنائي!
          </p>
        </div>
      )}

    </div>
  );
}
