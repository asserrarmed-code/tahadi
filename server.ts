import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Room, Player, Question, QuizSet } from './src/types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database representing our Firebase Realtime synced nodes
const rooms_db: Record<string, Room> = {};
const custom_quizzes_pool: Record<string, QuizSet> = {};

// Helper to generate a random 4-digit PIN that's not already active
function generatePIN(): string {
  let pin = '';
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms_db[pin]);
  return pin;
}

// Initialize Gemini Client Lazily/Safely
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('لم يتم تعيين متغير البيئة GEMINI_API_KEY أو VITE_GEMINI_API_KEY. الرجاء تهيئة مفتاح API الخاص بك في لوحة الإعدادات.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API for question generation (Smart AI Generator component)
app.post('/api/gemini/generate-questions', async (req, res) => {
  const { level, subject, topic, instructions } = req.body;

  try {
    const ai = getAiClient();
    
    // Core pedagogical rules requested:
    // 1- In Islamic Education: use "الفرائض" (Frda) instead of "الأركان" (Arkan).
    // 2- In Level 6 Arabic grammar: DO NOT include "التوكيد" (Emphasis) or "المستثنى" (Exception).
    const isIslamic = subject && (subject.includes('إسلامية') || subject.includes('اسلامية'));
    const isArabicSixth = subject && (subject.includes('عربية') || subject.includes('عربي')) && level && level.includes('السادس');

    let pedagogicalEnforcement = '';
    if (isIslamic) {
      pedagogicalEnforcement = `**قاعدة بيداغوجية ملزمة للمنهاج المغربي:** في مادة التربية الإسلامية، يجب استخدام مصطلح "الفرائض" بدلاً من "الأركان" (مثال: فرائض الوضوء، فرائض الصلاة)، وتجنب خلط المفاهيم للأطفال الصغار.`;
    } else if (isArabicSixth) {
      pedagogicalEnforcement = `**قاعدة بيداغوجية ملزمة للمنهاج المغربي للمستوى السادس:** يمتنع منعا باتا وبشكل قاطع إدراج أسئلة أو خيارات تتعلق بدرس "التوكيد" أو درس "المستثنى"، حيث تم تأجيلها أو استبعادها لتبسيط الاستيعاب. ركز بدلا من ذلك على دروس المفعول المطلق، المفعول لأجله، التمييز، أو التراكيب الأساسية الأخرى.`;
    }

    const prompt = `أنت مصمم مناهج ورشات دراسية خبير ومرح للمدارس الابتدائية بالمملكة المغربية.
قم بتوليد 3 أسئلة جودة عالية وممتعة جدا ومناسبة للمستوى الدراسي المذكور.
المستوى: ${level || 'المستوى الثالث'}
المادة: ${subject || 'الرياضيات'}
الموضوع: ${topic || 'عام'}
إرشادات إضافية من الأستاذ: ${instructions || 'أسئلة مشوقة وبسيطة'}

${pedagogicalEnforcement}

من فضلك تأكد من أن الأسئلة مناسبة للأطفال الابتدائي (بأسلوب مشجع ومبهج، مستلهماً البيئة أو الأسماء المغربية مثل: يوسف، أمينة، طاجين، أطلس، إلخ)، وأن هناك إجابة واحدة صحيحة وثلاث خيارات مشتتة واضحة ومناسبة للمرحلة السنية المذكورة.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `أنت مولد أسئلة بيداغوجي مخصص لتطبيق "مسابقات القسم" المغربي.
يجب عليك دائما الاستجابة بصيغة JSON نظيفة جدا مطابقة تماما للمخطط المرفق (Schema).
الأسئلة والخيارات والوحدات يجب أن تكون معبرة وصحيحة لغويا ومصاغة إما باللغة العربية الفصحى المبسطة أو بالفرنسية حسب المادة والدراية الموجهة للأطفال في المدارس العمومية والخصوصية بالمغرب.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'قائمة الأسئلة المولدة',
          items: {
            type: Type.OBJECT,
            properties: {
              text: { 
                type: Type.STRING, 
                description: 'نص السؤال بشكل مبسط ومناسب للأطفال، محترم للقواعد البيداغوجية المحددة في التوجيهات.' 
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'أربعة خيارات ذكية وجاذبة بالضبط (4 خيارات)'
              },
              correctIndex: { 
                type: Type.INTEGER, 
                description: 'مؤشر الإجابة الصحيحة من 0 إلى 3' 
              },
              points: { 
                type: Type.INTEGER, 
                description: 'النقاط المحددة للسؤال (مثلا 1000 أو 1200)' 
              },
              timeLimit: { 
                type: Type.INTEGER, 
                description: 'الوقت المسموح به بالثواني (مثلا 15 أو 20 أو 25)' 
              },
              subComponent: { 
                type: Type.STRING, 
                description: 'المكون الفرعي لبرنامج المادة مثل (التراكيب، الصرف، الحساب، العقيدة، الكيمياء، إلخ)' 
              }
            },
            required: ['text', 'options', 'correctIndex', 'points', 'timeLimit']
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('لم يقم النموذج بتوليد أي محتوى.');
    }

    try {
      const questionsList = JSON.parse(text);
      res.json({ success: true, questions: questionsList });
    } catch (parseErr) {
      console.error('Failed to parse Gemini output:', text);
      res.status(500).json({ 
        success: false, 
        error: 'فشل تحليل الاستجابة المولدة من الذكاء الاصطناعي كـ JSON صالح.',
        rawText: text 
      });
    }

  } catch (error: any) {
    console.error('Error generating questions via Gemini:', error);
    res.status(500).json({ 
      success: false, 
      error: error?.message || 'فشل توليد الأسئلة بواسطة الذكاء الاصطناعي بسبب خطأ داخلي. يرجى مراجعة مفتاح API.' 
    });
  }
});

// REST API for high-quality pedagogical Hint generation using Gemini
app.post('/api/gemini/generate-hint', async (req, res) => {
  const { questionText, subject } = req.body;
  try {
    const ai = getAiClient();
    const prompt = `أنت "فيلسوف الصف" الحكيم والمساعد للأطفال في المغرب.
قدم تلميحاً بيداغوجياً ذكياً، قصيراً جداً ومبسّطاً (لا يتجاوز 12 كلمة)، ومشجعاً لمساعدة التلاميذ على حل هذا السؤال: "${questionText}" في مادة ${subject || 'عام'}.
تجنب إعطاء الجواب الصريح مباشرة، بل قدم دلالة لطيفة أو توجيها ذكيا بأسلوب مغربي يثير الفضول والانتباه للتعلم.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'أنت فيلسوف بيداغوجي مبهج وسريع البديهة تعطي تسريبات وتلميحات غير مباشرة للأطفال بالقسم المغربي.',
      }
    });

    const hint = response.text?.trim() || 'فكر بذكاء وتركيز، الإجابة قريبة جداً!';
    res.json({ success: true, hint });
  } catch (error: any) {
    console.error('Error generating hint:', error);
    res.json({ success: true, hint: 'تلميح بيداغوجي: استعن بأساسيات الدرس وعناصر المفهوم الرئيسية!' });
  }
});

// Create Room (Professor starts a new Kahoot Session)
app.post('/api/room/create', (req, res) => {
  const { quizSetId, quizSet, pin: customPin } = req.body;
  const pin = customPin ? String(customPin).trim() : generatePIN();
  
  // Store quiz set to database pool if custom created by AI
  if (quizSetId && quizSet) {
    custom_quizzes_pool[quizSetId] = quizSet;
  }

  const newRoom: Room = {
    pin,
    state: 'waiting',
    currentQuestionIndex: -1,
    currentQuestionId: null,
    secondsRemaining: 0,
    revealAnswer: false,
    activeQuizId: quizSetId || null,
    activeQuiz: quizSet || undefined,
    players: {},
    questionStartedAt: null,
    // Treasure Island extensions
    activeSubject: null,
    completedSubjects: {},
    multiplierActive: false
  };

  rooms_db[pin] = newRoom;
  console.log(`Created Room with PIN: ${pin} hosting Quiz: ${quizSetId}`);
  res.json({ success: true, room: newRoom });
});

// Join Room (Student enters code, name, avatar)
app.post('/api/room/join', (req, res) => {
  const { pin, name, avatar } = req.body;
  
  if (!pin || !name) {
    return res.status(400).json({ success: false, error: 'الرموز والأسماء حقول إجبارية للمشاركة!' });
  }

  const room = rooms_db[String(pin).trim()];
  if (!room) {
    return res.status(404).json({ success: false, error: 'رمز الغرفة PIN غير صحيح أو أن الحصة قد انتهت!' });
  }

  if (room.state !== 'waiting') {
    return res.status(400).json({ success: false, error: 'آسفين! لقد بدأت المسابقة بالفعل ولا يمكن الدخول الآن.' });
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
    usedPhilosopher: false,
    usedShield: false,
    usedTimeQuake: false,
    philosopherHint: ""
  };

  room.players[playerId] = newPlayer;
  console.log(`Player [${name}] joined room [${pin}] with avatar [${avatar}]`);
  
  res.json({ success: true, playerId, room });
});

// Retrieve Room Sync State
app.get('/api/room/:pin', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (!room) {
    return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });
  }

  // Hydrate activeQuiz if it is missing or needs updating from our central memory pool
  if (room.activeQuizId && custom_quizzes_pool[room.activeQuizId]) {
    room.activeQuiz = custom_quizzes_pool[room.activeQuizId];
  }

  // Handle active question countdown ticking dynamically in full-stack server
  if (room.state === 'question_active' && room.secondsRemaining > 0) {
    const elapsedSeconds = Math.floor((Date.now() - (room.questionStartedAt || Date.now())) / 1000);
    // Find associated countdown
    const cachedQuiz = custom_quizzes_pool[room.activeQuizId || ''];
    let initialTime = 20; // default
    if (room.currentQuestionId && cachedQuiz) {
      const q = cachedQuiz.questions.find(x => x.id === room.currentQuestionId);
      if (q) initialTime = q.timeLimit;
    }
    
    const nextSecs = Math.max(0, initialTime - elapsedSeconds);
    if (nextSecs !== room.secondsRemaining) {
      room.secondsRemaining = nextSecs;
      if (room.secondsRemaining === 0) {
        room.state = 'question_result';
        room.revealAnswer = true;
      }
    }
  }

  res.json({ success: true, room });
});

// Start active Quiz (transition to countdown of 1st question)
app.post('/api/room/:pin/start', (req, res) => {
  const { pin } = req.params;
  const { quizSet, currentQuestionIndex, currentQuestionId, activeSubject } = req.body;

  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  // Store quiz if provided directly
  if (quizSet && quizSet.id) {
    custom_quizzes_pool[quizSet.id] = quizSet;
    room.activeQuizId = quizSet.id;
    room.activeQuiz = quizSet;
  }

  const quiz = custom_quizzes_pool[room.activeQuizId || ''];
  if (!quiz || quiz.questions.length === 0) {
    return res.status(400).json({ success: false, error: 'عذراً، لم نجد أي أسئلة صالحة لبدء اللعبة!' });
  }

  // Set indices
  const targetIndex = typeof currentQuestionIndex === 'number' ? currentQuestionIndex : 0;
  
  // Reset players scores to 0 only on starting a fresh new game from beginning
  if (targetIndex === 0 && room.currentQuestionIndex <= 0) {
    for (const pid in room.players) {
      room.players[pid].score = 0;
      room.players[pid].streak = 0;
    }
  }

  // Always reset round submission status when starting a countdown
  for (const pid in room.players) {
    room.players[pid].answeredThisRound = false;
    room.players[pid].answerIndex = null;
    room.players[pid].isCorrect = false;
    room.players[pid].pointsGained = 0;
    // @ts-ignore
    room.players[pid].writtenAnswer = '';
  }

  room.responses = {}; // Reset responses!
  room.currentQuestionIndex = targetIndex;
  room.currentQuestionId = currentQuestionId || quiz.questions[targetIndex]?.id || null;
  
  if (activeSubject !== undefined) {
    room.activeSubject = activeSubject;
  }

  room.state = 'question_countdown';
  room.secondsRemaining = 4; // 3 seconds count plus intro
  room.revealAnswer = false;
  
  console.log(`Room [${pin}] standard or castle action initiated on quiz [${quiz.title}] index ${targetIndex}`);
  res.json({ success: true, room });
});

// Transition Game State from countdown to main active question
app.post('/api/room/:pin/activate-question', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  const quiz = custom_quizzes_pool[room.activeQuizId || ''];
  if (!quiz) return res.status(404).json({ success: false, error: 'الملف الإرشادي مفقود!' });

  const q = quiz.questions[room.currentQuestionIndex];
  if (!q) return res.status(404).json({ success: false, error: 'السؤال مفقود!' });

  room.state = 'question_active';
  room.secondsRemaining = q.timeLimit;
  room.revealAnswer = false;
  room.questionStartedAt = Date.now();

  // Reset answer states of this specific round
  for (const pid in room.players) {
    room.players[pid].answeredThisRound = false;
    room.players[pid].answerIndex = null;
    room.players[pid].isCorrect = false;
    room.players[pid].pointsGained = 0;
  }

  room.responses = {}; // Reset responses!

  console.log(`Room [${pin}] question [${q.id}] IS ACTIVE!`);
  res.json({ success: true, room });
});

// Submit Student Answer (Interactive student clicking or textbox sending)
app.post('/api/room/:pin/answer', (req, res) => {
  const { pin } = req.params;
  const { playerId, answerIndex, writtenAnswer } = req.body;

  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الحصة انتهت أو غير صحيحة!' });

  if (room.state !== 'question_active') {
    return res.status(400).json({ success: false, error: 'الوقت انتهى، أو لم يتم استقبال الإجابات لهذا السؤال بعد!' });
  }

  const player = room.players[playerId];
  if (!player) return res.status(404).json({ success: false, error: 'اللاعب غير مسجل بهذه الحصة!' });

  if (player.answeredThisRound) {
    return res.status(400).json({ success: false, error: 'لقد قمت بإرسال إجابتك بالفعل سابقاً!' });
  }

  const quiz = custom_quizzes_pool[room.activeQuizId || ''];
  const q = quiz?.questions[room.currentQuestionIndex];
  if (!q) return res.status(400).json({ success: false, error: 'حدث عطل في استرداد معلومات السؤال.' });

  // Record time taken
  const timeTaken = Date.now() - (room.questionStartedAt || Date.now());
  const maxTimeMs = q.timeLimit * 1000;
  
  let correct = false;
  let pointsGained = 0;

  const questionType = q.type || 'mcq';

  if (questionType === 'written') {
    const studentText = (writtenAnswer || '').trim().toLowerCase();
    const correctSolution = q.options[q.correctIndex || 0].trim().toLowerCase();
    correct = studentText === correctSolution || correctSolution.includes(studentText) && studentText.length > 0;
    if (correct) {
      pointsGained = q.points;
    }
  } else {
    correct = Number(answerIndex) === q.correctIndex;
    if (correct) {
      const ratio = Math.max(0, Math.min(1, timeTaken / maxTimeMs));
      pointsGained = Math.round(q.points * (1 - ratio / 2)); // ranges from 100% to 50%
    }
  }

  // Senior Gamification scoring mechanics:
  if (correct) {
    if (room.multiplierActive) {
      pointsGained = pointsGained * 2;
    }
  } else {
    // 300 points penalty unless protected by Shield
    if (player.usedShield) {
      pointsGained = 0; // Shield breaks but prevents loss!
    } else {
      pointsGained = -300;
    }
  }

  player.answeredThisRound = true;
  player.answerIndex = answerIndex !== undefined ? Number(answerIndex) : null;
  // @ts-ignore
  player.writtenAnswer = writtenAnswer || '';
  player.isCorrect = correct;
  player.pointsGained = pointsGained;
  player.score = Math.max(0, player.score + pointsGained);
  player.timeTaken = timeTaken;
  if (correct) {
    player.streak += 1;
  } else {
    player.streak = 0;
  }

  // Record into room.responses
  if (!room.responses) {
    room.responses = {};
  }
  room.responses[playerId] = {
    teamName: player.name,
    selectedAnswer: answerIndex !== null ? answerIndex : (writtenAnswer || ''),
    isCorrect: correct,
    timestamp: Date.now()
  };

  // Check if ALL players have answered. If so, automatically end the question timer
  const totalPlayers = Object.keys(room.players).length;
  // @ts-ignore
  const answeredCount = Object.values(room.players).filter(p => p.answeredThisRound).length;

  if (answeredCount >= totalPlayers && totalPlayers > 0) {
    room.state = 'question_result';
    room.revealAnswer = true;
    room.secondsRemaining = 0;
    console.log(`All players in Room [${pin}] responded. Auto-revealing answer indices!`);
  }

  res.json({ success: true, player, room });
});

// Admin state update override
app.post('/api/room/:pin/state-update', (req, res) => {
  const { pin } = req.params;
  const updates = req.body;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  Object.assign(room, updates);
  res.json({ success: true, room });
});

// Admin Manual Score Adjust (give/draw points to team)
app.post('/api/room/:pin/adjust-points', (req, res) => {
  const { pin } = req.params;
  const { playerId, amount } = req.body;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  const player = room.players[playerId];
  if (player) {
    player.score = Math.max(0, player.score + Number(amount));
    console.log(`Manual Score shift for ${player.name}: ${amount}. New total: ${player.score}`);
  }
  res.json({ success: true, room });
});

// Student active Powerup Use
app.post('/api/room/:pin/powerup', async (req, res) => {
  const { pin } = req.params;
  const { playerId, powerupType } = req.body;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  const player = room.players[playerId];
  if (player) {
    if (powerupType === 'philosopher' || powerupType === 'hint' || powerupType === 'fiftyFifty') {
      player.usedPhilosopher = true;
      player.usedHint = true;
      try {
        const quiz = custom_quizzes_pool[room.activeQuizId || ''];
        const q = quiz?.questions[room.currentQuestionIndex];
        if (q) {
          const ai = getAiClient();
          const prompt = `أنت فيلسوف الصف الحكيم والذكي لمساعدة تلميذ مغربي يواجه تحدياً.
قدم تلميحاً بيداغوجياً ذكياً وقصيراً جداً (لا يتجاوز 12 كلمة)، لمساعدته على حل السؤال: "${q.text}" في مادة ${q.subject || 'عام'}.
لا تعطه الجواب الصريح أبداً، بل وجِّهه للحل بدلالة لطيفة.`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              systemInstruction: 'أنت فيلسوف الصف المغربي المبهج تيسر الفهم وتعطي تلميحات ذكية ومحفزة للأطفال بالقسم.',
            }
          });
          player.philosopherHint = response.text?.trim() || 'فكر بذكاء، الجواب أمامك!';
        } else {
          player.philosopherHint = 'ركّز مع زملائك، الجواب قريب جداً!';
        }
      } catch (e) {
        console.error("Gemini failed in powerup: ", e);
        player.philosopherHint = 'تلميح بيداغوجي: استعن بأساسيات الدرس وعناصر المفهوم الرئيسية!';
      }
    } else if (powerupType === 'shield' || powerupType === 'usedShield') {
      player.usedShield = true;
    } else if (powerupType === 'timeQuake' || powerupType === 'extraTime') {
      player.usedTimeQuake = true;
      player.usedExtraTime = true;
      room.secondsRemaining = (room.secondsRemaining || 0) + 15;
    }
    console.log(`Player [${player.name}] triggered powerup: ${powerupType}`);
  }
  res.json({ success: true, room });
});

// Action to Reveal correct Answer instantly (or skip timer)
app.post('/api/room/:pin/reveal', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  room.state = 'question_result';
  room.revealAnswer = true;
  room.secondsRemaining = 0;

  res.json({ success: true, room });
});

// Action to show current Leaderboard
app.post('/api/room/:pin/leaderboard', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  room.state = 'leaderboard';
  res.json({ success: true, room });
});

// Action to click "Next" (Either next question countdown or finish game)
app.post('/api/room/:pin/next', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (!room) return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });

  const quiz = custom_quizzes_pool[room.activeQuizId || ''];
  if (!quiz) return res.status(404).json({ success: false, error: 'الملف الدراسي مفقود!' });

  const nextIndex = room.currentQuestionIndex + 1;
  if (nextIndex < quiz.questions.length) {
    room.currentQuestionIndex = nextIndex;
    room.currentQuestionId = quiz.questions[nextIndex].id;
    room.state = 'question_countdown';
    room.secondsRemaining = 4; // countdown timer
    room.revealAnswer = false;
    
    // reset student answer state placeholders
    for (const pid in room.players) {
      room.players[pid].answeredThisRound = false;
      room.players[pid].answerIndex = null;
      room.players[pid].isCorrect = false;
      room.players[pid].pointsGained = 0;
      // @ts-ignore
      room.players[pid].writtenAnswer = '';
    }
    
    console.log(`Room [${pin}] preparing next question index ${nextIndex}`);
  } else {
    room.state = 'finished';
    console.log(`Room [${pin}] game complete! Podiums are active.`);
  }

  res.json({ success: true, room });
});

// Action to close or terminate the active room session
app.post('/api/room/:pin/terminate', (req, res) => {
  const { pin } = req.params;
  const room = rooms_db[String(pin).trim()];
  if (room) {
    delete rooms_db[String(pin).trim()];
    console.log(`Terminated and freed up room: ${pin}`);
  }
  res.json({ success: true });
});

// Configure Vite middleware or serve static production build
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware loaded in Development Mode.');
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production build from Dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kahoot-Morocco app listening on http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Error setting up the Full-Stack server:', err);
});
