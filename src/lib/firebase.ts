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

  // Fallback REST call to local server
  const res = await fetch('/api/room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizSetId: activeQuiz.id, quizSet: activeQuiz })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to create room');
  return data.room;
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

  // Fallback: fast HTTP polling mechanism (every 300ms for continuous response feeling)
  let active = true;
  const poll = async () => {
    while (active) {
      try {
        const res = await fetch(`/api/room/${pin}`);
        const data = await res.json();
        if (data.success && active) {
          onUpdate(data.room);
        }
      } catch (err) {
        console.error("Sandbox polling failed:", err);
      }
      await new Promise(r => setTimeout(r, 400));
    }
  };
  poll();

  return () => {
    active = false;
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

  // Fallback rest endpoints for State progressions
  let endpoint = '';
  let body: any = {};

  if (partial.state === 'question_countdown') {
    endpoint = `/api/room/${pin}/start`;
    body = { quizSet: partial.activeQuiz };
  } else if (partial.state === 'question_active') {
    endpoint = `/api/room/${pin}/activate-question`;
  } else if (partial.state === 'question_result') {
    endpoint = `/api/room/${pin}/reveal`;
  } else if (partial.state === 'leaderboard') {
    endpoint = `/api/room/${pin}/leaderboard`;
  } else {
    // General update through specialized route or direct override
    const res = await fetch(`/api/room/${pin}/state-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    return;
  }

  if (endpoint) {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
}

// Student Joins Room
export async function joinPlayer(pin: string, name: string, avatar: string): Promise<{ playerId: string; room: Room }> {
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

      const playerId = `player-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newPlayer: Player = {
        id: playerId,
        name: name.substring(0, 15),
        avatar: avatar || '🎒',
        score: 0,
        answeredThisRound: false,
        isCorrect: false,
        pointsGained: 0,
        answerIndex: null,
        timeTaken: 0,
        streak: 0,
        // New interactive properties
        writtenAnswer: '',
        usedFiftyFifty: false,
        usedExtraTime: false,
        usedHint: false
      } as any;

      const updatedPlayers = { ...room.players, [playerId]: newPlayer };
      await updateDoc(roomRef, { players: updatedPlayers });
      return { playerId, room: { ...room, players: updatedPlayers } };
    } catch (e: any) {
      console.error("Firestore player join failed:", e);
      throw e;
    }
  }

  // Local sandbox join
  const res = await fetch('/api/room/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, name, avatar })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'تعذر الاتصال بصف الصف.');
  }
  return { playerId: data.playerId, room: data.room };
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
            // Check if student's string contains the exact trigger terms or keywords
            const studentText = (writtenAnswer || '').trim().toLowerCase();
            const correctSolution = q.options[q.correctIndex || 0].trim().toLowerCase();
            isCorrect = studentText === correctSolution || correctSolution.includes(studentText) && studentText.length > 0;
            if (isCorrect) pointsGained = q.points;
          } else if (q.type === 'mcq') {
            isCorrect = Number(answerIndex) === q.correctIndex;
            if (isCorrect) {
              const maxTimeMs = q.timeLimit * 1000;
              const ratio = Math.max(0, Math.min(1, timeTaken / maxTimeMs));
              pointsGained = Math.round(q.points * (1 - ratio / 2));
            }
          }

          const updatedPlayer = {
            ...player,
            answeredThisRound: true,
            answerIndex,
            writtenAnswer: writtenAnswer || '',
            isCorrect,
            pointsGained,
            score: player.score + pointsGained,
            timeTaken,
            streak: isCorrect ? player.streak + 1 : 0
          };

          const updatedPlayers = { ...room.players, [playerId]: updatedPlayer };
          
          // Auto reveal answer if everyone responded
          const totalPlayers = Object.keys(updatedPlayers).length;
          const answeredCount = Object.values(updatedPlayers).filter((p: any) => p.answeredThisRound).length;

          const updates: Partial<Room> = { players: updatedPlayers };
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

  // Fallback sandbox
  const res = await fetch(`/api/room/${pin}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, answerIndex, writtenAnswer })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
}

// Student Consumes Powerup (Decrease on student side, alert teachers dashboard)
export async function usePowerup(pin: string, playerId: string, powerupType: 'fiftyFifty' | 'extraTime' | 'hint'): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        const room = snapshot.data() as Room;
        const player = room.players[playerId];
        if (player) {
          const updatedPlayer = { ...player };
          
          if (powerupType === 'fiftyFifty') updatedPlayer.usedFiftyFifty = true;
          if (powerupType === 'extraTime') {
            updatedPlayer.usedExtraTime = true;
            // Add extra seconds to countdown
            await updateDoc(roomRef, {
              secondsRemaining: (room.secondsRemaining || 0) + 15,
              [`players.${playerId}`]: updatedPlayer
            } as any);
            return;
          }
          if (powerupType === 'hint') updatedPlayer.usedHint = true;

          await updateDoc(roomRef, {
            [`players.${playerId}`]: updatedPlayer
          } as any);
        }
      }
      return;
    } catch (e) {
      console.error("Firestore powerup use error:", e);
    }
  }

  // sandbox model updates
  const res = await fetch(`/api/room/${pin}/powerup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, powerupType })
  });
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

  // REST callback
  await fetch(`/api/room/${pin}/adjust-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, amount })
  });
}

// Terminate room
export async function terminateRoom(pin: string): Promise<void> {
  if (isConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', pin);
      // Clean up Firestore doc so database size remains negligible
      await setDoc(roomRef, { state: 'finished', players: {} }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  }
  await fetch(`/api/room/${pin}/terminate`, { method: 'POST' });
}
