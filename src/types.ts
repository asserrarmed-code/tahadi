export type RoomState = 
  | 'waiting' 
  | 'question_countdown' 
  | 'question_active' 
  | 'question_result' 
  | 'leaderboard' 
  | 'finished';

export interface Player {
  id: string;
  name: string;
  avatar: string; // emoji or icon prefix
  score: number;
  answeredThisRound: boolean;
  isCorrect: boolean;
  pointsGained: number;
  answerIndex: number | null;
  timeTaken: number; // in milliseconds
  streak: number;
  
  // Powerups and written data
  writtenAnswer?: string;
  usedFiftyFifty?: boolean;
  usedExtraTime?: boolean;
  usedHint?: boolean;
}

export interface Question {
  id: string;
  subject: string;
  level: string; // e.g., "المستوى الثالث"
  subComponent?: string; // e.g., "التراكيب", "النشاط العلمي"
  text: string;
  options: string[]; // Exactly 4 options (for written answers, options[correctIndex] serves as the correct string reference)
  correctIndex: number; // 0, 1, 2, or 3
  points: number;
  timeLimit: number; // in seconds
  type?: 'mcq' | 'written' | 'oral'; // default is 'mcq'
}

export interface Room {
  pin: string;
  state: RoomState;
  currentQuestionIndex: number;
  currentQuestionId: string | null;
  secondsRemaining: number;
  revealAnswer: boolean;
  activeQuizId: string | null;
  players: Record<string, Player>;
  questionStartedAt: number | null; // Timestamp
  activeQuiz?: QuizSet;
}

export interface QuizSet {
  id: string;
  title: string;
  description: string;
  level: string;
  subject: string;
  questions: Question[];
}

export interface AISchema {
  level: string;
  subject: string;
  topic: string;
  instructions: string;
}
