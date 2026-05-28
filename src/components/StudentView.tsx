import React, { useState, useEffect } from 'react';
import { 
  Users, Check, X, Clock, HelpCircle, Trophy, Sparkles, Send, Brain, ArrowLeft, Zap, Shield, Flame
} from 'lucide-react';
import { ref, set, onValue, get, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { MOROCCAN_AVATARS } from '../data';

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

interface StudentViewProps {
  onBackToMain: () => void;
}

export default function StudentView({ onBackToMain }: StudentViewProps) {
  // Local student state
  const [playerId, setPlayerId] = useState<string>(() => {
    return localStorage.getItem('school_stud_playerId') || 'team-' + Math.floor(1000 + Math.random() * 9000);
  });
  const [roomPin, setRoomPin] = useState<string>(() => {
    return localStorage.getItem('school_stud_room_pin') || '';
  });
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('school_stud_name') || '';
  });
  const [studentAvatar, setStudentAvatar] = useState(() => {
    return localStorage.getItem('school_stud_avatar') || '🦁';
  });

  const [roomVal, setRoomVal] = useState<RoomState | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  // Input states
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState(false);

  // Score bookkeeping tracking to prevent scoring twice on reveal
  const [lastProcessedIndex, setLastProcessedIndex] = useState<number>(-1);

  // Real-time Database state machine listener
  useEffect(() => {
    if (isJoined && roomPin) {
      const roomRef = ref(db, `rooms/${roomPin}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val() as RoomState;
          setRoomVal(val);
          
          // Detect if this specific student is still in team roster
          if (val.teams && val.teams[playerId]) {
            // Keep synchronized
            setIsJoined(true);
          }
        } else {
          // Room deleted by teacher
          setRoomVal(null);
          setIsJoined(false);
          setErrorHeader('انتهت الغرفة أو قفلها الأستاذ 🛑');
        }
      });
      return () => unsubscribe();
    }
  }, [isJoined, roomPin, playerId]);

  // Synchronous response checker on new questions
  useEffect(() => {
    if (roomVal) {
      if (roomVal.status === 'playing') {
        setHasSubmittedThisRound(false);
        setWrittenAnswer('');
      }
    }
  }, [roomVal?.currentQuestionIndex, roomVal?.status]);

  // حساب النقاط عند الانتقال لـ reveal — runTransaction يمنع التعارض بين أجهزة متعددة
  useEffect(() => {
    if (roomVal && roomVal.status === 'reveal' && playerId && isJoined) {
      const currentIdx = roomVal.currentQuestionIndex;
      if (currentIdx !== lastProcessedIndex) {
        setLastProcessedIndex(currentIdx);

        const responseState = roomVal.responses?.[playerId];
        if (responseState && responseState.isCorrect) {
          const points = roomVal.currentQuestion?.points || 1000;
          // ✅ runTransaction: إضافة آمنة بدون read-then-write race condition
          runTransaction(ref(db, `rooms/${roomPin}/teams/${playerId}/score`), (currentScore) => {
            return (currentScore || 0) + points;
          });
        }
      }
    }
  }, [roomVal?.status, roomVal?.currentQuestionIndex, playerId, roomPin, isJoined, lastProcessedIndex]);

  // Join Action
  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorHeader(null);

    if (!roomPin.trim() || !studentName.trim()) {
      setErrorHeader('يرجى كتابة رمز الغرفة واسم مجموعتك ذكي الدخول 🎒');
      return;
    }

    setLoading(true);
    try {
      const cleanPin = roomPin.trim();
      const roomRef = ref(db, `rooms/${cleanPin}`);
      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        throw new Error('غرفة اللعب غير موجودة! يرجى الاستفسار من المشرف عن الرمز PIN الصحيح.');
      }

      // Safe add student under teams node
      const currentTeamProfile: Team = {
        id: playerId,
        teamName: studentName.trim(),
        avatar: studentAvatar,
        score: 0,
        streak: 0
      };

      await set(ref(db, `rooms/${cleanPin}/teams/${playerId}`), currentTeamProfile);

      // Save credentials locally for session state preservation
      localStorage.setItem('school_stud_playerId', playerId);
      localStorage.setItem('school_stud_room_pin', cleanPin);
      localStorage.setItem('school_stud_name', studentName.trim());
      localStorage.setItem('school_stud_avatar', studentAvatar);

      setIsJoined(true);
      setErrorHeader(null);
    } catch (err: any) {
      setErrorHeader(err.message || 'فشل الاتصال بساحة المسابقة.');
    } finally {
      setLoading(false);
    }
  };

  // Exit Action
  const handleExitGame = async () => {
    if (window.confirm('هل تريد مغادرة المعترك وسحب سفينة مجموعتك كلياً؟')) {
      if (roomPin && playerId) {
        // Safe remove team profile node
        await set(ref(db, `rooms/${roomPin}/teams/${playerId}`), null);
      }
      localStorage.removeItem('school_stud_playerId');
      localStorage.removeItem('school_stud_room_pin');
      setIsJoined(false);
      setRoomVal(null);
      onBackToMain();
    }
  };

  // Submission MCQ response
  const handleChooseOption = async (selected: string) => {
    if (!roomVal || !roomVal.currentQuestion || hasSubmittedThisRound) return;

    try {
      const isCorrect = selected === roomVal.currentQuestion.correctAnswer;
      setHasSubmittedThisRound(true);

      // Write response to rooms/PIN/responses/playerId
      await set(ref(db, `rooms/${roomPin}/responses/${playerId}`), {
        teamName: studentName,
        selectedAnswer: selected,
        isCorrect: isCorrect
      });
    } catch (err: any) {
      alert('تعذر إرجاع الرد، يرجى التثبت من الاتصال.');
      setHasSubmittedThisRound(false);
    }
  };

  // Submission Written response
  const handleSendWritten = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomVal || !roomVal.currentQuestion || !writtenAnswer.trim() || hasSubmittedThisRound) return;

    try {
      const studentCleanText = writtenAnswer.trim().toLowerCase();
      const correctCleanText = roomVal.currentQuestion.correctAnswer.trim().toLowerCase();

      // Simple pedagogic comparison permitting minor spacing mismatches
      const isCorrect = studentCleanText === correctCleanText || correctCleanText.includes(studentCleanText);

      setHasSubmittedThisRound(true);

      await set(ref(db, `rooms/${roomPin}/responses/${playerId}`), {
        teamName: studentName,
        selectedAnswer: writtenAnswer.trim(),
        isCorrect: isCorrect
      });
    } catch (err: any) {
      alert('تعذر إرجاع الرد، يرجى إعادة المحاولة.');
      setHasSubmittedThisRound(false);
    }
  };

  // Lobby Login Template
  if (!isJoined || !roomVal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 font-sans" dir="rtl">
        <div className="bg-[#0c1424] border-2 border-indigo-900 text-right rounded-3xl p-6 md:p-8 shadow-2xl max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <span className="text-5xl animate-bounce inline-block">⛵🧭</span>
            <h2 className="text-xl md:text-2xl font-black text-amber-300">ولوج المتعلمين والمجموعات</h2>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              افتح سفينتكم الخاصة! اكتب رمز الغرفة <span className="text-[#00E5FF] font-black">PIN</span> واللقب الحماسي لتنزلقوا بملحمة المعارك الثنائية لجمع ذهبيات الكنز!
            </p>
          </div>

          <form onSubmit={handleJoinGame} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-[#00E5FF]">رقم الغرفة (Room PIN):</label>
              <input
                type="number"
                placeholder="أدخل 4 أرقام"
                value={roomPin}
                onChange={(e) => setRoomPin(e.target.value)}
                className="w-full text-center tracking-[0.25em] font-mono font-black text-2xl p-3 bg-slate-900 border-2 border-indigo-950 text-amber-300 focus:border-[#0038A8] rounded-2xl outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-[#00E5FF]">اسم المجموعة البطلة:</label>
              <input
                type="text"
                placeholder="مثال: يوسف وأحمد، مريم، النسر الصاعد..."
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full text-xs font-bold p-3.5 bg-slate-900 border border-indigo-950 text-slate-100 placeholder:text-slate-600 focus:border-[#0038A8] rounded-2xl outline-none transition-all"
                disabled={loading}
                maxLength={14}
              />
            </div>

            {/* Avatar Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#00E5FF] block">اختر شعار مجموعتكم:</label>
              <div className="grid grid-cols-5 gap-1.5 p-2 bg-slate-900 border border-indigo-950 rounded-2xl">
                {MOROCCAN_AVATARS.map((av) => (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => setStudentAvatar(av.char)}
                    className={`p-2 text-xl rounded-xl transition-all cursor-pointer ${
                      studentAvatar === av.char 
                        ? 'bg-gradient-to-r from-[#0038A8] to-indigo-700 text-white scale-110 shadow-lg font-black' 
                        : 'hover:bg-slate-800 text-slate-400 Bg-slate-950'
                    }`}
                    title={av.name}
                  >
                    {av.char}
                  </button>
                ))}
              </div>
            </div>

            {errorHeader && (
              <div className="p-3 bg-rose-950/20 border border-rose-900 text-rose-300 rounded-2xl text-[11px] font-bold text-center leading-relaxed">
                ⚠️ {errorHeader}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full p-4.5 rounded-2xl font-black text-xs text-slate-950 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? 'bg-slate-805 text-slate-500 pointer-events-none'
                  : 'bg-gradient-to-r from-amber-400 to-teal-400 hover:scale-[1.01]'
              }`}
            >
              <span>{loading ? 'جاري الولوج للمقاطعة التربوية...' : 'رسـوّ على جزيرة الكنز كلياً! 🏝️'}</span>
            </button>
          </form>

          <button onClick={onBackToMain} className="text-[10px] text-slate-500 hover:text-white block mx-auto underline">
            الرجوع للبوابة الاستقبالية
          </button>
        </div>
      </div>
    );
  }

  // Loaded Profile and Score Stats
  const teamProfile = roomVal.teams?.[playerId];
  const activeQ = roomVal.currentQuestion;

  return (
    <div className="w-full max-w-md mx-auto p-4 text-right space-y-4 font-sans" dir="rtl">
      
      {/* Real-time dashboard profile header */}
      <header className="bg-slate-900 border border-indigo-950 text-white rounded-3xl p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-4xl animate-pulse">{studentAvatar}</span>
          <div>
            <h3 className="font-extrabold text-sm text-amber-250">{studentName}</h3>
            <p className="text-[10px] text-[#00E5FF] font-black mt-0.5">
              رصيدك الحالي: {teamProfile?.score || 0} ذهبية 🪙
            </p>
          </div>
        </div>

        <button 
          onClick={handleExitGame}
          className="text-[10px] bg-slate-800 hover:bg-slate-750 border border-indigo-955 text-slate-300 hover:text-white px-3  py-1.5 rounded-xl font-bold transition-all"
        >
          مغادرة الحصة 🚪
        </button>
      </header>

      {/* SETUP / WAIT STATE PLACEHOLDER */}
      {roomVal.status === 'setup' && (
        <div className="bg-[#0b121f] rounded-3xl p-6 border border-indigo-950 text-center py-12 space-y-4 shadow shadow-indigo-950">
          <span className="text-6xl animate-bounce block">⛵</span>
          <h2 className="text-lg font-black text-[#00E5FF]">سفينتك راسية بأمان في المرفأ! ⚓</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-xs mx-auto">
            مرحباً بمجموعتك الفذة! لقد تم تهيئتها بنجاح. بمجرد قيام الأستاذ بإرسال وتفعيل المعترك من لوحة التحكم، تشتعل جزيرتنا وتظهر الخيارات فوراً!
          </p>
          <span className="inline-block bg-slate-950 border border-indigo-900 px-3 py-1.5 rounded-full text-[10px] tracking-wide text-amber-400 font-mono font-black">
            معبر PIN الراهن: {roomPin}
          </span>
        </div>
      )}

      {/* COMPETING STATE: DISPLAY OPTION OR STATUS */}
      {roomVal.status === 'playing' && activeQ && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Header block for current question text */}
          <div className="bg-slate-900 border border-indigo-950 rounded-3xl p-5 text-center space-y-3 shadow shadow-indigo-950">
            <div className="flex justify-between items-center text-[9.5px] font-black text-slate-500">
              <span className="bg-[#0038A8] text-white px-2 py-0.5 rounded">نقاط المسابقة: {activeQ.points} ذهبية</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>تنافس حي مع البقية 🚀</span>
              </span>
            </div>

            <p className="font-extrabold text-sm md:text-base text-white leading-relaxed text-right pt-2 whitespace-pre-wrap break-words">
              {activeQ.text}
            </p>
          </div>

          {/* Rendering selection based on MCQ/Written types */}
          {hasSubmittedThisRound ? (
            <div className="py-12 text-center bg-slate-900 border border-indigo-950 rounded-3xl space-y-3">
              <span className="text-5xl animate-bounce block">📤</span>
              <h4 className="text-xs font-black text-emerald-450 text-emerald-400">تم حسم وإرسال إجابتك بنجاح!</h4>
              <p className="text-[10px] text-slate-500 font-medium">الأجر في الثبات، راقب شاشة العرض والبروجيكتور ريثما ينتهي مؤقت الصبورة كلياً.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeQ.type === 'mcq' && (
                <div className="grid grid-cols-2 gap-3">
                  {activeQ.options.map((option, idx) => {
                    // Styled colors matching standard playful Kahoot elements
                    const styleMap = [
                      { bg: 'bg-rose-600 border-rose-800', symbol: '🔺' },
                      { bg: 'bg-[#0038A8] border-blue-900', symbol: '🔷' },
                      { bg: 'bg-amber-600 border-amber-800', symbol: '🟡' },
                      { bg: 'bg-emerald-700 border-emerald-900', symbol: '🟩' }
                    ];
                    const activeStyle = styleMap[idx % 4];
                    return (
                      <button
                        key={idx}
                        onClick={() => handleChooseOption(option)}
                        className={`p-4 min-h-[90px] border-b-4 text-white text-xs font-black rounded-2xl flex flex-col justify-between items-center transition-all cursor-pointer hover:brightness-110 active:scale-95 ${activeStyle.bg} ${activeStyle.symbol}`}
                      >
                        <span className="text-sm">{activeStyle.symbol}</span>
                        <span className="text-center font-extrabold text-[11px] leading-snug">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeQ.type === 'written' && (
                <form onSubmit={handleSendWritten} className="bg-slate-900 p-5 rounded-3xl border border-indigo-950 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-amber-200 font-black block">اكتب الجواب الصائب بتركيز تام:</label>
                    <input
                      type="text"
                      placeholder="اكتب الجواب دقيقاً هنا..."
                      value={writtenAnswer}
                      onChange={(e) => setWrittenAnswer(e.target.value)}
                      className="w-full text-center text-xs font-black p-3.5 bg-slate-950 border border-indigo-950 text-slate-100 rounded-xl outline-none focus:border-amber-400 transition-all placeholder:text-slate-700"
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-xs text-slate-950 shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-slate-950" />
                    <span>أرسل جوابي الخطي للأستاذ ✏️</span>
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      )}

      {/* REVEAL CORRECT ANSWER STATE */}
      {roomVal.status === 'reveal' && (
        <div className="bg-[#0b121f] rounded-3xl p-6 border-2 border-indigo-950 shadow text-center py-10 space-y-6">
          {(() => {
            const studentResp = roomVal.responses?.[playerId];
            if (!studentResp) {
              return (
                <div className="space-y-3">
                  <span className="text-5xl block">⏳</span>
                  <h3 className="font-black text-slate-300">انتهى وقت المؤقت من الصبورة</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">لم تقم مجموعتكم بإرسال الجواب في الوقت المناسب لخريطة الطريق. ركزوا للحاق بالتحدي القادم!</p>
                </div>
              );
            }
            return studentResp.isCorrect ? (
              <div className="space-y-4 animate-bounce">
                <span className="text-6xl block">🎉⭐🟢</span>
                <h3 className="text-lg font-black text-emerald-400">أحسنتم! جوابكم صحيح ومميز ديدكتيكياً</h3>
                <div className="p-3 bg-emerald-950/40 border border-emerald-900 rounded-2xl inline-block max-w-sm">
                  <p className="text-[10px] text-slate-400 font-bold">جواهر كنز الذهب المضافة:</p>
                  <p className="text-xl font-black text-amber-400">+{activeQ?.points || 1000} ذهبية دافعة 🪙</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <span className="text-6xl block">⚠️❌</span>
                <h3 className="text-lg font-black text-rose-450">محاولة حسنة، لكن الجواب الممنهج الصواب هو:</h3>
                <div className="p-3.5 bg-rose-950/20 border border-rose-900/50 rounded-2xl inline-block w-full">
                  <p className="text-xs text-slate-350 font-bold">"{activeQ?.correctAnswer}"</p>
                </div>
                <p className="text-[11px] text-slate-400 font-bold">حظ أوفر بقلعة الدورة المقررة الموالية، لا تقطع العمل!</p>
              </div>
            );
          })()}

          <div className="border-t border-indigo-950/50 pt-3">
            <p className="text-[10px] text-amber-400 font-black animate-pulse">
              انظر إلى البروجيكتور الكبرى لمشاهدة صدارة فرسان القسم!
            </p>
          </div>
        </div>
      )}

      {/* FINISHED CONGRATULATIONS */}
      {roomVal.status === 'finished' && (
        <div className="bg-gradient-to-br from-indigo-950 to-slate-950 text-white rounded-3xl p-6 border-2 border-amber-500/30 text-center py-12 space-y-6">
          <span className="text-6xl animate-pulse block">👑🎁🏴‍☠️</span>
          <h2 className="text-lg font-black text-amber-250">وصلت سفينتك لصندوق كنز المقاطعة!</h2>

          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl">
            <p className="text-xs text-amber-300 font-black">حصيلتكم من الكنوز والذهب الإجمالي:</p>
            <p className="text-3xl font-black text-amber-400">{teamProfile?.score || 0} ذهبية ⭐</p>
          </div>

          <p className="text-[11.5px] text-slate-300 font-semibold leading-relaxed">
            مستويات مذهلة! مبارك لكل المجموعات والمتعلمين البواسل حصاد المعرفة بالصف المتميز.
          </p>
        </div>
      )}

    </div>
  );
}
