import React, { useState, useEffect } from 'react';
import { 
  Users, Check, X, Clock, AlertCircle, HelpCircle, Trophy, Sparkles, 
  Send, Brain, ArrowLeft, Volume2, ShieldAlert, Zap, Timer, HelpCircle as HintIcon
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

  // Active hints modal
  const [showHintBubble, setShowHintBubble] = useState(false);

  // Disallowed options due to 50/50 powerup
  const [eliminatedOptionIndices, setEliminatedOptionIndices] = useState<number[]>([]);

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
          setHasSubmittedThisRound(pState.answeredThisRound);
        }
      });
      return () => unsubscribe();
    }
  }, [roomPin, playerId]);

  // Handle question reset for choice eliminations and inputs
  useEffect(() => {
    if (currentRoom) {
      if (currentRoom.state === 'question_countdown' || currentRoom.state === 'waiting') {
        setWrittenInput('');
        setHasSubmittedThisRound(false);
        setEliminatedOptionIndices([]);
        setShowHintBubble(false);
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
    if (confirm('هل ترغب في مغادرة هذه الحصة الاستثنائية؟')) {
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
      setError(e.message || 'خطأ في إرسال جوابك المكتوب.');
      setHasSubmittedThisRound(false);
    }
  };

  // Powerup click handlers
  const handleTriggerFiftyFifty = async () => {
    if (!currentRoom || !playerId || !activeQuestion || hasSubmittedThisRound) return;
    const player = currentRoom.players[playerId];
    if (player.usedFiftyFifty) return;

    try {
      await usePowerup(currentRoom.pin, playerId, 'fiftyFifty');
      
      // select two indices that are wrong
      const wrongIndices: number[] = [];
      activeQuestion.options.forEach((_, optIdx) => {
        if (optIdx !== activeQuestion.correctIndex) {
          wrongIndices.push(optIdx);
        }
      });
      
      // Shuffle list and choose exactly 2 to eliminate
      const toEliminate = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
      setEliminatedOptionIndices(toEliminate);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerExtraTime = async () => {
    if (!currentRoom || !playerId) return;
    const player = currentRoom.players[playerId];
    if (player.usedExtraTime) return;

    try {
      await usePowerup(currentRoom.pin, playerId, 'extraTime');
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerHint = async () => {
    if (!currentRoom || !playerId || !activeQuestion) return;
    const player = currentRoom.players[playerId];
    if (player.usedHint) return;

    try {
      await usePowerup(currentRoom.pin, playerId, 'hint');
      setShowHintBubble(true);
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
      <div className="min-h-[75vh] flex items-center justify-center p-4 bg-slate-50" dir="rtl">
        <div className="bg-white border text-right rounded-3xl p-6 md:p-8 shadow-xl max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl">🎒</span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">انضمام التلاميذ والتلميذات</h2>
            <p className="text-xs text-slate-505 font-medium leading-relaxed">
              تأكد من كتابة رمز الغرفة (PIN) المشارك في الصبورة للمشاركة الفعالة.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">رمز الغرفة (PIN):</label>
              <input
                type="number"
                placeholder="مثال: 4125"
                value={roomPin}
                onChange={(e) => setRoomPin(e.target.value)}
                className="w-full text-center tracking-[0.2em] font-mono font-black text-lg p-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-2xl outline-none"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">لقب البطل(ة) أو الفريق النبيل:</label>
              <input
                type="text"
                placeholder="اكتب اسمك المفرد أو اسم زميلك"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none"
                disabled={loading}
                maxLength={12}
              />
            </div>

            {/* Avatar block */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">مجسم رفيق البطل المغربي:</label>
              <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-50 border border-slate-100 rounded-2xl">
                {MOROCCAN_AVATARS.map((av) => (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => setStudentAvatar(av.char)}
                    className={`p-2 text-lg rounded-xl transition-transform cursor-pointer ${
                      studentAvatar === av.char 
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white scale-110 shadow-md' 
                        : 'hover:bg-slate-200/50 bg-white text-slate-700'
                    }`}
                    title={av.name}
                  >
                    {av.char}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-[10px] font-bold text-center leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-4 rounded-2xl font-black text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? 'bg-slate-300 cursor-wait'
                  : 'bg-gradient-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600'
              }`}
            >
              <span>{loading ? 'جاري التحقق من الرقم والدردشة...' : 'التحاق بالحصة التعليمية 🎮'}</span>
            </button>
          </form>

          <button
            onClick={onBackToMain}
            className="text-[10px] text-slate-505 hover:text-slate-800 text-center block mx-auto underline mt-2"
          >
            الرجوع للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  // Active student screen
  return (
    <div className="w-full max-w-lg mx-auto p-4 text-right space-y-4" dir="rtl">
      
      {/* Student Profile bar */}
      <header className="bg-slate-900 text-white rounded-3xl p-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl animate-bounce">{currentPlayer?.avatar}</span>
          <div>
            <h3 className="font-black text-sm">{currentPlayer?.name}</h3>
            <p className="text-[10px] text-indigo-300 font-extrabold mt-0.5">
              رصيدك الحالي: {currentPlayer?.score || 0} نقطة 🎖️
            </p>
          </div>
        </div>

        <button 
          onClick={handleExit}
          className="text-[10px] bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl font-bold transition-all"
        >
          خروج 🚪
        </button>
      </header>

      {/* LOBBY / WAITING SCREEN */}
      {currentRoom.state === 'waiting' && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 text-center py-12 space-y-4">
          <span className="text-5xl animate-spin block" style={{ animationDuration: '8s' }}>👑</span>
          <h2 className="text-xl font-black text-slate-900">تقف في الصف الآن! 🎒</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold max-w-xs mx-auto">
            لقد تم حجز مكانك بنجاح! في انتظار انطلاق المعركة والبث من طرف الأستاذ المشرف.
          </p>
          <div className="inline-flex items-center gap-2 bg-indigo-50 px-3.5 py-1.5 rounded-full text-[10px] font-black text-indigo-700 border border-indigo-100">
            <span>رقم غرفتك:</span>
            <span className="font-mono text-xs">{currentRoom.pin}</span>
          </div>
        </div>
      )}

      {/* COUNTDOWN 3S INTRO */}
      {currentRoom.state === 'question_countdown' && (
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl text-center py-12 space-y-3">
          <span className="text-2xl animate-pulse text-emerald-305">استعد بكل حماسة! 🔥</span>
          <p className="text-sm text-slate-350 font-bold">السؤال الموالي ينطلق الآن...</p>
          <div className="text-6xl font-black font-mono text-emerald-400">{currentRoom.secondsRemaining}</div>
        </div>
      )}

      {/* ACTIVE RUNNING QUESTION INTERFACE */}
      {currentRoom.state === 'question_active' && activeQuestion && (
        <div className="space-y-4">
          
          {/* Header query title */}
          <div className="bg-white rounded-3xl p-4.5 shadow-md border border-indigo-50/40 text-center space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 border-b border-slate-100 pb-2">
              <span>درجة السؤال: {activeQuestion.points} نقطة</span>
              <span className="bg-indigo-50 text-indigo-650 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>المؤقت: {currentRoom.secondsRemaining}ث</span>
              </span>
            </div>
            
            <p className="font-extrabold text-sm text-slate-900 py-2 leading-relaxed">
              {activeQuestion.text}
            </p>
          </div>

          {/* ACTIVE POWER-UPS PANEL */}
          <div id="assist-powerups" className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 border-b border-slate-200.5 pb-1.5 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500 animate-bounce" />
              <span className="text-[10px] font-black text-slate-700">شحن بطاقات الدعم (استخدام مرة واحدة باللعبة):</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* 50/50 Powerup */}
              <button
                type="button"
                onClick={handleTriggerFiftyFifty}
                disabled={!!currentPlayer?.usedFiftyFifty || hasSubmittedThisRound || activeQuestion.type !== 'mcq'}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-black text-center transition-all ${
                  currentPlayer?.usedFiftyFifty || activeQuestion.type !== 'mcq'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-250'
                    : 'bg-amber-100 hover:bg-amber-150 text-amber-900 border border-amber-250 shadow-sm'
                }`}
                title="حذف خيارين خاطئين للتسهيل"
              >
                <span>🃏 حذف 50/50</span>
              </button>

              {/* Extra Time Powerup */}
              <button
                type="button"
                onClick={handleTriggerExtraTime}
                disabled={!!currentPlayer?.usedExtraTime || hasSubmittedThisRound}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-black text-center transition-all ${
                  currentPlayer?.usedExtraTime
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-250'
                    : 'bg-blue-100 hover:bg-blue-150 text-blue-900 border border-blue-250 shadow-sm'
                }`}
                title="إضافة +15 ثانية لمؤقت القسم"
              >
                <span>⏰ وقت إضافي+</span>
              </button>

              {/* Hint Powerup */}
              <button
                type="button"
                onClick={handleTriggerHint}
                disabled={!!currentPlayer?.usedHint || hasSubmittedThisRound}
                className={`py-2 px-1.5 rounded-xl text-[10px] font-black text-center transition-all ${
                  currentPlayer?.usedHint
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-250'
                    : 'bg-sky-100 hover:bg-sky-150 text-sky-900 border border-sky-250 shadow-sm'
                }`}
                title="طلب تلميح بلقطة ذكاء"
              >
                <span>💡 كشف تلميح</span>
              </button>
            </div>

            {/* Hint Box Bubble conditional */}
            {showHintBubble && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-[10px] font-bold text-teal-850 text-center leading-relaxed">
                👉 تلميح الأطلس: تذكّر القاعدة ولا تتسرع، الجواب ينطوي تحت مبادئ المنهاج المغربي السليم!
              </div>
            )}
          </div>

          {/* DYNAMIC VIEW ACCORDING TO QUESTION TYPE */}
          
          {/* MCQ Option view with colors */}
          {activeQuestion.type === 'mcq' && (
            <div className="space-y-2.5">
              {hasSubmittedThisRound ? (
                <div className="py-12 text-center bg-white border border-indigo-50.5 rounded-3xl space-y-3 shadow-md">
                  <span className="text-4xl animate-bounce block">📤</span>
                  <p className="text-xs font-black text-indigo-600 block">لقد أرسلت إجابتك بنجاح!</p>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">في انتظار انتهاء المؤقت التنازلي أو إغلاق السؤال من الأستاذ المشرف.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5">
                  {/* Colors & Geometric Kahoot figures */}
                  {[
                    { bg: 'bg-rose-500 hover:bg-rose-650', border: 'border-rose-600', icon: '🔺', shadow: 'shadow-rose-100' },
                    { bg: 'bg-indigo-650 hover:bg-indigo-800', border: 'border-indigo-750', icon: '🔷', shadow: 'shadow-indigo-100' },
                    { bg: 'bg-amber-500 hover:bg-amber-650', border: 'border-amber-600', icon: '🟡', shadow: 'shadow-amber-100' },
                    { bg: 'bg-emerald-600 hover:bg-emerald-750', border: 'border-emerald-700', icon: '🟩', shadow: 'shadow-emerald-100' }
                  ].map((style, oi) => {
                    const isEliminated = eliminatedOptionIndices.includes(oi);
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => handleSendMcqAnswer(oi)}
                        disabled={isEliminated}
                        className={`w-full min-h-[95px] p-4 text-white font-extrabold text-xs rounded-2xl border-b-4 flex flex-col justify-between items-center transition-all ${
                          isEliminated 
                            ? 'bg-slate-200 border-slate-300 text-slate-400 opacity-40 cursor-not-allowed scale-95'
                            : `${style.bg} ${style.border} ${style.shadow} hover:shadow-lg active:scale-95 cursor-pointer`
                        }`}
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

          {/* Written Option view */}
          {activeQuestion.type === 'written' && (
            <div className="space-y-3 bg-white p-5 shadow-lg border border-indigo-50/50 rounded-3xl">
              {hasSubmittedThisRound ? (
                <div className="py-6 text-center space-y-3">
                  <span className="text-3xl animate-bounce">✏️</span>
                  <p className="text-xs font-black text-indigo-600">تم تسجيل جوابك الخطي بنجاح!</p>
                  <p className="text-[10px] text-slate-450">في انتظار مراجعة اللوحة الرئيسية وإعلان رتب الفائزين.</p>
                </div>
              ) : (
                <form onSubmit={handleSendWrittenAnswer} className="space-y-4">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-xs text-slate-700 font-extrabold block">اكتب إجابتك بدقة هنا:</label>
                    <input
                      type="text"
                      placeholder="امسح واكتب الكلمة أو العبارة بدقة..."
                      value={writtenInput}
                      onChange={(e) => setWrittenInput(e.target.value)}
                      className="w-full text-center text-sm font-black p-3.5 bg-slate-50 border border-slate-310 focus:border-indigo-555 rounded-2xl outline-none transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full p-3.5 rounded-2xl bg-indigo-650 hover:bg-indigo-700 font-black text-xs text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-indigo-200" />
                    <span>أرسل جوابي الخطي للأستاذ ✏️</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Oral Option view */}
          {activeQuestion.type === 'oral' && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 md:p-8 rounded-3xl border border-indigo-200 shadow-lg text-center space-y-4">
              <span className="text-5xl animate-pulse block">🗣️🗣️</span>
              <h4 className="font-extrabold text-base text-slate-900 leading-snug">تنبيه شفهي: استعــد للمشاركة والمقاولة! 👋</h4>
              <p className="text-[11px] text-slate-505 leading-relaxed font-semibold max-w-sm mx-auto">
                هذا سؤال شفهي خاص بحصتك الصيفية! عندما يأتي دورك، قف شامخاً واجب بصوت جهوري أمام الأستاذ وزملائك في الفصل.
              </p>
              <div className="p-3 bg-white/70 border border-indigo-205 rounded-2xl text-[10px] font-black text-indigo-750 inline-block">
                👈 سيقوم الأستاذ بتقييمك ومنحك نقاط كاملة من واجهته الخاصة!
              </div>
            </div>
          )}

        </div>
      )}

      {/* QUESTION TIME EXPIRED RESULT */}
      {currentRoom.state === 'question_result' && currentPlayer && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 text-center py-12 space-y-6">
          {currentPlayer.isCorrect ? (
            <div className="space-y-3">
              <span className="text-5xl animate-bounce block">✨🎉🟢</span>
              <h2 className="text-xl font-bold text-emerald-600">إجابة صحيحة وموفقة! أحسنت</h2>
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl inline-block">
                <p className="text-xs text-slate-505 font-bold">نقاط الزيادة المحتسبة:</p>
                <p className="text-2xl font-black text-emerald-700">+{currentPlayer.pointsGained} نقطة ⭐</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-5xl block animate-shake">❌😢</span>
              <h2 className="text-xl font-bold text-rose-555 text-rose-600">محاولة جيدة، لكن غير موفقة!</h2>
              <p className="text-xs text-slate-500 font-bold max-w-xs mx-auto">
                حظ أوفر في المرات والأسئلة القادمة! تذكر القواعد المنهجية وركّز جيداً.
              </p>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl inline-block text-[11px] font-bold text-rose-700">
                لم تكسب نقاط في هذه الجولة.
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <p className="text-[10px] text-indigo-600 font-black animate-pulse">
              انظر إلى الصبورة أو شاشة المدرس لمعاينة تصنيف المجموعات المباشر!
            </p>
          </div>
        </div>
      )}

      {/* LEADERBOARD STANDBY VIEW */}
      {currentRoom.state === 'leaderboard' && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-50/50 text-center py-12 space-y-4">
          <span className="text-5xl animate-bounce block">🏆🔥🎖️</span>
          <h2 className="text-lg font-black text-slate-905 leading-snug">شاشة الترتيب المباشر نشطة الآن!</h2>
          <p className="text-xs text-slate-450 leading-relaxed font-semibold max-w-xs mx-auto">
            تابع تصنيفك وترتيب زملائك في القسم على شاشة العرض والبروجيكتور لمعرفة من يتصدر قائمة الأبطال الحالية.
          </p>
        </div>
      )}

      {/* FINISHED PODIUM AND CONGRATS */}
      {currentRoom.state === 'finished' && (
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl text-center py-12 space-y-6">
          <span className="text-5xl animate-pulse block">👑🏅</span>
          <h2 className="text-lg font-black">اكتمل التحدي التعليمي بنجاح!</h2>
          
          <div className="bg-white/10 p-5 rounded-2xl space-y-2">
            <p className="text-xs text-indigo-200">مجموع درجتك المحتسبة بالكامل:</p>
            <p className="text-3xl font-black text-emerald-400">{currentPlayer?.score || 0} نقطة</p>
          </div>
          
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-xs mx-auto">
            مبارك لكل المتعلمين! التطوير المستمر يصنع المستحيل ونراك في تحدي صفّي مقبل.
          </p>
        </div>
      )}

    </div>
  );
}
