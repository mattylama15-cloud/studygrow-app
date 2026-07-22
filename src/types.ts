// Shared data types for StudyGrow.

export type Flashcard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  // Spaced-repetition (SM-2 lite) state
  ease: number; // ease factor, starts 2.5
  interval: number; // days until next review
  reps: number; // number of successful reviews in a row
  lapses: number; // times forgotten
  due: number; // timestamp (ms) when next due
  createdAt: number;
};

/** Nafocený nebo vložený studijní materiál, ze kterého AI tvoří kartičky. */
export type DeckSource = {
  id: string;
  name: string;      // "notes-photo.jpg" nebo krátký popis vloženého textu
  text: string;      // přepis z fotky / vložený text
  addedAt: number;
};

export type Deck = {
  id: string;
  title: string;
  subject?: string;
  emoji: string;
  color: string;
  createdAt: number;
  /** Materiály se hromadí — AI tvoří kartičky ze všech dohromady. */
  sources?: DeckSource[];
};

export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

export type FocusSession = {
  id: string;
  startedAt: number;
  plannedMinutes: number;
  completedMinutes: number;
  completed: boolean; // finished the whole planned time
  plant: string; // emoji of the plant that grew (or withered)
  subject?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  pending?: boolean;
  images?: string[]; // optional attached images (data URLs) for user messages
};

// A single saved conversation with the tutor. Multiple per user.
export type ChatThread = {
  id: string;
  title: string; // auto-named from the first user message, editable later
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type Stats = {
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  totalFocusMinutes: number;
  plantsGrown: number;
  reviewsDone: number;
  xp: number;
};

// 'de' a 'es' zatím nemají překlady — i18n u nich spadne zpět na angličtinu.
export type Lang = 'cs' | 'en' | 'de' | 'es';

export type Settings = {
  apiKey: string | null;
  model: string;
  name: string | null;
  lang: Lang;
  dailyGoalMinutes: number;
  hapticsEnabled: boolean;
  focusTheme: string; // which thing builds/grows during focus (house, car, peapod, cake, tree)
  themeColor: string; // main app color (hex), changeable in-app
  adminPassHash: string | null; // legacy, kept for state migration
  onboardingDone: boolean; // first-run tour finished
};

export type Exam = {
  id: string;
  title: string;
  subject?: string;
  dateISO: string; // YYYY-MM-DD
  color: string;
  createdAt: number;
};

export type Task = {
  id: string;
  title: string;
  dateISO: string; // YYYY-MM-DD
  done: boolean;
  examId?: string; // optionally tied to an exam
  note?: string; // longer free-form text
  createdAt: number;
};

// A wrong answer the user made in a quiz — fed back to the Coach so they can be re-asked.
export type QuizMiss = {
  id: string;
  question: string;
  correctAnswer: string;
  source?: string; // deck id or note title — informational
  ts: number;
};

// ---- Classroom ("Study with me" / sdílená místnost) ----
// Lokální místnost: vytvoříš ji, dostaneš KÓD, můžeš do ní vložit svoje balíčky,
// poznámky a kvízy a psát si v chatu. Sdílení mezi zařízeními přijde se serverem;
// teď vše žije v AsyncStorage stejně jako zbytek appky.

export type SharedDeck = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  cards: { front: string; back: string }[];
  sharedBy: string; // jméno člena, který to vložil
  ts: number;
};

export type SharedNote = {
  id: string;
  title: string;
  body: string;
  sharedBy: string;
  ts: number;
};

export type SharedQuiz = {
  id: string;
  title: string;
  questions: { question: string; correctAnswer: string; options?: string[] }[];
  sharedBy: string;
  ts: number;
};

export type RoomMessage = {
  id: string;
  author: string; // jméno člena (nebo "system")
  text: string;
  ts: number;
  system?: boolean; // systémová hláška ("X se připojil")
};

export type RoomMember = {
  name: string;
  emoji: string;
  you?: boolean;
  joinedAt: number;
};

export type Classroom = {
  id: string;
  code: string; // připojovací kód (heslo), velkými písmeny
  name: string;
  emoji: string;
  ownerName: string;
  createdAt: number;
  members: RoomMember[];
  decks: SharedDeck[];
  notes: SharedNote[];
  quizzes: SharedQuiz[];
  messages: RoomMessage[];
};

export type AppState = {
  decks: Deck[];
  cards: Flashcard[];
  notes: Note[];
  sessions: FocusSession[];
  chat: ChatMessage[]; // legacy single chat — kept for one-shot hydration migration to threads
  chatThreads: ChatThread[];
  activeChatId: string | null;
  exams: Exam[];
  tasks: Task[];
  quizMisses: QuizMiss[];
  classrooms: Classroom[];
  stats: Stats;
  settings: Settings;
};
