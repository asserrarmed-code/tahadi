import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Room, Player, Question, QuizSet } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Detect if real Firebase config is loaded (not draft or empty dummy)
const isConfigured = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5);

let app: any = null;
let db: any = null;
let auth: any = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    console.log("🔥 Successfully initialized Firebase Firestore backend node.");
  } catch (error) {
    console.error("⚠️ Failed to initialize Firebase with loaded credentials:", error);
  }
} else {
  console.log("ℹ️ Running in Sandbox mode. Using Express fast in-memory database fallback.");
}

// -------------------------------------------------------------
// FIRESTORE SYNCING CLIENT WRAPPER WITH STATE FALLBACKS
// -------------------------------------------------------------

// Local storage and BroadcastChannel fallback system for static client hosts (e.g., Vercel)
const channel = typeof window !== 'undefined' ? new BroadcastChannel('moroccan_kahoot_sync') : null;

export function saveRoomLocally(pin: string, room: Room) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`room_${pin}`, JSON.stringify(room));
    if (channel) {
      channel.postMessage({ type: 'ROOM_UPDATE', pin, room });
    }
  }
}

export function getRoomLocally(pin: string): Room | null {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`room_${pin}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
  }
  return null;
}

// Create New Room
export async function createRoom(pin: string, activeQuiz: QuizSet): Promise<Room> {
  const roomData: Room = {
    pin,
    state: 'waiting',
    currentQuestionIndex: -1,
    currentQuestionId: null,
    secondsRemaining: 0,
    revealAnswer: false,
    activeQuizId: activeQuiz.id,
    activeQuiz: activeQuiz,
    players: {},
    questionStartedAt: null
  };

  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      await setDoc(roomRef, roomData);
      return roomData;
    } catch (e) {
      console.error("Firestore creation error, falling back locally:", e);
    }
  }

  // Attempt REST call to backend
  try {
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, quizSetId: activeQuiz.id, quizSet: activeQuiz })
    });
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.room) {
        saveRoomLocally(pin, data.room);
        return data.room;
      }
    }
  } catch (err) {
    console.warn("Express server unreachable, using clean browser tab sync fallback:", err);
  }

  // Clean offline-first browser fallback
  saveRoomLocally(pin, roomData);
  return roomData;
}

// Subscribe to Room Status Live
export function listenToRoom(pin: string, onUpdate: (room: Room | null) => void): () => void {
  if (isConfigured && db) {
    const roomRef = doc(db, 'rooms', pin);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as Room);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      console.error("Firestore snapshot sync error:", error);
    });
    return unsubscribe;
  }

  let active = true;

  // Sync through BroadcastChannel events
  let onChannelMessage: any = null;
  if (channel) {
    onChannelMessage = (event: MessageEvent) => {
      if (active && event.data && event.data.type === 'ROOM_UPDATE' && event.data.pin === pin) {
        onUpdate(event.data.room);
      }
    };
    channel.addEventListener('message', onChannelMessage);
  }

  // Sync through Storage Events across tabs
  const onStorageChange = (e: StorageEvent) => {
    if (active && e.key === `room_${pin}`) {
      if (e.newValue) {
        try {
          onUpdate(JSON.parse(e.newValue));
        } catch (err) {}
      } else {
        onUpdate(null);
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorageChange);
    // Initial fetch from cache
    const cached = getRoomLocally(pin);
    if (cached) {
      onUpdate(cached);
    }
  }

  // Periodic fallback REST poll mechanism from backend DB if active/reachable
  const poll = async () => {
    while (active) {
      try {
        const res = await fetch(`/api/room/${pin}`);
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && data.room && active) {
            onUpdate(data.room);
            saveRoomLocally(pin, data.room);
          }
        }
      } catch (err) {
        // Quietly failover to local cache
        if (active) {
          const cached = getRoomLocally(pin);
          if (cached) onUpdate(cached);
        }
      }
      await new Promise(r => setTimeout(r, 600));
    }
  };
  poll();

  return () => {
    active = false;
    if (channel && onChannelMessage) {
      channel.removeEventListener('message', onChannelMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorageChange);
    }
  };
}

// Update Room State dynamically
export async function updateRoom(pin: string, partial: Partial<Room>): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      await updateDoc(roomRef, partial as any);
      return;
    } catch (e) {
      console.error("Firestore update failed, falling back locally:", e);
    }
  }

  // Patch locally first to guarantee zero delay
  const prevRoom = getRoomLocally(pin) || {
    pin,
    state: 'waiting',
    currentQuestionIndex: -1,
    currentQuestionId: null,
    secondsRemaining: 0,
    revealAnswer: false,
    players: {}
  } as Room;

  const nextRoom = { ...prevRoom, ...partial };
  saveRoomLocally(pin, nextRoom);

  // If server is dead, apply logical state transitions on the client to allow offline testing
  const timerKey = `timer_${pin}`;
  if (partial.state === 'question_countdown') {
    nextRoom.currentQuestionIndex = partial.currentQuestionIndex !== undefined ? partial.currentQuestionIndex : 0;
    const questions = nextRoom.activeQuiz?.questions;
    if (questions && questions[nextRoom.currentQuestionIndex]) {
      nextRoom.currentQuestionId = questions[nextRoom.currentQuestionIndex].id;
    }
    nextRoom.secondsRemaining = 4;
    nextRoom.revealAnswer = false;
    for (const pId in nextRoom.players) {
      nextRoom.players[pId].answeredThisRound = false;
      nextRoom.players[pId].answerIndex = null;
      nextRoom.players[pId].writtenAnswer = '';
      nextRoom.players[pId].isCorrect = false;
      nextRoom.players[pId].pointsGained = 0;
    }
    saveRoomLocally(pin, nextRoom);
  } else if (partial.state === 'question_active') {
    const q = nextRoom.activeQuiz?.questions[nextRoom.currentQuestionIndex];
    nextRoom.secondsRemaining = q?.timeLimit || 20;
    nextRoom.revealAnswer = false;
    nextRoom.questionStartedAt = Date.now();
    for (const pId in nextRoom.players) {
      nextRoom.players[pId].answeredThisRound = false;
      nextRoom.players[pId].answerIndex = null;
      nextRoom.players[pId].writtenAnswer = '';
      nextRoom.players[pId].isCorrect = false;
      nextRoom.players[pId].pointsGained = 0;
    }
    saveRoomLocally(pin, nextRoom);

    // Setup client-side countdown timer ticking
    if (typeof window !== 'undefined') {
      if ((window as any)[timerKey]) clearInterval((window as any)[timerKey]);
      (window as any)[timerKey] = setInterval(() => {
        const current = getRoomLocally(pin);
        if (current && current.state === 'question_active' && current.secondsRemaining > 0) {
          const left = current.secondsRemaining - 1;
          const updates: Partial<Room> = { secondsRemaining: left };
          if (left <= 0) {
            updates.state = 'question_result';
            updates.revealAnswer = true;
            clearInterval((window as any)[timerKey]);
          }
          updateRoom(pin, updates);
        } else {
          clearInterval((window as any)[timerKey]);
        }
      }, 1000);
    }
  } else if (partial.state === 'question_result') {
    if (typeof window !== 'undefined' && (window as any)[timerKey]) {
      clearInterval((window as any)[timerKey]);
    }
    nextRoom.secondsRemaining = 0;
    nextRoom.revealAnswer = true;
    saveRoomLocally(pin, nextRoom);
  }

  // Fallback REST endpoints for State progressions
  let endpoint = '';
  let body: any = {};

  if (partial.state === 'question_countdown') {
    endpoint = `/api/room/${pin}/start`;
    body = { 
      quizSet: partial.activeQuiz || nextRoom.activeQuiz,
      currentQuestionIndex: partial.currentQuestionIndex !== undefined ? partial.currentQuestionIndex : nextRoom.currentQuestionIndex,
      currentQuestionId: partial.currentQuestionId || nextRoom.currentQuestionId,
      activeSubject: partial.activeSubject !== undefined ? partial.activeSubject : nextRoom.activeSubject
    };
  } else if (partial.state === 'question_active') {
    endpoint = `/api/room/${pin}/activate-question`;
  } else if (partial.state === 'question_result') {
    endpoint = `/api/room/${pin}/reveal`;
  } else if (partial.state === 'leaderboard') {
    endpoint = `/api/room/${pin}/leaderboard`;
  } else {
    endpoint = `/api/room/${pin}/state-update`;
    body = partial;
  }

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.room) {
          saveRoomLocally(pin, data.room);
        }
      }
    } catch (err) {
      console.warn("Express server unreachable for transition, ran purely offline:", err);
    }
  }
}

// Student Joins Room
export async function joinPlayer(pin: string, name: string, avatar: string): Promise<{ playerId: string; room: Room }> {
  const playerId = `player-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const defaultPlayer: Player = {
    id: playerId,
    name: name.substring(0, 15).trim(),
    avatar: avatar || '🎒',
    score: 0,
    answeredThisRound: false,
    isCorrect: false,
    pointsGained: 0,
    answerIndex: null,
    timeTaken: 0,
    streak: 0,
    usedPhilosopher: false,
    usedShield: false,
    usedTimeQuake: false,
    philosopherHint: ""
  };

  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      const snapshot = await getDoc(roomRef);
      if (!snapshot.exists()) {
        throw new Error('الغرفة غير مسجلة أو أن الحصة قد انتهت!');
      }
      const room = snapshot.data() as Room;
      if (room.state !== 'waiting') {
        throw new Error('آسفين! لقد بدأت المسابقة بالفعل ولا يمكن الدخول الآن.');
      }

      const updatedPlayers = { ...room.players, [playerId]: defaultPlayer };
      await updateDoc(roomRef, { players: updatedPlayers });
      return { playerId, room: { ...room, players: updatedPlayers } };
    } catch (e: any) {
      console.error("Firestore player join failed, attempting fallback:", e);
      throw e;
    }
  }

  // Attempt REST call
  try {
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, name, avatar })
    });
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success) {
        saveRoomLocally(pin, data.room);
        return { playerId: data.playerId, room: data.room };
      } else {
        throw new Error(data.error);
      }
    }
  } catch (err) {
    console.warn("Express join REST failed, running client fallback:", err);
  }

  // Pure browser/offline joining fallback
  const cachedRoom = getRoomLocally(pin);
  if (!cachedRoom) {
    throw new Error('رمز الغرفة PIN غير صحيح أو غير متصل بالشبكة!');
  }
  if (cachedRoom.state !== 'waiting') {
    throw new Error('آسفين! لقد بدأت المسابقة بالفعل ولا يمكن الدخول الآن.');
  }

  const updatedPlayers = { ...cachedRoom.players, [playerId]: defaultPlayer };
  const updatedRoom = { ...cachedRoom, players: updatedPlayers };
  saveRoomLocally(pin, updatedRoom);
  return { playerId, room: updatedRoom };
}

// Student Submits Answer (MCQ or Written)
export async function submitStudentAnswer(
  pin: string, 
  playerId: string, 
  answerIndex: number | null, 
  writtenAnswer?: string
): Promise<void> {

  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        const room = snapshot.data() as Room;
        const player = room.players[playerId];
        const quiz = room.activeQuiz;
        const q = quiz?.questions[room.currentQuestionIndex];
        
        if (player && q && room.state === 'question_active' && !player.answeredThisRound) {
          let isCorrect = false;
          let pointsGained = 0;
          const timeTaken = Date.now() - (room.questionStartedAt || Date.now());

          if (q.type === 'written') {
            const studentText = (writtenAnswer || '').trim().toLowerCase();
            const correctSolution = q.options[q.correctIndex || 0].trim().toLowerCase();
            isCorrect = studentText === correctSolution || correctSolution.includes(studentText) && studentText.length > 0;
            if (isCorrect) pointsGained = q.points;
          } else {
            isCorrect = Number(answerIndex) === q.correctIndex;
            if (isCorrect) {
              const maxTimeMs = q.timeLimit * 1000;
              const ratio = Math.max(0, Math.min(1, timeTaken / maxTimeMs));
              pointsGained = Math.round(q.points * (1 - ratio / 2));
            }
          }

          if (isCorrect) {
            if (room.multiplierActive) pointsGained *= 2;
          } else {
            if (player.usedShield) pointsGained = 0;
            else pointsGained = -300;
          }

          const updatedPlayer = {
            ...player,
            answeredThisRound: true,
            answerIndex,
            writtenAnswer: writtenAnswer || '',
            isCorrect,
            pointsGained,
            score: Math.max(0, player.score + pointsGained),
            timeTaken,
            streak: isCorrect ? player.streak + 1 : 0
          };

          const updatedPlayers = { ...room.players, [playerId]: updatedPlayer };
          const updates: Partial<Room> = { players: updatedPlayers };

          const totalPlayers = Object.keys(updatedPlayers).length;
          const answeredCount = Object.values(updatedPlayers).filter((p: any) => p.answeredThisRound).length;

          if (answeredCount >= totalPlayers && totalPlayers > 0) {
            updates.state = 'question_result';
            updates.revealAnswer = true;
            updates.secondsRemaining = 0;
          }

          await updateDoc(roomRef, updates as any);
        }
      }
      return;
    } catch (e) {
      console.error("Firestore submit answer error:", e);
    }
  }

  // Pre-calculate locally to ensure instant UI response if backend lags
  const cachedRoom = getRoomLocally(pin);
  if (cachedRoom) {
    const player = cachedRoom.players[playerId];
    const quiz = cachedRoom.activeQuiz;
    const q = quiz?.questions[cachedRoom.currentQuestionIndex];
    if (player && q && cachedRoom.state === 'question_active' && !player.answeredThisRound) {
      let isCorrect = false;
      let pointsGained = 0;
      const timeTaken = Date.now() - (cachedRoom.questionStartedAt || Date.now());

      if (q.type === 'written') {
        const studentText = (writtenAnswer || '').trim().toLowerCase();
        const correctSolution = q.options[q.correctIndex || 0].trim().toLowerCase();
        isCorrect = studentText === correctSolution || correctSolution.includes(studentText) && studentText.length > 0;
        if (isCorrect) pointsGained = q.points;
      } else {
        isCorrect = Number(answerIndex) === q.correctIndex;
        if (isCorrect) {
          const maxTimeMs = q.timeLimit * 1000;
          const ratio = Math.max(0, Math.min(1, timeTaken / maxTimeMs));
          pointsGained = Math.round(q.points * (1 - ratio / 2));
        }
      }

      if (isCorrect) {
        if (cachedRoom.multiplierActive) pointsGained *= 2;
      } else {
        if (player.usedShield) pointsGained = 0;
        else pointsGained = -300;
      }

      const updatedPlayer = {
        ...player,
        answeredThisRound: true,
        answerIndex,
        writtenAnswer: writtenAnswer || '',
        isCorrect,
        pointsGained,
        score: Math.max(0, player.score + pointsGained),
        timeTaken,
        streak: isCorrect ? player.streak + 1 : 0
      };

      const updatedPlayers = { ...cachedRoom.players, [playerId]: updatedPlayer };
      const updates: Partial<Room> = { players: updatedPlayers };

      const totalPlayers = Object.keys(updatedPlayers).length;
      const answeredCount = Object.values(updatedPlayers).filter((p: any) => p.answeredThisRound).length;

      if (answeredCount >= totalPlayers && totalPlayers > 0) {
        updates.state = 'question_result';
        updates.revealAnswer = true;
        updates.secondsRemaining = 0;
      }

      saveRoomLocally(pin, { ...cachedRoom, ...updates });
    }
  }

  // Call REST submission
  try {
    const res = await fetch(`/api/room/${pin}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, answerIndex, writtenAnswer })
    });
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.room) {
        saveRoomLocally(pin, data.room);
      }
    }
  } catch (err) {
    console.warn("Failed REST submission, ran local storage fallback successfully:", err);
  }
}

// Student Consumes Powerup
export async function usePowerup(pin: string, playerId: string, powerupType: 'philosopher' | 'shield' | 'timeQuake' | 'fiftyFifty' | 'extraTime' | 'hint'): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        const room = snapshot.data() as Room;
        const player = room.players[playerId];
        if (player) {
          const updatedPlayer = { ...player };
          
          if (powerupType === 'philosopher' || powerupType === 'hint' || powerupType === 'fiftyFifty') {
            updatedPlayer.usedPhilosopher = true;
            updatedPlayer.usedHint = true;
            const activeQuestion = room.activeQuiz?.questions[room.currentQuestionIndex];
            let genHint = 'تلميح بيداغوجي: راجع أساسيات الدرس مع زملائك في المجموعة!';
            if (activeQuestion) {
              try {
                const hintRes = await fetch('/api/gemini/generate-hint', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ questionText: activeQuestion.text, subject: activeQuestion.subject })
                });
                const hintData = await hintRes.json();
                if (hintData.success) {
                  genHint = hintData.hint;
                }
              } catch (err) {
                console.error("Failed to fetch hint proxy:", err);
              }
            }
            updatedPlayer.philosopherHint = genHint;
          }
          if (powerupType === 'shield') {
            updatedPlayer.usedShield = true;
          }
          if (powerupType === 'timeQuake' || powerupType === 'extraTime') {
            updatedPlayer.usedTimeQuake = true;
            updatedPlayer.usedExtraTime = true;
            await updateDoc(roomRef, {
              secondsRemaining: (room.secondsRemaining || 0) + 15,
              [`players.${playerId}`]: updatedPlayer
            } as any);
            return;
          }

          await updateDoc(roomRef, {
            [`players.${playerId}`]: updatedPlayer
          } as any);
        }
      }
      return;
    } catch (e) {
      console.error("Firestore powerup use error, fallback:", e);
    }
  }

  // Pre-apply powerup locally for instant feedback
  const cachedRoom = getRoomLocally(pin);
  if (cachedRoom) {
    const player = cachedRoom.players[playerId];
    if (player) {
      const updatedPlayer = { ...player };

      if (powerupType === 'philosopher' || powerupType === 'hint' || powerupType === 'fiftyFifty') {
        updatedPlayer.usedPhilosopher = true;
        updatedPlayer.usedHint = true;

        const activeQuestion = cachedRoom.activeQuiz?.questions[cachedRoom.currentQuestionIndex];
        let localHint = 'فكر وتذكر مفاهيم الدرس السابقة مع دمج جهود مجموعتكم!';
        if (activeQuestion) {
          const s = activeQuestion.subject || '';
          if (s.includes('إسلامية')) {
            localHint = 'توجيه بيداغوجي: تذكّر الفرض الرئيسي من فرائض الوضوء كغسل الوجهة أو النية.';
          } else if (s.includes('عرب')) {
            localHint = 'تلميح لغوي: ابحث عن صيغة فاعل مثل كاتب أو ناصر المرفوعة بالضمة.';
          } else if (s.includes('رياض')) {
            localHint = 'تلميح حسابي: راجع عمليات الحساب الذهني التبادلي وسلسلة التقسيم.';
          } else {
            localHint = 'تلميح علمي: تذكر الغاز الأكثر تواجداً ووفرة في تنفس الغلاف الجوي.';
          }
        }
        updatedPlayer.philosopherHint = localHint;
      }

      if (powerupType === 'shield') {
        updatedPlayer.usedShield = true;
      }

      if (powerupType === 'timeQuake' || powerupType === 'extraTime') {
        updatedPlayer.usedTimeQuake = true;
        updatedPlayer.usedExtraTime = true;
        cachedRoom.secondsRemaining = (cachedRoom.secondsRemaining || 0) + 15;
      }

      cachedRoom.players[playerId] = updatedPlayer;
      saveRoomLocally(pin, cachedRoom);
    }
  }

  // REST API sandbox powerup trigger
  try {
    const res = await fetch(`/api/room/${pin}/powerup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, powerupType })
    });
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.room) {
        saveRoomLocally(pin, data.room);
      }
    }
  } catch (err) {
    console.warn("Failed REST powerup use, local fallback succeeded:", err);
  }
}

// Manual adjustment of scores (Teacher increments or decrements standard player credits)
export async function adjustPlayerScore(pin: string, playerId: string, amount: number): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        const room = snapshot.data() as Room;
        const player = room.players[playerId];
        if (player) {
          const updatedPlayer = {
            ...player,
            score: Math.max(0, player.score + amount)
          };
          await updateDoc(roomRef, {
            [`players.${playerId}`]: updatedPlayer
          } as any);
        }
      }
      return;
    } catch (e) {
      console.error("Firestore manually adjusted score error:", e);
    }
  }

  // Pre-adjust locally
  const cachedRoom = getRoomLocally(pin);
  if (cachedRoom) {
    const player = cachedRoom.players[playerId];
    if (player) {
      player.score = Math.max(0, player.score + amount);
      saveRoomLocally(pin, cachedRoom);
    }
  }

  // REST callback
  try {
    const res = await fetch(`/api/room/${pin}/adjust-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, amount })
    });
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.room) {
        saveRoomLocally(pin, data.room);
      }
    }
  } catch (err) {
    console.warn("Failed REST score adjustment:", err);
  }
}

// Terminate room
export async function terminateRoom(pin: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      await setDoc(roomRef, { state: 'finished', players: {} }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(`room_${pin}`);
    if (channel) {
      channel.postMessage({ type: 'ROOM_UPDATE', pin, room: null });
    }
  }

  try {
    await fetch(`/api/room/${pin}/terminate`, { method: 'POST' });
  } catch (err) {}
}
