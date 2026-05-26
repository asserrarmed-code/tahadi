import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Brain, Award, Laptop, Play, Plus, Trash, Clock, 
  Settings, Users, ChevronRight, Check, Database, RefreshCw, 
  BookOpen, Crown, Volume2, HelpCircle, Trophy, UserCheck, CheckCircle,
  Lock, Unlock, Key, ShieldAlert, LogOut
} from 'lucide-react';
import { Room, Player, Question, QuizSet } from './types';
import { MOROCCAN_AVATARS, INITIAL_QUIZZES } from './data';
import AIGenerator from './components/AIGenerator';
import DatabaseVisualizer from './components/DatabaseVisualizer';

export default function App() {
  // Core game database states
  const [quizzes, setQuizzes] = useState<QuizSet[]>(INITIAL_QUIZZES);
  
  // Teacher verification - secure access control exclusively for teachers
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('school_teacher_auth') === 'true';
  });
  
  // Simulated multiple active browser clients in one UI for easy local testing
  const [activeLayout, setActiveLayout] = useState<'bento' | 'teacher' | 'projector' | 'student' | 'model-ai'>('bento');
  
  // Game session states
  const [roomPin, setRoomPin] = useState<string>('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  
  // Teacher view state
  const [selectedQuizId, setSelectedQuizId] = useState<string>(INITIAL_QUIZZES[0].id);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  
  // Student registration state (local device state)
  const [studentName, setStudentName] = useState('');
  const [studentAvatar, setStudentAvatar] = useState('🦁');
  const [studentPlayerId, setStudentPlayerId] = useState<string | null>(null);
  const [studentRoomPinInput, setStudentRoomPinInput] = useState('');
  const [studentFeedbackMessage, setStudentFeedbackMessage] = useState<string | null>(null);
  const [hasStudentJoined, setHasStudentJoined] = useState(false);
  const [lastStudentCheckedState, setLastStudentCheckedState] = useState<string>('');

  // Audio simulation state (Kids love sound cues!)
  const [soundEffects, setSoundEffects] = useState(true);

  // Active question details helper
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Read URL Path on mount for direct unmasked route loading
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/projector') {
      setActiveLayout('projector');
    } else if (path === '/student') {
      setActiveLayout('student');
    } else if (path === '/teacher') {
      setActiveLayout('teacher');
    } else if (path === '/model-ai') {
      setActiveLayout('model-ai');
    } else {
      setActiveLayout('bento');
    }

    // Support browser back/forward buttons
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/projector') setActiveLayout('projector');
      else if (p === '/student') setActiveLayout('student');
      else if (p === '/teacher') setActiveLayout('teacher');
      else if (p === '/model-ai') setActiveLayout('model-ai');
      else setActiveLayout('bento');
    };
    window.addEventListener('popstate', handlePopState);
    
    // Restore student details from localStorage
    const savedName = localStorage.getItem('school_stud_name');
    const savedAvatar = localStorage.getItem('school_stud_avatar');
    const savedPinInput = localStorage.getItem('school_stud_pin');
    const savedPlayerId = localStorage.getItem('school_stud_playerId');
    const savedHasJoined = localStorage.getItem('school_stud_hasJoined') === 'true';
    const savedRoomPin = localStorage.getItem('school_room_pin');

    if (savedName) setStudentName(savedName);
    if (savedAvatar) setStudentAvatar(savedAvatar);
    if (savedPinInput) setStudentRoomPinInput(savedPinInput);
    if (savedPlayerId) setStudentPlayerId(savedPlayerId);
    if (savedHasJoined) setHasStudentJoined(savedHasJoined);
    if (savedRoomPin) setRoomPin(savedRoomPin);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync state changes to localStorage
  useEffect(() => {
    if (studentName) localStorage.setItem('school_stud_name', studentName);
    if (studentAvatar) localStorage.setItem('school_stud_avatar', studentAvatar);
    if (studentRoomPinInput) localStorage.setItem('school_stud_pin', studentRoomPinInput);
    if (studentPlayerId) {
      localStorage.setItem('school_stud_playerId', studentPlayerId);
    } else {
      localStorage.removeItem('school_stud_playerId');
    }
    localStorage.setItem('school_stud_hasJoined', String(hasStudentJoined));
    if (roomPin) {
      localStorage.setItem('school_room_pin', roomPin);
    } else {
      localStorage.removeItem('school_room_pin');
    }
  }, [studentName, studentAvatar, studentRoomPinInput, studentPlayerId, hasStudentJoined, roomPin]);

  // Clean layout helper that pushes window history state
  const navigateTo = (layout: 'bento' | 'teacher' | 'projector' | 'student' | 'model-ai') => {
    setActiveLayout(layout);
    const paths: Record<string, string> = {
      bento: '/',
      teacher: '/teacher',
      projector: '/projector',
      student: '/student',
      'model-ai': '/model-ai'
    };
    window.history.pushState({}, '', paths[layout] || '/');
  };

  // Polling intervals to auto-sync elements from the backend (our "Firebase real-time DB listener")
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (roomPin) {
      interval = setInterval(() => {
        fetchRoomState(roomPin);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [roomPin]);

  // Read active question whenever room index changes
  useEffect(() => {
    if (currentRoom && currentRoom.activeQuizId) {
      const activeQuiz = quizzes.find(q => q.id === currentRoom.activeQuizId);
      if (activeQuiz && currentRoom.currentQuestionIndex >= 0) {
        const q = activeQuiz.questions[currentRoom.currentQuestionIndex];
        setActiveQuestion(q || null);
      } else {
        setActiveQuestion(null);
      }
    } else {
      setActiveQuestion(null);
    }
  }, [currentRoom, quizzes]);

  // Automatically advance to question countdown when first loaded
  useEffect(() => {
    if (currentRoom && currentRoom.state === 'question_countdown' && currentRoom.secondsRemaining > 0) {
      const timer = setTimeout(() => {
        // Countdown internally triggered or polled from backend
        // In our server, the countdown of 3 seconds transitions on the next tick
        if (currentRoom.secondsRemaining === 1) {
          // Trigger activation from the backend natively
          activateQuestionOnServer();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentRoom]);

  const fetchRoomState = async (pin: string) => {
    try {
      const res = await fetch(`/api/room/${pin}`);
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
      }
    } catch (e) {
      console.error("Error fetching room synchronizer:", e);
    }
  };

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
    if (!selectedQuiz) return;

    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizSetId: selectedQuiz.id,
          quizSet: selectedQuiz
        })
      });
      const data = await res.json();
      if (data.success) {
        setRoomPin(data.room.pin);
        setCurrentRoom(data.room);
        playAudioCue('lobby');
      }
    } catch (e) {
      alert("خطأ أثناء إنشاء الغرفة، يرجى إعادة المحاولة.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!roomPin) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizSet: quizzes.find(q => q.id === currentRoom?.activeQuizId)
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        playAudioCue('countdown');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activateQuestionOnServer = async () => {
    if (!roomPin) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/activate-question`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        playAudioCue('question');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStudentJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentRoomPinInput || !studentName) {
      setStudentFeedbackMessage("المرجو ملء جميع المعلومات المطلوبة!");
      return;
    }
    setStudentFeedbackMessage(null);

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: studentRoomPinInput.trim(),
          name: studentName.trim(),
          avatar: studentAvatar
        })
      });
      const data = await res.json();
      if (data.success) {
        setStudentPlayerId(data.playerId);
        setRoomPin(data.room.pin); // sync room pin
        setCurrentRoom(data.room);
        setHasStudentJoined(true);
        playAudioCue('joined');
      } else {
        setStudentFeedbackMessage(data.error || "تعذر الاتصال بصف الصف.");
      }
    } catch (err) {
      setStudentFeedbackMessage("عذراً! الغرفة غير مسجلة أو حصل خطأ في شبكة الويب.");
    }
  };

  const handleStudentSubmitAnswer = async (answerIdx: number) => {
    if (!roomPin || !studentPlayerId) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: studentPlayerId,
          answerIndex: answerIdx
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        playAudioCue('submitted');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextAction = async () => {
    if (!roomPin) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/next`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        if (data.room.state === 'question_countdown') {
          playAudioCue('countdown');
        } else {
          playAudioCue('podium');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShowLeaderboard = async () => {
    if (!roomPin) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/leaderboard`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        playAudioCue('leaderboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkipQuestionTimer = async () => {
    if (!roomPin) return;
    try {
      const res = await fetch(`/api/room/${roomPin}/reveal`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCurrentRoom(data.room);
        playAudioCue('reveal');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTerminateRoom = async () => {
    if (!roomPin) return;
    try {
      await fetch(`/api/room/${roomPin}/terminate`, { method: 'POST' });
      setRoomPin('');
      setCurrentRoom(null);
      setHasStudentJoined(false);
      setStudentPlayerId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const playAudioCue = (type: string) => {
    if (!soundEffects) return;
    // Real synthesis voices/beeps supporting kids in Moroccan schools
    try {
      const synth = window.speechSynthesis;
      if (type === 'joined') {
        const u = new SpeechSynthesisUtterance('مرحباً بك في سباق القسم');
        u.lang = 'ar';
        synth.speak(u);
      } else if (type === 'countdown') {
        const u = new SpeechSynthesisUtterance('انتبه يا بطل، واحد اثنان ثلاثة!');
        u.lang = 'ar';
        u.rate = 1.3;
        synth.speak(u);
      } else if (type === 'question') {
        const u = new SpeechSynthesisUtterance('السؤال الجديد على الشاشة');
        u.lang = 'ar';
        synth.speak(u);
      } else if (type === 'submitted') {
        const u = new SpeechSynthesisUtterance('تم استقبال إجابتك');
        u.lang = 'ar';
        synth.speak(u);
      }
    } catch (e) {
      // browser muted or lacks speech API
    }
  };

  const handleNewQuizAdded = (newQuiz: QuizSet) => {
    setQuizzes(prev => [newQuiz, ...prev]);
    setSelectedQuizId(newQuiz.id);
  };

  // UI Helpers
  const KHO_COLORS = [
    { bg: 'bg-rose-500 border-rose-600', hover: 'hover:bg-rose-600', ring: 'focus:ring-rose-400', txt: 'text-white', icon: '🔺' },
    { bg: 'bg-blue-600 border-blue-700', hover: 'hover:bg-blue-700', ring: 'focus:ring-blue-400', txt: 'text-white', icon: '🔷' },
    { bg: 'bg-amber-500 border-amber-600', hover: 'hover:bg-amber-600', ring: 'focus:ring-amber-400', txt: 'text-slate-900', icon: '🟡' },
    { bg: 'bg-emerald-600 border-emerald-700', hover: 'hover:bg-emerald-700', ring: 'focus:ring-emerald-400', txt: 'text-white', icon: '🟩' }
  ];

  // -------------------------------------------------------------------------
  // STANDALONE INDEPENDENT PATH ROUTING - PURE FULL SCREEN VIEWS (No CSS/JS overlapping/hiding)
  // -------------------------------------------------------------------------

  if (activeLayout === 'projector') {
    return (
      <div className="bg-slate-900 text-slate-100 min-h-screen flex flex-col justify-between font-sans relative" dir="rtl">
        {/* Sky Background Subtle Stars Glow */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-505/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-505/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Cinematic Classroom Header */}
        <header className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 z-10 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-xl text-xs font-black animate-pulse-ring">
              العرض المباشر بالقسم 📺
            </span>
            <h1 className="text-white font-black text-lg tracking-wide md:text-xl">
              شاشة العرض الكبرى لرفاق الصف 👑
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigateTo('bento')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              💻 العودة للمحاكي المجمع
            </button>
            {roomPin && (
              <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl px-4.5 py-2 flex items-center gap-2 shadow">
                <span className="text-indigo-300 font-extrabold text-xs">رمز الدخول PIN:</span>
                <span className="text-2xl font-mono text-emerald-400 font-black tracking-widest">{roomPin}</span>
              </div>
            )}
          </div>
        </header>

        {/* Pure Projector Content (Full cinematic majesty) */}
        <main className="flex-1 flex flex-col justify-center p-6 md:p-8 max-w-6xl mx-auto w-full z-10">
          <ProjectorView 
            room={currentRoom} 
            activeQuestion={activeQuestion} 
            quizzes={quizzes}
          />
        </main>

        <footer className="bg-slate-950 py-4.5 border-t border-slate-800 text-center text-xs text-slate-400 z-10">
          أيها الأبطال افتحوا الرابط <strong className="text-indigo-400 font-black text-sm">/student</strong> من هواتفكم أو لوحاتكم الإلكترونية، ثم أدخلوا الرمز للحوار المباشر!
        </footer>
      </div>
    );
  }

  if (activeLayout === 'student') {
    return (
      <div className="bg-gradient-to-b from-rose-50 to-white min-h-screen flex flex-col justify-between font-sans relative" dir="rtl">
        {/* Child-friendly Ambient Circles */}
        <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-rose-200/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-100px] right-[-50px] w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Mobile/Tablet Cozy Top Header */}
        <header className="bg-rose-600 px-6 py-4.5 text-white shadow-md z-10">
          <div className="max-w-md mx-auto flex justify-between items-center flex-row">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎒</span>
              <span className="font-black text-sm md:text-base">لوحة التلميـذ البطل</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigateTo('bento')}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                المحاكي المجمع 💻
              </button>
              {roomPin && (
                <span className="bg-rose-700/60 text-rose-100 rounded-xl px-2.5 py-1 font-mono text-xs font-black">
                  رمز: {roomPin}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Pure Student Handheld Viewport */}
        <main className="flex-1 flex flex-col justify-center p-5 max-w-md mx-auto w-full z-10">
          <StudentDevice 
            room={currentRoom}
            studentName={studentName}
            setStudentName={setStudentName}
            studentAvatar={studentAvatar}
            setStudentAvatar={setStudentAvatar}
            studentRoomPinInput={studentRoomPinInput}
            setStudentRoomPinInput={setStudentRoomPinInput}
            onJoin={handleStudentJoin}
            hasJoined={hasStudentJoined}
            playerId={studentPlayerId}
            feedback={studentFeedbackMessage}
            onAnswerSubmitted={handleStudentSubmitAnswer}
            activeQuestion={activeQuestion}
            onLeave={handleTerminateRoom}
          />
        </main>

        <footer className="bg-slate-50 py-3.5 border-t border-slate-150 text-center text-[11px] text-slate-450 z-10 font-medium">
          مراجعة ممتعة بالقسم التفاعلي 🦁 منصة الأبطال بالمملكة المغربية
        </footer>
      </div>
    );
  }

  if (activeLayout === 'teacher') {
    return (
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 min-h-screen flex flex-col justify-between font-sans" dir="rtl">
        {/* Professional Educator Header */}
        <header className="bg-indigo-950 px-6 py-4 text-white flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base md:text-lg">لوحة تحكم الأستاذ المنفصلة 👨‍🏫</h1>
              <p className="text-[10px] text-slate-400 font-medium">إدارة وعرض التقييمات التفاعلية وحيوية الحصة</p>
            </div>
          </div>
          <div className="flex bg-indigo-900 border border-indigo-850 p-1 rounded-xl items-center gap-2">
            {isTeacherAuthenticated && (
              <button 
                onClick={() => {
                  setIsTeacherAuthenticated(false);
                  localStorage.removeItem('school_teacher_auth');
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="تسجيل الخروج وإغلاق لوحة الإدارة"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>قفل اللوح 🔐</span>
              </button>
            )}
            <button 
              onClick={() => navigateTo('bento')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-indigo-950 shadow transition-all cursor-pointer"
            >
              💻 العودة للمستكشف المجمع
            </button>
          </div>
        </header>

        {/* Pure Teacher Controls Content */}
        <main className="flex-1 p-6 max-w-4xl mx-auto w-full flex flex-col justify-center">
          {!isTeacherAuthenticated ? (
            <div className="w-full max-w-sm mx-auto">
              <TeacherPasscodeLock onUnlock={() => {
                setIsTeacherAuthenticated(true);
                localStorage.setItem('school_teacher_auth', 'true');
              }} />
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-indigo-100">
              <TeacherPanel 
                quizzes={quizzes}
                selectedQuizId={selectedQuizId}
                setSelectedQuizId={setSelectedQuizId}
                onCreateRoom={handleCreateRoom}
                isCreatingRoom={isCreatingRoom}
                room={currentRoom}
                onStartQuiz={handleStartQuiz}
                onNextAction={handleNextAction}
                onShowLeaderboard={handleShowLeaderboard}
                onTerminate={handleTerminateRoom}
                onSkip={handleSkipQuestionTimer}
                activeQuestion={activeQuestion}
              />
            </div>
          )}
        </main>

        <footer className="bg-white py-3.5 border-t border-slate-100 text-center text-xs text-slate-450 font-semibold">
          تحت رعاية وزارة التربية والتعليم الأولي والرياضة • مدرسة الغد الرقمية
        </footer>
      </div>
    );
  }

  // default / bento View layout (Bento classroom simulation layout)
  return (
    <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-emerald-50 min-h-screen text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* Upper Universal Moroccan Banner */}
      <header className="bg-white border-b border-indigo-100 sticky top-0 z-40 shadow-sm px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-2.5 rounded-xl shadow-md">
            <Crown className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-wide font-sans">
              🏆 مسابقات القسم التفاعلية
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              المنصة المدرسية المغربية لغرف التحدي والمراجعة الشاملة (شبيه Kahoot المطور)
            </p>
          </div>
        </div>

        {/* Dynamic Active Room Info Bar */}
        {roomPin && currentRoom && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-1.5 text-center flex items-center gap-3 justify-center">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="text-xs text-slate-600 font-bold">
              غرفة القسم نشطة الآن: <strong className="text-emerald-700 bg-emerald-100 rounded-lg px-2.5 py-1 text-sm font-mono">{roomPin}</strong>
            </div>
            <div className="h-4 w-px bg-emerald-200"></div>
            <div className="text-xs text-slate-600 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              المتعلمين: <b className="text-emerald-800">{Object.keys(currentRoom.players).length}</b>
            </div>
          </div>
        )}

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border">
          <button 
            onClick={() => navigateTo('bento')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeLayout === 'bento' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💻 عرض المحاكاة المجمع (بينتو)
          </button>
          <div className="w-px bg-slate-200 mx-1"></div>
          <button 
            onClick={() => navigateTo('teacher')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              (activeLayout as string) === 'teacher' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            👨‍🏫 الأستاذ
          </button>
          <button 
            onClick={() => navigateTo('projector')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              (activeLayout as string) === 'projector' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-teal-600'
            }`}
          >
            📺 البروجيكتور
          </button>
          <button 
            onClick={() => navigateTo('student')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              (activeLayout as string) === 'student' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-rose-600'
            }`}
          >
            🎒 التلميذ
          </button>
          <button 
            onClick={() => navigateTo('model-ai')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeLayout === 'model-ai' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-600'
            }`}
          >
            🪄 ذكاء اصطناعي
          </button>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 p-6 max-w-[1700px] mx-auto w-full space-y-6">
        
        {/* Layout 1: Bento view simulation (Best for reviewing the full concurrent interaction!) */}
        {activeLayout === 'bento' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            
            {/* Column Left: Teacher Control Workspace (xl:col-span-4) */}
            <div className="xl:col-span-4 flex flex-col bg-white rounded-3xl shadow-xl border border-indigo-100 overflow-hidden">
              <div className="bg-indigo-950 p-4 text-white flex justify-between items-center flex-row-reverse border-b">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-300" />
                  <h3 className="font-bold text-sm">لوحة تحكم الأستاذ (البينتو)</h3>
                </div>
                {isTeacherAuthenticated ? (
                  <button
                    onClick={() => {
                      setIsTeacherAuthenticated(false);
                      localStorage.removeItem('school_teacher_auth');
                    }}
                    className="text-[10px] bg-red-650 hover:bg-red-700 bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold transition-colors cursor-pointer"
                    title="قفل لوحة الإشراف"
                  >
                    قفل 🔐
                  </button>
                ) : (
                  <span className="text-[10px] bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full font-bold">بوابة المعارك 🔐</span>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col space-y-4 justify-center">
                {!isTeacherAuthenticated ? (
                  <TeacherPasscodeLock onUnlock={() => {
                    setIsTeacherAuthenticated(true);
                    localStorage.setItem('school_teacher_auth', 'true');
                  }} />
                ) : (
                  <TeacherPanel 
                    quizzes={quizzes}
                    selectedQuizId={selectedQuizId}
                    setSelectedQuizId={setSelectedQuizId}
                    onCreateRoom={handleCreateRoom}
                    isCreatingRoom={isCreatingRoom}
                    room={currentRoom}
                    onStartQuiz={handleStartQuiz}
                    onNextAction={handleNextAction}
                    onShowLeaderboard={handleShowLeaderboard}
                    onTerminate={handleTerminateRoom}
                    onSkip={handleSkipQuestionTimer}
                    activeQuestion={activeQuestion}
                  />
                )}
              </div>
            </div>

            {/* Column Center: Projector Class Main View (xl:col-span-5) */}
            <div className="xl:col-span-5 flex flex-col bg-slate-900 rounded-3xl shadow-2xl border-4 border-slate-950 overflow-hidden relative">
              <div className="bg-slate-950 px-4 py-2.5 text-slate-300 flex justify-between items-center text-xs flex-row-reverse font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                  شاشة الإسقاط الكبرى بالقسم (البروجيكتور)
                </span>
                <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">شاشة سينمائية هولا</span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between min-h-[480px]">
                <ProjectorView 
                  room={currentRoom} 
                  activeQuestion={activeQuestion} 
                  quizzes={quizzes}
                />
              </div>
            </div>

            {/* Column Right: Student Handheld Device (xl:col-span-3) */}
            <div className="xl:col-span-3 flex flex-col bg-slate-100 rounded-[2.5rem] shadow-xl border-8 border-slate-300 overflow-hidden relative" style={{ minHeight: '520px' }}>
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 h-4 w-28 bg-slate-300 rounded-full z-20 flex items-center justify-center">
                <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
              </div>
              <div className="bg-orange-600 p-4 text-white text-center pt-8 font-black flex justify-between items-center flex-row-reverse shadow-inner">
                <span className="text-xs">جهاز تلميذ محاكى 📱</span>
                <span className="text-[10px] bg-orange-700/60 text-orange-200 px-2 py-0.5 rounded-full">المتعلم</span>
              </div>
              <div className="p-5 flex-1 bg-white flex flex-col overflow-y-auto justify-between">
                <StudentDevice 
                  room={currentRoom}
                  studentName={studentName}
                  setStudentName={setStudentName}
                  studentAvatar={studentAvatar}
                  setStudentAvatar={setStudentAvatar}
                  studentRoomPinInput={studentRoomPinInput}
                  setStudentRoomPinInput={setStudentRoomPinInput}
                  onJoin={handleStudentJoin}
                  hasJoined={hasStudentJoined}
                  playerId={studentPlayerId}
                  feedback={studentFeedbackMessage}
                  onAnswerSubmitted={handleStudentSubmitAnswer}
                  activeQuestion={activeQuestion}
                  onLeave={handleTerminateRoom}
                />
              </div>
            </div>

          </div>
        )}

        {/* Solo layouts (Bypassed if loaded directly, but preserved for development layout selector fallback) */}
        {(activeLayout as string) === 'teacher' && (
          <div className="bg-white rounded-3xl shadow-xl border border-indigo-100 overflow-hidden p-6 max-w-4xl mx-auto">
            <h3 className="font-bold text-xl text-slate-900 border-b pb-4 mb-4 flex items-center gap-2">
              <Laptop className="w-6 h-6 text-indigo-600" />
              منصة إدارة الحصة والألعاب (خاص بالأستاذ)
            </h3>
            <TeacherPanel 
              quizzes={quizzes}
              selectedQuizId={selectedQuizId}
              setSelectedQuizId={setSelectedQuizId}
              onCreateRoom={handleCreateRoom}
              isCreatingRoom={isCreatingRoom}
              room={currentRoom}
              onStartQuiz={handleStartQuiz}
              onNextAction={handleNextAction}
              onShowLeaderboard={handleShowLeaderboard}
              onTerminate={handleTerminateRoom}
              onSkip={handleSkipQuestionTimer}
              activeQuestion={activeQuestion}
            />
          </div>
        )}

        {(activeLayout as string) === 'projector' && (
          <div className="bg-slate-900 rounded-3xl shadow-2xl border-8 border-slate-950 overflow-hidden p-8 max-w-6xl mx-auto min-h-[600px] flex flex-col justify-between">
            <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center text-slate-400 text-sm">
              <span className="font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                شاشة القسم العريضة (بروجيكتور الصف)
              </span>
              <span>رمز PIN للعب: <strong className="text-white text-lg font-mono">{roomPin || 'غير نشط'}</strong></span>
            </div>
            <ProjectorView 
              room={currentRoom} 
              activeQuestion={activeQuestion} 
              quizzes={quizzes}
            />
          </div>
        )}

        {(activeLayout as string) === 'student' && (
          <div className="max-w-md mx-auto bg-slate-50 rounded-[2.5rem] border-8 border-slate-200 overflow-hidden shadow-2xl min-h-[620px] flex flex-col justify-between">
            <div className="bg-rose-600 p-4 pt-7 text-white text-center font-bold text-sm relative">
              ثقافة مغربية مرحة - جهاز المتعلم البطل 🦁
            </div>
            <div className="p-6 flex-1 bg-white flex flex-col overflow-y-auto justify-between">
              <StudentDevice 
                room={currentRoom}
                studentName={studentName}
                setStudentName={setStudentName}
                studentAvatar={studentAvatar}
                setStudentAvatar={setStudentAvatar}
                studentRoomPinInput={studentRoomPinInput}
                setStudentRoomPinInput={setStudentRoomPinInput}
                onJoin={handleStudentJoin}
                hasJoined={hasStudentJoined}
                playerId={studentPlayerId}
                feedback={studentFeedbackMessage}
                onAnswerSubmitted={handleStudentSubmitAnswer}
                activeQuestion={activeQuestion}
                onLeave={handleTerminateRoom}
              />
            </div>
          </div>
        )}

        {/* AI Generator Panel tab */}
        {activeLayout === 'model-ai' && !isTeacherAuthenticated && (
          <div className="max-w-md mx-auto my-12">
            <TeacherPasscodeLock onUnlock={() => {
              setIsTeacherAuthenticated(true);
              localStorage.setItem('school_teacher_auth', 'true');
            }} />
          </div>
        )}

        {((activeLayout === 'model-ai' && isTeacherAuthenticated) || (activeLayout === 'bento' && isTeacherAuthenticated)) && (
          <div className="mt-8">
            <AIGenerator onQuizAdded={handleNewQuizAdded} />
          </div>
        )}

        {/* Structural Database Viewer */}
        <div className="mt-8">
          <DatabaseVisualizer 
            room={currentRoom} 
            activeQuestion={activeQuestion} 
            quizzes={quizzes} 
          />
        </div>

      </main>
    </div>
  );
}

// -------------------------------------------------------------
// CHILD COMPONENT 1: TEACHER COOP PANEL
// -------------------------------------------------------------
interface TeacherPanelProps {
  quizzes: QuizSet[];
  selectedQuizId: string;
  setSelectedQuizId: (id: string) => void;
  onCreateRoom: () => void;
  isCreatingRoom: boolean;
  room: Room | null;
  onStartQuiz: () => void;
  onNextAction: () => void;
  onShowLeaderboard: () => void;
  onTerminate: () => void;
  onSkip: () => void;
  activeQuestion: Question | null;
}

function TeacherPanel({
  quizzes,
  selectedQuizId,
  setSelectedQuizId,
  onCreateRoom,
  isCreatingRoom,
  room,
  onStartQuiz,
  onNextAction,
  onShowLeaderboard,
  onTerminate,
  onSkip,
  activeQuestion
}: TeacherPanelProps) {
  
  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);

  // If no room is created, show Quiz list and setup controls
  if (!room) {
    return (
      <div className="space-y-5 text-right font-sans" dir="rtl">
        <div>
          <h4 className="font-black text-indigo-950 text-sm mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            ١. اختر المسابقة الدراسية للقسم:
          </h4>
          <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                onClick={() => setSelectedQuizId(quiz.id)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  selectedQuizId === quiz.id
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                    : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex justify-between items-start flex-row gap-2">
                  <span className="text-[10px] bg-slate-200 text-slate-750 px-2 py-0.5 rounded-lg font-extrabold whitespace-nowrap">
                    {quiz.level}
                  </span>
                  <div className="text-right flex-1">
                    <h5 className="font-bold text-slate-900 text-sm">{quiz.title}</h5>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{quiz.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-between items-center text-[10px] text-indigo-700 font-extrabold border-t border-slate-150/50 pt-2">
                  <span>المادة: {quiz.subject}</span>
                  <span>الأسئلة: {quiz.questions.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedQuiz && (
          <div className="bg-gradient-to-br from-indigo-50/40 to-indigo-100/10 p-4 rounded-2xl border border-indigo-100/80 text-xs text-slate-700 space-y-2">
            <h5 className="font-black text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              تفاصيل المحتوى النشط بالقسم:
            </h5>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>المستوى المستهدف: <b className="text-indigo-950">{selectedQuiz.level}</b></div>
              <div>المادة الدراسية: <b className="text-indigo-955">{selectedQuiz.subject}</b></div>
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed pt-1.5 border-t border-indigo-100/50">
              سير الأسئلة: {selectedQuiz.questions.map((q, idx) => `[س${idx + 1}: ${q.text.substring(0, 15)}...] `).join(' ➜ ')}
            </div>
          </div>
        )}

        <button
          onClick={onCreateRoom}
          disabled={isCreatingRoom}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-3 rounded-2xl transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isCreatingRoom ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري تهيئة خادم لقاعة القسم...</span>
            </div>
          ) : (
            <>
              <span>تفعيل وتوليد رمز PIN للقسم المباشر 🚀</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Room is active! Display console actions
  const totalQuestions = quizzes.find(q => q.id === room.activeQuizId)?.questions.length || 0;
  const currQNum = room.currentQuestionIndex + 1;
  const totalPlayersCount = Object.keys(room.players).length;
  const answeredCount = Object.values(room.players).filter(p => p.answerIndex !== null).length;
  const answerPercentage = totalPlayersCount > 0 ? Math.round((answeredCount / totalPlayersCount) * 100) : 0;

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Active Room Connection Badge */}
      <div className="flex justify-between items-center bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-2xl border border-slate-200">
        <div>
          <span className="block text-[10px] text-slate-400 font-extrabold mb-1">الرقم السري للقسم PIN:</span>
          <strong className="text-2xl font-mono text-indigo-950 tracking-widest font-black">{room.pin}</strong>
        </div>
        <div className="text-left font-bold text-slate-700">
          <span className="text-[10px] text-slate-450 block mb-0.5">حالة اللعبة المباشرة:</span>
          <span className="inline-block text-[11px] bg-indigo-100 text-indigo-800 font-extrabold rounded-lg px-2.5 py-1 font-mono uppercase">
            {room.state}
          </span>
        </div>
      </div>

      {/* State 1: WAITING FOR PLAYERS TO JOIN LOBBY */}
      {room.state === 'waiting' && (
        <div className="space-y-4 bg-indigo-50/50 p-4.5 rounded-2xl border border-indigo-100 text-center">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            الرجاء توجيه الأطفال لإدخال الرمز <b className="text-indigo-950 text-sm font-mono tracking-wider">{room.pin}</b> واختيار رموز الهوية.
          </p>
          <div className="bg-white p-4 rounded-xl border border-indigo-100">
            <span className="text-xs text-slate-400 font-extrabold block mb-1">المتعلمين المتصلين حالياً بالقاعة:</span>
            <div className="text-2xl font-black text-indigo-600 mt-0.5">
              {totalPlayersCount}
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mt-3 p-2 bg-slate-50/80 rounded-xl border border-slate-100 max-h-[140px] overflow-y-auto">
              {Object.values(room.players).map(p => (
                <span key={p.id} className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
                  <span>{p.avatar}</span>
                  <strong className="text-slate-800 text-[11px]">{p.name}</strong>
                </span>
              ))}
              {totalPlayersCount === 0 && (
                <span className="text-xs text-slate-400 italic py-1">في انتظار التحاق الأبطال... 🦁</span>
              )}
            </div>
          </div>

          <button
            onClick={onStartQuiz}
            disabled={totalPlayersCount === 0}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-black text-sm py-3 rounded-2xl shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            {totalPlayersCount === 0 ? (
              <span>في انتظار انضمام طفل واحد على الأقل... 🎒</span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>إطلاق السؤال الأول للجميع 🚀</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* State 2: QUESTIONS & COMMANDS IN PROGRESS */}
      {(room.state === 'question_countdown' || room.state === 'question_active' || room.state === 'question_result' || room.state === 'leaderboard') && (
        <div className="space-y-4 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-250">
          <div className="flex justify-between items-center border-b border-slate-150 pb-3 flex-row text-xs">
            <span className="text-indigo-600 font-mono font-bold uppercase py-0.5 px-2 bg-indigo-50 rounded-md">حالة: {room.state}</span>
            <span className="font-extrabold text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded-md">السؤال {currQNum} من أصل {totalQuestions}</span>
          </div>

          {activeQuestion && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-right space-y-1 shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold block">النص المعروض للتلاميذ:</span>
              <p className="font-bold text-slate-800 text-xs leading-relaxed">{activeQuestion.text}</p>
            </div>
          )}

          {/* ACTIVE LIVE STATISTICS (GAMES IN PLAY) */}
          {room.state === 'question_active' && (
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">معدل الإرسال الفوري للقسم:</span>
                <span className="font-black text-indigo-750 font-mono">{answeredCount} / {totalPlayersCount} ({answerPercentage}%)</span>
              </div>
              <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden flex flex-row-reverse shadow-inner">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${answerPercentage || 2}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 italic text-center">
                أجابت {answeredCount} من أصل {totalPlayersCount} مجموعات نشطة حالياً.
              </p>
            </div>
          )}

          {/* DYNAMIC REAL REMOTE CMDS */}
          <div className="space-y-3 pt-2">
            {/* 1. LAUNCH BUTTON (If countdown stage, countdown automatically advances or teacher can prompt launch) */}
            {room.state === 'question_countdown' && (
              <div className="text-center p-2.5 bg-indigo-50/45 rounded-xl border border-indigo-150 text-xs space-y-2">
                <div className="font-bold text-indigo-950 flex items-center justify-center gap-1.5 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  جاري العد التنازلي للتلميذ...
                </div>
                <p className="text-[10px] text-slate-500">
                  يرجى الانتظار 3 ثواني ليفتح السؤال تلقائياً.
                </p>
              </div>
            )}

            {/* 2. STOP TIMER BUTTON ("إيقاف المؤقت") */}
            {room.state === 'question_active' && (
              <button
                onClick={onSkip}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-2xl cursor-pointer transition-all shadow-md shadow-rose-200 active:scale-98 flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>إيقاف المؤقت فورياً ⏱️</span>
              </button>
            )}

            {/* 3. SHOW LEADERBOARD BUTTON */}
            {room.state === 'question_result' && (
              <button
                onClick={onShowLeaderboard}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-purple-200 active:scale-98"
              >
                <Trophy className="w-4 h-4 text-purple-200 fill-current" />
                <span>عرض لوحة الصدارة بالقسم 🏆</span>
              </button>
            )}

            {/* 4. NEXT QUESTION BUTTON ("السؤال التالي") */}
            {room.state === 'leaderboard' && (
              <button
                onClick={onNextAction}
                className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-200 active:scale-98"
              >
                <span>السؤال التالي {currQNum === totalQuestions ? 'إلى التتويج 👑' : '➜'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 3: FINISHED GAME COOLDOWN */}
      {room.state === 'finished' && (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-center space-y-3 shadow-inner">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
          <h5 className="font-black text-amber-850 text-base">انتهت الجولات كاملة بنجاح!</h5>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            تم تتويج التلاميذ الفائزين على شاشة البروجيكتور المباشرة بنجاح عارم بالقسم.
          </p>
        </div>
      )}

      {/* Terminate Session Button */}
      <button
        onClick={onTerminate}
        className="w-full bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-700 font-extrabold text-xs py-2.5 rounded-2xl flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
      >
        <span>إنهاء الحصة النشطة وتصفير الغرفة 🛑</span>
      </button>
    </div>
  );
}

// -------------------------------------------------------------
// CHILD COMPONENT 2: PROJECTOR SYNCHRONIZED SCREEN
// -------------------------------------------------------------
interface ProjectorViewProps {
  room: Room | null;
  activeQuestion: Question | null;
  quizzes: QuizSet[];
}

function ProjectorView({ room, activeQuestion, quizzes }: ProjectorViewProps) {
  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8 space-y-4 font-sans" dir="rtl">
        <Laptop className="w-16 h-16 text-indigo-400 animate-pulse-ring" />
        <div>
          <h4 className="text-white font-extrabold text-xl">بوابة العرض السينمائي والبروجيكتور للقسم 📺</h4>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            عند تفعيل الأستاذ للعبة أو رمز PIN، سيتم إسقاط الأسئلة والعداد الملون الدائري ولوحة الصدارة المتحركة هنا بشكل متزامن ممتع!
          </p>
        </div>
      </div>
    );
  }

  // 1. Waiting lobby
  if (room.state === 'waiting') {
    return (
      <div className="flex-1 flex flex-col justify-between text-white text-right p-6 font-sans" dir="rtl">
        <div className="text-center">
          <span className="inline-block bg-emerald-500/20 text-emerald-350 border border-emerald-500/30 px-4.5 py-1.5 rounded-full text-xs font-black animate-pulse-ring">
            بوابة الانضمام المباشر والمرح بالقسم 🚀
          </span>
          <h3 className="text-3xl font-black text-amber-300 mt-5 leading-relaxed drop-shadow-sm">
            تحدي: {quizzes.find(q => q.id === room.activeQuizId)?.title}
          </h3>
          <p className="text-xs text-slate-300 mt-2 font-medium">المرجو التسجيل من الأجهزة المحمولة والطاولات باستعمال المعطيات الآتية:</p>
        </div>

        {/* Big Code Showcase */}
        <div className="my-6 bg-slate-900/90 p-8 rounded-3xl border-2 border-dashed border-indigo-500/40 text-center space-y-3 shadow-2xl relative overflow-hidden backdrop-blur">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
          <span className="text-slate-400 text-xs font-black block tracking-wider">الرمز السري لدخول الغرفة PIN</span>
          <div className="text-6xl md:text-7xl font-mono font-black text-emerald-400 tracking-widest drop-shadow-lg select-all animate-pulse">
            {room.pin}
          </div>
          <span className="text-[11px] text-indigo-200 block mt-2 font-semibold">
            سارع بالدخول واكتب اسمك المميز واختر مرافقك المفضل للسباق!
          </span>
        </div>

        {/* Realtime Players count & names */}
        <div className="space-y-3 bg-slate-950/60 p-5 rounded-3xl border border-slate-800/80 shadow-md">
          <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-800 pb-3 flex-row">
            <span className="font-extrabold bg-indigo-900/40 px-3 py-1 rounded-xl border border-indigo-850 text-indigo-300"><b>{Object.keys(room.players).length}</b> متسابق(ة) بالصف</span>
            <span className="font-bold text-slate-300">أبطال القسم النشطين حالياً:</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2.5 max-h-[160px] overflow-y-auto pt-2">
            {Object.values(room.players).map((p) => (
              <div
                key={p.id}
                className="bg-slate-900/90 border border-slate-800/90 py-2 px-3.5 rounded-2xl text-xs font-black flex items-center gap-2 animate-bounce-slow shadow-sm"
              >
                <span className="text-base">{p.avatar}</span>
                <span className="text-white font-bold">{p.name}</span>
              </div>
            ))}
            {Object.keys(room.players).length === 0 && (
              <p className="text-xs text-slate-500 italic py-4">في انتظار التحاق أول تلميذ أو تلميذة بالصف للبدء... 🎒</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Countdown State (Pre-Question 3s focus)
  if (room.state === 'question_countdown') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-white space-y-6 font-sans" dir="rtl">
        <div className="bg-indigo-600/30 p-5 rounded-full border border-indigo-500/30 text-indigo-400 animate-spin text-2xl">
          🌀
        </div>
        <div className="space-y-2">
          <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-xs font-black block uppercase tracking-wider mx-auto w-max">
            استعد وانتبه للسبورة يا بطل!
          </span>
          <h4 className="text-4xl font-black mt-2 text-slate-100">
            السؤال {room.currentQuestionIndex + 1}
          </h4>
        </div>
        <div className="text-8xl font-mono text-emerald-400 font-extrabold animate-ping">
          {room.secondsRemaining > 0 ? room.secondsRemaining : 'انطلق!'}
        </div>
      </div>
    );
  }

  // 3. Question Active (Show current options & countdown)
  if (room.state === 'question_active' && activeQuestion) {
    const totalPlayersCount = Object.keys(room.players).length;
    const submissionCount = Object.values(room.players).filter(p => p.answerIndex !== null).length;

    // Huge circular countdown values
    const limit = activeQuestion.timeLimit || 20;
    const percent = Math.min(100, Math.max(0, (room.secondsRemaining / limit) * 100));
    const radius = 40;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    // Change colors based on urgency: green -> yellow -> red
    let strokeColor = 'stroke-emerald-500 text-emerald-400';
    let ringPulseClass = '';
    if (percent <= 25) {
      strokeColor = 'stroke-rose-600 text-rose-500';
      ringPulseClass = 'bg-rose-500/10 animate-ping';
    } else if (percent <= 50) {
      strokeColor = 'stroke-yellow-500 text-yellow-400';
    }

    return (
      <div className="flex-1 flex flex-col justify-between text-white text-right font-sans p-4" dir="rtl">
        {/* Upper Stats bar & Super Circular Timer */}
        <div className="flex justify-between items-center bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex-row">
          
          {/* Circular Countdown widget */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-20 h-20">
              {ringPulseClass && <div className={`absolute inset-1 rounded-full ${ringPulseClass}`}></div>}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  className="stroke-slate-800 fill-transparent"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  className={`fill-transparent transition-all duration-1000 ease-linear ${strokeColor}`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black font-mono tracking-tighter leading-none">{room.secondsRemaining}</span>
                <span className="text-[8px] font-extrabold text-slate-400">ثانية</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 block font-bold">{activeQuestion.level}</span>
              <span className="bg-indigo-900 text-indigo-300 rounded-lg px-2 py-0.5 text-[10px] font-extrabold border border-indigo-800">{activeQuestion.subject}</span>
            </div>
          </div>

          {/* Submissions count */}
          <div className="text-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 shadow-sm">
            <span className="text-[10px] text-slate-450 block font-black">أجاب للآن:</span>
            <strong className="text-2xl font-black text-emerald-400 font-mono tracking-wide">
              {submissionCount} <span className="text-xs text-slate-400">/ {totalPlayersCount}</span>
            </strong>
          </div>
        </div>

        {/* Question Text in gorgeous large display */}
        <div className="bg-slate-950 p-6 md:p-8 rounded-3xl border-2 border-slate-800 text-center my-4 relative shadow-2xl">
          <p className="text-xl md:text-2xl font-black text-slate-100 leading-relaxed font-sans select-none">
            {activeQuestion.text}
          </p>
          {activeQuestion.subComponent && (
            <span className="inline-block mt-3 text-xs bg-indigo-900/40 text-indigo-300 px-3.5 py-1 rounded-full border border-indigo-500/20 font-bold">
              المكوّن: {activeQuestion.subComponent}
            </span>
          )}
        </div>

        {/* Options grid with beautiful large tiles and geometric shapes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {activeQuestion.options.map((option, idx) => {
            const geoms = ['🔺', '🔷', '🟡', '🟩'];
            // 4 high-contrast custom bright presets safe for standard projector light environments
            const colorPresets = [
              'bg-gradient-to-br from-rose-600 to-rose-700 border-rose-450 text-white shadow-rose-950/40',
              'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-450 text-white shadow-blue-950/40',
              'bg-gradient-to-br from-amber-400 to-yellow-500 border-yellow-300 text-slate-950 shadow-yellow-950/20',
              'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-450 text-white shadow-emerald-950/40'
            ];
            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border-2 flex items-center gap-4 flex-row justify-between transition-all duration-300 shadow-lg ${colorPresets[idx]}`}
              >
                <div className="flex-1 text-right font-black text-sm md:text-base pr-2 leading-relaxed whitespace-normal break-words">
                  {option}
                </div>
                <span className="text-3xl bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner select-none shrink-0">{geoms[idx]}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Question Results (Show correct mark & answer charts)
  if (room.state === 'question_result' && activeQuestion) {
    const answersDistribution = [0, 0, 0, 0];
    Object.values(room.players).forEach(p => {
      if (p.answerIndex !== null && p.answerIndex >= 0 && p.answerIndex < 4) {
        answersDistribution[p.answerIndex]++;
      }
    });

    const totalAnswers = answersDistribution.reduce((a, b) => a + b, 0);

    return (
      <div className="flex-1 flex flex-col justify-between text-white text-right font-sans p-4" dir="rtl">
        <div>
          <span className="inline-block bg-teal-500/10 text-teal-350 font-black border border-teal-500/20 px-4 py-1.5 rounded-full text-xs animate-pulse">
            تم إغلاق الإجابات والتحقق بالقسم 🎯
          </span>
          <h4 className="text-base font-bold text-slate-350 mt-3 leading-relaxed">
            السؤال: {activeQuestion.text}
          </h4>
        </div>

        {/* Horizontal Answer Bars chart representation */}
        <div className="my-4 space-y-4 bg-slate-950 p-5 rounded-3xl border border-slate-800">
          {activeQuestion.options.map((option, idx) => {
            const geoms = ['🔺', '🔷', '🟡', '🟩'];
            const colorClasses = [
              'bg-gradient-to-r from-rose-500 to-rose-600 text-white',
              'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
              'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950',
              'bg-gradient-to-r from-emerald-500 to-teal-650 text-white'
            ];
            const borderClasses = [
              'border-rose-500/45',
              'border-blue-500/45',
              'border-yellow-500/45',
              'border-emerald-500/45'
            ];
            const count = answersDistribution[idx];
            const pct = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
            const isCorrect = idx === activeQuestion.correctIndex;

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs flex-row">
                  <span className="font-mono text-slate-450 font-bold">
                    {count} متسابق ({pct.toFixed(0)}%)
                  </span>
                  <div className="flex items-center gap-2 flex-row">
                    {isCorrect && (
                      <span className="bg-emerald-600/95 border border-emerald-400 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 shadow">
                        <Check className="w-3 h-3" /> صحيح
                      </span>
                    )}
                    <span className="font-black text-xs text-white">{geoms[idx]} {option}</span>
                  </div>
                </div>
                <div className={`w-full bg-slate-900 h-4 rounded-full overflow-hidden flex flex-row border ${borderClasses[idx]}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClasses[idx]}`}
                    style={{ width: `${pct || 1.5}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Correct option badge */}
        <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 p-4.5 rounded-2xl border border-indigo-900/50 flex items-center justify-between text-xs flex-row">
          <strong className="text-emerald-400 text-sm font-black">
            {['أ', 'ب', 'ج', 'د'][activeQuestion.correctIndex]} . {activeQuestion.options[activeQuestion.correctIndex]}
          </strong>
          <span className="text-indigo-300 font-extrabold text-xs">الإجابة النموذجية المعتمدة المغربية:</span>
        </div>
      </div>
    );
  }

  // 5. Leaderboard (Classroom Podiums scoreboard)
  if (room.state === 'leaderboard') {
    const topPlayers = Object.values(room.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return (
      <div className="flex-1 flex flex-col justify-between text-white text-right font-sans p-4" dir="rtl">
        <div className="text-center border-b border-slate-800 pb-4 mb-3">
          <Trophy className="w-10 h-10 text-amber-500 mx-auto animate-bounce-slow" />
          <h3 className="text-2xl font-black text-amber-300 mt-2">لوحة الصدارة والترتيب المباشر 🏆</h3>
          <p className="text-xs text-slate-400 mt-1">تثبيت وتنافس التلاميذ المتألقين في الحساب والعقيدة</p>
        </div>

        <div className="space-y-3 mt-1 flex-1">
          {topPlayers.map((player, idx) => {
            const streaksIcon = player.streak >= 2 ? '🔥' : '';
            const rankBg = [
              'bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 border-amber-500 text-amber-300 shadow-amber-950/20',
              'bg-gradient-to-r from-slate-400/15 via-slate-900 to-slate-950 border-slate-300 text-slate-300',
              'bg-gradient-to-r from-amber-700/15 via-slate-900 to-slate-950 border-amber-700 text-amber-600',
              'bg-slate-900 border-slate-800 text-slate-450',
              'bg-slate-900 border-slate-800 text-slate-450'
            ];

            const rankMedals = ['🥇', '🥈', '🥉', '🏅', '🏅'];

            return (
              <div
                key={player.id}
                className={`py-3 px-4.5 rounded-2xl border flex justify-between items-center flex-row transition-all duration-300 shadow ${rankBg[idx] || 'bg-slate-900 border-slate-800'}`}
              >
                <div>
                  <strong className="text-base font-black font-mono tracking-wide">{player.score}</strong>
                  <span className="text-[10px] text-slate-400 mr-1.5">نقطة</span>
                </div>
                <div className="flex items-center gap-3 flex-row">
                  {streaksIcon && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-lg font-black flex items-center gap-1">
                      {streaksIcon} {player.streak} صح متتالي
                    </span>
                  )}
                  <span className="font-extrabold text-sm text-white">{player.name}</span>
                  <span className="text-lg bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center">{player.avatar}</span>
                  <span className="font-extrabold text-[13px] w-6 text-center">{rankMedals[idx]}</span>
                </div>
              </div>
            );
          })}

          {topPlayers.length === 0 && (
            <p className="text-slate-500 text-center py-10 italic text-xs">لا يوجد بيانات لعرضها لأن القسم فارغ حالياً.</p>
          )}
        </div>
      </div>
    );
  }

  // 6. Finished
  if (room.state === 'finished') {
    const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
    const gold = sorted[0];
    const silver = sorted[1];
    const bronze = sorted[2];

    return (
      <div className="flex-1 flex flex-col justify-between text-white text-center font-sans p-4" dir="rtl">
        <div>
          <h2 className="text-3xl font-black text-amber-400 animate-bounce">👑 أبطال التحدي النهائي بالقسم 👑</h2>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">هنيئاً لكم جميعاً شرف المحاولة والصدارة يا نوابغ الوطن الحبيب!</p>
        </div>

        {/* Podium View */}
        <div className="my-6 flex justify-center items-end gap-4 max-w-sm mx-auto h-[220px]">
          
          {/* Silver - 2nd Place */}
          {silver && (
            <div className="flex flex-col items-center">
              <span className="text-2xl">{silver.avatar}</span>
              <span className="text-xs font-bold text-slate-350 block mt-1 line-clamp-1 max-w-[80px]">{silver.name}</span>
              <span className="text-[10px] text-slate-400 font-bold block">{silver.score} ن</span>
              <div className="bg-slate-500 w-24 h-24 mt-2 rounded-t-2xl flex flex-col justify-center items-center shadow-md">
                <span className="text-2xl font-black text-slate-300">🥈</span>
                <span className="text-[10px] text-white/90 font-black">المرتبة ٢</span>
              </div>
            </div>
          )}

          {/* Gold - 1st Place */}
          {gold && (
            <div className="flex flex-col items-center z-10">
              <span className="text-3xl animate-bounce-slow">👑</span>
              <span className="text-3xl mt-1">{gold.avatar}</span>
              <span className="text-xs font-black text-amber-300 block mt-1 line-clamp-1 max-w-[85px]">{gold.name}</span>
              <span className="text-[10px] text-slate-350 font-bold block">{gold.score} ن</span>
              <div className="bg-gradient-to-t from-yellow-700 to-amber-500 w-28 h-32 mt-2 rounded-t-2xl flex flex-col justify-center items-center shadow-2xl border-2 border-amber-300">
                <span className="text-3xl font-black text-white">🥇</span>
                <span className="text-[11px] text-white font-black">البطل الأوّل</span>
              </div>
            </div>
          )}

          {/* Bronze - 3rd Place */}
          {bronze && (
            <div className="flex flex-col items-center">
              <span className="text-2xl">{bronze.avatar}</span>
              <span className="text-xs font-bold text-amber-750 block mt-1 line-clamp-1 max-w-[80px]">{bronze.name}</span>
              <span className="text-[10px] text-slate-400 font-bold block">{bronze.score} ن</span>
              <div className="bg-amber-850 w-24 h-20 mt-2 rounded-t-2xl flex flex-col justify-center items-center shadow-md">
                <span className="text-2xl font-black text-amber-600">🥉</span>
                <span className="text-[10px] text-white/90 font-black">المرتبة ٣</span>
              </div>
            </div>
          )}

        </div>

        {!gold && (
          <p className="text-xs text-slate-500 italic py-6">لم يشارك أحد في هذا السباق بعد.</p>
        )}
      </div>
    );
  }

  return null;
}

// -------------------------------------------------------------
// CHILD COMPONENT 3: STUDENTS DEVICE COOP MODULE
// -------------------------------------------------------------
interface StudentDeviceProps {
  room: Room | null;
  studentName: string;
  setStudentName: (val: string) => void;
  studentAvatar: string;
  setStudentAvatar: (val: string) => void;
  studentRoomPinInput: string;
  setStudentRoomPinInput: (val: string) => void;
  onJoin: (e: React.FormEvent) => void;
  hasJoined: boolean;
  playerId: string | null;
  feedback: string | null;
  onAnswerSubmitted: (idx: number) => void;
  activeQuestion: Question | null;
  onLeave: () => void;
}

function StudentDevice({
  room,
  studentName,
  setStudentName,
  studentAvatar,
  setStudentAvatar,
  studentRoomPinInput,
  setStudentRoomPinInput,
  onJoin,
  hasJoined,
  playerId,
  feedback,
  onAnswerSubmitted,
  activeQuestion,
  onLeave
}: StudentDeviceProps) {

  // 1- Registration Form (Entering Room)
  if (!hasJoined || !room) {
    return (
      <div className="space-y-4 text-right" dir="rtl">
        <div>
          <h4 className="font-extrabold text-slate-800 text-sm">🎒 انضم إلى مسابقة القسم الفورية!</h4>
          <p className="text-xs text-slate-500 mt-1">أدخل الرمز السري الذي يعرضه الأستاذ على الشاشة وابدأ في حصد النجوم.</p>
        </div>

        <form onSubmit={onJoin} className="space-y-3">
          {/* Room PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">رمز الغرفة (PIN Code):</label>
            <input
              type="text"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="مثال: 9483"
              value={studentRoomPinInput}
              onChange={(e) => setStudentRoomPinInput(e.target.value)}
              className="w-full text-center bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 font-mono text-xl font-bold tracking-widest text-slate-800 focus:border-orange-500 outline-none"
            />
          </div>

          {/* Name input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">اسمك الشخصي (أو لقبك الصغير):</label>
            <input
              type="text"
              maxLength={12}
              placeholder="مثال: يوسف، فاطمة..."
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm text-slate-700 font-semibold focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          {/* Morocco Avatar Choice list */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">اختر تمثالك ومرافقك المفضل 🦁:</label>
            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2 rounded-xl border">
              {MOROCCAN_AVATARS.map((avatar) => (
                <button
                  key={avatar.char}
                  type="button"
                  title={avatar.name}
                  onClick={() => setStudentAvatar(avatar.char)}
                  className={`text-xl p-1.5 rounded-lg transition-transform ${
                    studentAvatar === avatar.char
                      ? 'bg-orange-500/25 border-orange-500 border Scale-110 drop-shadow'
                      : 'hover:bg-slate-200'
                  }`}
                >
                  {avatar.char}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1 text-center">المرافق النشط حالياً: <b>{MOROCCAN_AVATARS.find(x => x.char === studentAvatar)?.name}</b></span>
          </div>

          {feedback && (
            <div className="bg-red-50 border border-red-150 p-3 rounded-xl text-xs text-red-700 text-center font-bold">
              {feedback}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black text-sm py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
          >
            ادخل اللعب وكن بطلاً! 🚀
          </button>
        </form>
      </div>
    );
  }

  // Find info about player
  const player = room.players[playerId || ''];

  // 2- Joined & Waiting in Lobby
  if (room.state === 'waiting') {
    return (
      <div className="text-center space-y-6 py-8 text-right font-sans" dir="rtl">
        <div className="text-4xl animate-bounce">{player?.avatar || '🦁'}</div>
        <h4 className="font-extrabold text-slate-900 text-lg">تم تسجيلك بنجاح، يا بطل {player?.name}! 🎉</h4>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          انظري أو انظر إلى شاشة العرض الرئيسية بالسبورة. تهدف المراجعة لتثبيت فرائض العقيدة وقواعد العربية والحساب.
        </p>

        {/* Elegant structural custom loading spinner area */}
        <div className="py-4 flex flex-col items-center justify-center space-y-3">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-300/25 border-t-amber-500 animate-spin"></div>
            <div className="absolute inset-1.5 rounded-full border-4 border-indigo-400/25 border-b-indigo-600 animate-spin-slow"></div>
          </div>
          <span className="text-[11px] text-indigo-600 font-extrabold animate-pulse">جاري انتظار الأستاذ(ة) لإطلاق السباق... ⏱️</span>
        </div>

        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-150 text-center text-xs space-y-1">
          <div className="font-bold flex items-center justify-center gap-1.5 text-base">
            <UserCheck className="w-5 h-5 text-emerald-600 animate-bounce-slow" />
            أنت مسجل بالقاعة!
          </div>
          <p className="text-[11px] text-slate-650 font-bold">سيبدأ الأستاذ المسابقة عندما يجتمع بقية التلاميذ فترقب الموعد.</p>
        </div>

        <button
          onClick={onLeave}
          className="text-xs text-slate-400 hover:text-rose-600 underline cursor-pointer pt-4 block mx-auto font-black"
        >
          خروج من القاعة 🛑
        </button>
      </div>
    );
  }

  // 3- COUNTDOWN STAGE: Prevent click & ask player to focus
  if (room.state === 'question_countdown') {
    return (
      <div className="text-center space-y-6 py-10 font-sans" dir="rtl">
        {/* Child-friendly glowing loading circle */}
        <div className="flex justify-center py-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-orange-100 animate-ping opacity-45"></div>
            <div className="absolute w-20 h-20 rounded-full border-4 border-orange-400 border-t-transparent animate-spin"></div>
            <span className="text-3xl">🎯</span>
          </div>
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-slate-800 text-base">استعد وانظر للسبورة فوراً! 📺</h4>
          <p className="text-xs text-indigo-600 font-extrabold animate-pulse">
            جاري تحضير الخيارات في هاتف السؤال {room.currentQuestionIndex + 1} ...
          </p>
        </div>
        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
          كن سريع اليد وحاد البصر وصاحب تركيز عالي للحصول على مرتبة ممتازة!
        </p>
      </div>
    );
  }

  // 4- CLIENT ACTIVE QUESTION: Show colored shape tiles corresponding to options
  if (room.state === 'question_active' && activeQuestion) {
    const hasAnswered = player?.answeredThisRound;

    if (hasAnswered) {
      return (
        <div className="text-center space-y-5 py-12 font-sans" dir="rtl">
          <div className="flex justify-center py-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-pulse"></div>
              <span className="text-3xl animate-bounce">👍</span>
            </div>
          </div>
          <h4 className="font-extrabold text-emerald-800 text-base">تم تسجيل إجابتك بنجاح!</h4>
          <p className="text-xs text-slate-500 font-bold">الرجاء انتظار بقية الزملاء بالصف، ثم تحقق من السبورة المباشرة.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-right font-sans" dir="rtl">
        <div className="flex justify-between items-center text-xs border-b pb-2">
          <span className="font-black text-slate-700">اضغط على الخيار الصحيح المتطابق:</span>
          <span className="bg-orange-100 text-orange-900 px-3 py-1 rounded-full font-mono font-black text-xs">
            {room.secondsRemaining} ثانية متبقية
          </span>
        </div>

        {/* Small preview of the question name to help student if no projector */}
        <div className="bg-slate-50 p-3 rounded-2xl text-slate-800 text-xs text-center font-bold border border-slate-100">
          السؤال: {activeQuestion.text}
        </div>

        {/* Big Touch-friendly Geometric Buttons (Kahoot style!) */}
        <div className="grid grid-cols-2 gap-4 pb-4">
          {activeQuestion.options.map((option, idx) => {
            const geomsObj = [
              { color: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white', shape: '🔺' },
              { color: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white', shape: '🔷' },
              { color: 'bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950', shape: '🟡' },
              { color: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white', shape: '🟩' }
            ];
            const currentObj = geomsObj[idx];

            return (
              <button
                key={idx}
                onClick={() => onAnswerSubmitted(idx)}
                className={`${currentObj.color} font-black h-36 rounded-3xl flex flex-col items-center justify-center p-3 text-center transition-all duration-150 shadow-lg hover:shadow-xl active:scale-95 cursor-pointer border-b-4 border-black/25 relative overflow-hidden`}
              >
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full blur-lg"></div>
                <span className="text-4xl mb-2 drop-shadow-sm">{currentObj.shape}</span>
                <span className="text-xs font-black break-all leading-tight max-h-[48px] overflow-hidden">{option}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 5- QUESTION RESULTS VIEW FOR INDIVIDUAL PLAYER
  if (room.state === 'question_result' && activeQuestion) {
    const isCorrect = player?.isCorrect;
    const pointsGained = player?.pointsGained || 0;
    const streak = player?.streak || 0;

    return (
      <div className="text-center space-y-5 py-6 text-right" dir="rtl">
        {isCorrect ? (
          <div className="space-y-3 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
            <div className="text-5xl animate-bounce">🎉</div>
            <h5 className="font-black text-emerald-800 text-base">ما شاء الله! إجابة صحيحة</h5>
            <div className="text-xs text-emerald-950 font-bold">
              كسبت {pointsGained} نقطة في التقييم الفوري!
            </div>
            {streak >= 2 && (
              <span className="inline-block bg-orange-100 text-orange-850 border border-orange-200 px-3 py-1 rounded-full text-[10px] font-bold">
                🔥 تتابع الإجابة الصحيحة: {streak} مرات متتالية!
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-3 bg-rose-50 border border-rose-200 p-5 rounded-2xl">
            <div className="text-5xl">💔</div>
            <h5 className="font-black text-rose-800 text-base">حظ أوفر في السؤال المقبل!</h5>
            <p className="text-xs text-rose-950">
              الإجابة ليست صحيحة تماماً. تابع المراجعة وحافظ على تركيزك العالي.
            </p>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center text-xs text-slate-700">
          <span>نقاطك المتراكمة الكلية:</span>
          <strong className="text-base text-slate-900 font-black">{player?.score || 0} ن</strong>
        </div>

        <p className="text-[10px] text-slate-500 italic">
          انظر إلى شاشة الصدارة بالسبورة لمتابعة ترتيبك في القاعة.
        </p>
      </div>
    );
  }

  // 6- LEADERBOARD SLEEP
  if (room.state === 'leaderboard') {
    return (
      <div className="text-center space-y-4 py-12">
        <Trophy className="w-12 h-12 text-yellow-500 mx-auto animate-pulse" />
        <h4 className="font-black text-slate-800 text-sm">جاري مراجعة لوحة الصدارة بالسبورة!</h4>
        <p className="text-xs text-slate-500">تنقل الأستاذ لترتيب قاعة الصف. هل أنت بين الخمسة الأوائل؟</p>
        <div className="bg-slate-50 p-3 rounded-lg border text-xs text-slate-600 inline-block font-semibold">
          رصيد النقاط الحالي: <b className="text-indigo-650">{player?.score || 0} ن</b>
        </div>
      </div>
    );
  }

  // 7- GAME FINISHED
  if (room.state === 'finished') {
    return (
      <div className="text-center space-y-5 py-8 text-right" dir="rtl">
        <div className="text-5xl">🎖️</div>
        <h4 className="font-extrabold text-indigo-950 text-base">تم إكمال مسابقة التحدي بنجاح!</h4>
        <p className="text-xs text-slate-600">
          رائع جداً يا طليعة الغد! لقد حصدت اليوم ما مجموعه:
        </p>
        <div className="bg-indigo-950 text-white p-5 rounded-2xl border text-center font-bold">
          <span className="text-slate-400 text-[10px] block">العلامة النهائية الكلية</span>
          <strong className="text-3xl text-emerald-400 font-mono tracking-wide">{player?.score || 0}</strong>
          <span className="text-xs text-indigo-300 mr-1">نقطة بالقسم</span>
        </div>

        <button
          onClick={onLeave}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 rounded-xl transition-colors cursor-pointer"
        >
          العودة لوحة البداية للسباق
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12 text-slate-400 text-xs">
      جاري تحميل حوار الربط الذاتي...
    </div>
  );
}

// -------------------------------------------------------------
// CHILD COMPONENT 8: TEACHER PASSCODE LOCK GATOR
// -------------------------------------------------------------
interface TeacherPasscodeLockProps {
  onUnlock: () => void;
  onCancel?: () => void;
}

function TeacherPasscodeLock({ onUnlock, onCancel }: TeacherPasscodeLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.trim() === '2026') {
      onUnlock();
      setError(null);
    } else {
      setError('❌ رمز المرور غير صحيح! يرجى إدخال الرمز الصحيح الخاص بالمعلم.');
    }
  };

  const pressKey = (num: string) => {
    setError(null);
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="bg-white border-2 border-indigo-50 rounded-3xl p-6 shadow-xl space-y-6 text-center max-w-sm mx-auto my-2 transition-all" dir="rtl">
      <div className="flex flex-col items-center gap-3">
        <div className="bg-indigo-50 p-4 rounded-full border border-indigo-100 text-indigo-650 relative">
          <Lock className="w-8 h-8 animate-pulse text-indigo-600" />
          <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></div>
        </div>
        <div>
          <h3 className="font-extrabold text-base text-slate-900 leading-snug">بوابة الأستاذ الموصدة آمنياً 🔐</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            مغلق لأجل الحماية الصفية البيداغوجية. يرجى إثبات هويتك كمعلم/مُشرف للولوج.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setError(null);
              setPin(e.target.value);
            }}
            placeholder="أدخل رمز المرور PIN"
            className="w-full text-center tracking-[0.4em] font-mono font-black text-xl bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:ring focus:ring-indigo-150 outline-none p-3.5 rounded-2xl transition-all"
            autoFocus
          />
          {pin && (
            <button 
              type="button" 
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-200/50 px-2 py-1 rounded-lg"
            >
              مسح
            </button>
          )}
        </div>

        {error && (
          <p className="text-[11px] text-rose-600 font-bold flex items-center justify-center gap-1.5 leading-relaxed bg-rose-50/50 p-2 rounded-xl">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </p>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => pressKey(num)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-800 font-extrabold text-base py-2 rounded-xl transition-all font-mono cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 rounded-xl transition-all cursor-pointer"
          >
            حذف ⌫
          </button>
          <button
            type="button"
            onClick={() => pressKey('0')}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-slate-800 font-extrabold text-base py-2 rounded-xl transition-all font-mono cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs py-2 rounded-xl transition-all cursor-pointer"
          >
            مسح كلي
          </button>
        </div>

        <button
          type="submit"
          disabled={!pin}
          className={`w-full font-black text-xs py-3 rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5 ${
            pin 
              ? 'bg-gradient-to-r from-indigo-700 to-indigo-650 text-white hover:shadow-lg hover:from-indigo-600' 
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          <Unlock className="w-4 h-4" />
          <span>تأكيد رمز المرور والدخول 🚀</span>
        </button>
      </form>

      <div className="border-t border-slate-100 pt-3 space-y-1">
        <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
          💡 الرمز التجريبي لتأكيد هوية الأستاذ: <span className="font-mono text-indigo-600 underline font-black text-xs">2026</span>
        </p>
        {onCancel && (
          <button
            onClick={onCancel}
            type="button"
            className="text-[10px] text-slate-500 hover:text-slate-800 underline block mx-auto font-medium"
          >
            الرجوع للخارج
          </button>
        )}
      </div>
    </div>
  );
}
