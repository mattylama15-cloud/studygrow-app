import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { AppState, Deck, Flashcard, Note, FocusSession, ChatMessage, Stats, Settings, Exam, Task, QuizMiss, ChatThread, Classroom, SharedDeck, SharedNote, SharedQuiz, RoomMessage, Lang } from '../types';
import { loadState, saveState } from '../storage';
import { uid, todayKey, daysBetween } from '../utils';
import { newCardSrs } from '../srs';
import { DEFAULT_MODEL, setAiLang } from '../ai/client';
import { translate } from '../i18n';

// ---------- defaults & seed ----------

const defaultStats: Stats = {
  streak: 0,
  bestStreak: 0,
  lastActiveDay: null,
  totalFocusMinutes: 0,
  plantsGrown: 0,
  reviewsDone: 0,
  xp: 0,
};

const defaultSettings: Settings = {
  apiKey: null,
  model: DEFAULT_MODEL,
  name: null,
  lang: 'en',
  dailyGoalMinutes: 60,
  hapticsEnabled: true,
  focusTheme: 'sakura',
  themeColor: 'green',
  adminPassHash: null,
  onboardingDone: false,
};

function seed(): AppState {
  // Start completely empty — the user adds their own decks, cards and notes.
  return {
    decks: [],
    cards: [],
    notes: [],
    sessions: [],
    chat: [],
    chatThreads: [],
    activeChatId: null,
    exams: [],
    tasks: [],
    quizMisses: [],
    classrooms: [],
    stats: { ...defaultStats },
    settings: { ...defaultSettings },
  };
}

// ---------- reducer ----------

type Action = { type: 'set'; updater: (s: AppState) => AppState } | { type: 'hydrate'; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set':
      return action.updater(state);
    case 'hydrate':
      return action.state;
  }
}

// merge a possibly-partial persisted state with current defaults (forward compatible)
// Názvy „nepojmenované konverzace" ve všech jazycích — podle nich se pozná,
// že se má vlákno automaticky přejmenovat podle první zprávy. Počítá se líně:
// i18n.ts importuje zpátky tenhle modul, takže na úrovni modulu by translate
// ještě nemuselo být připravené.
let _untitledTitles: Set<string> | null = null;
export function isUntitledChat(title: string): boolean {
  if (!_untitledTitles) {
    _untitledTitles = new Set<string>(
      (['cs', 'en', 'de', 'es'] as Lang[]).map((l) => translate(l, 'chat.newConversation')),
    );
  }
  return _untitledTitles.has(title);
}

function titleFromFirstMessage(messages: ChatMessage[], lang: Lang): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.text.trim());
  if (!firstUser) return translate(lang, 'chat.newConversation');
  const t = firstUser.text.trim().replace(/\s+/g, ' ');
  return t.length > 38 ? t.slice(0, 38) + '…' : t;
}

function hydrateState(saved: Partial<AppState> | null): AppState {
  const base = seed();
  if (!saved) return base;

  const lang: Lang = saved.settings?.lang ?? defaultSettings.lang;
  let chatThreads = saved.chatThreads ?? [];
  // One-shot migration: if user has the old single-chat array and no threads yet,
  // bundle the existing messages into one thread so nothing is lost.
  if ((!chatThreads || chatThreads.length === 0) && (saved.chat?.length ?? 0) > 0) {
    const msgs = saved.chat!;
    const now = Date.now();
    chatThreads = [{
      id: 'thread_migrated',
      title: titleFromFirstMessage(msgs, lang),
      messages: msgs,
      createdAt: msgs[0]?.ts ?? now,
      updatedAt: msgs[msgs.length - 1]?.ts ?? now,
    }];
  }

  const activeChatId = saved.activeChatId && chatThreads.some((t) => t.id === saved.activeChatId)
    ? saved.activeChatId
    : (chatThreads[0]?.id ?? null);

  return {
    decks: saved.decks ?? base.decks,
    cards: saved.cards ?? base.cards,
    notes: saved.notes ?? base.notes,
    sessions: saved.sessions ?? [],
    chat: [], // drained
    chatThreads,
    activeChatId,
    exams: saved.exams ?? [],
    tasks: saved.tasks ?? [],
    quizMisses: saved.quizMisses ?? [],
    classrooms: saved.classrooms ?? [],
    stats: { ...defaultStats, ...(saved.stats ?? {}) },
    // Only one AI model now (Compound) — always use it, ignore any old saved model id.
    settings: { ...defaultSettings, ...(saved.settings ?? {}), model: defaultSettings.model },
  };
}

// ---------- context value ----------

type Ctx = {
  state: AppState;
  hydrated: boolean;
  // decks
  addDeck: (d: Omit<Deck, 'id' | 'createdAt'>) => Deck;
  updateDeck: (id: string, patch: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  // studijní materiály balíčku (fotky poznámek) — hromadí se
  addDeckSource: (deckId: string, name: string, text: string) => void;
  deleteDeckSource: (deckId: string, sourceId: string) => void;
  // cards
  addCards: (deckId: string, cards: { front: string; back: string }[]) => void;
  updateCard: (card: Flashcard) => void;
  deleteCard: (id: string) => void;
  // notes
  addNote: (n?: Partial<Note>) => Note;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  // focus
  addSession: (s: Omit<FocusSession, 'id'>) => void;
  // chat — operates on the ACTIVE thread (auto-created on first message)
  addChat: (m: ChatMessage) => void;
  updateChat: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  // multi-conversation
  newChatThread: () => ChatThread;
  switchChatThread: (id: string) => void;
  deleteChatThread: (id: string) => void;
  renameChatThread: (id: string, title: string) => void;
  // progress
  recordReviews: (count: number) => void;
  addXp: (amount: number) => void;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  // bulk import (append-merge of a backup bundle)
  importBundle: (updater: (s: AppState) => AppState) => void;
  // exams
  addExam: (e: Omit<Exam, 'id' | 'createdAt'>) => Exam;
  updateExam: (id: string, patch: Partial<Exam>) => void;
  deleteExam: (id: string) => void;
  // tasks
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  // quiz misses (wrong answers — fed to the Coach)
  recordQuizMisses: (misses: Omit<QuizMiss, 'id' | 'ts'>[]) => void;
  clearQuizMiss: (id: string) => void;
  clearAllQuizMisses: () => void;
  // classrooms ("Study with me" — sdílené místnosti)
  createClassroom: (name: string, emoji: string) => Classroom;
  joinClassroom: (code: string) => { ok: boolean; room?: Classroom; reason?: string };
  leaveClassroom: (id: string) => void;
  shareDeckToRoom: (roomId: string, deck: Omit<SharedDeck, 'id' | 'ts' | 'sharedBy'>) => void;
  shareNoteToRoom: (roomId: string, note: Omit<SharedNote, 'id' | 'ts' | 'sharedBy'>) => void;
  shareQuizToRoom: (roomId: string, quiz: Omit<SharedQuiz, 'id' | 'ts' | 'sharedBy'>) => void;
  postRoomMessage: (roomId: string, text: string) => void;
  removeSharedItem: (roomId: string, kind: 'deck' | 'note' | 'quiz', itemId: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

// Připojovací kód místnosti — 6 znaků, bez matoucích (0/O, 1/I).
function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Streak: zvýší se první aktivitou v novém dni. Když byl poslední aktivní den
// včera → +1. Když je mezera větší → série začíná znovu od 1.
function touchStreak(stats: Stats): Stats {
  const today = todayKey();
  if (stats.lastActiveDay === today) return stats; // dnes už započítáno
  let streak = 1;
  if (stats.lastActiveDay && daysBetween(stats.lastActiveDay, today) === 1) {
    streak = stats.streak + 1;
  }
  return { ...stats, streak, bestStreak: Math.max(stats.bestStreak, streak), lastActiveDay: today };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AppState, () => seed());
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = React.useState(false);

  // load persisted state once
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      dispatch({ type: 'hydrate', state: hydrateState(saved) });
      hydratedRef.current = true;
      setHydrated(true);
    })();
  }, []);

  // persist on change (after hydration)
  useEffect(() => {
    if (hydratedRef.current) saveState(state);
  }, [state]);

  // Zrcadlí zvolený jazyk do AI vrstvy (prompty i chybové hlášky), která je
  // mimo React a nemůže použít hook useT().
  useEffect(() => {
    setAiLang(state.settings.lang ?? 'en');
  }, [state.settings.lang]);

  const set = (updater: (s: AppState) => AppState) => dispatch({ type: 'set', updater });

  // Jazyk pro texty, které vznikají tady v contextu (názvy konverzací,
  // systémové zprávy v místnostech). Uvnitř `set` používej s.settings.lang.
  const lang: Lang = state.settings.lang ?? defaultSettings.lang;

  const value: Ctx = {
    state,
    hydrated,

    addDeck: (d) => {
      const deck: Deck = { ...d, id: uid('deck'), createdAt: Date.now() };
      set((s) => ({ ...s, decks: [deck, ...s.decks] }));
      return deck;
    },
    updateDeck: (id, patch) =>
      set((s) => ({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    deleteDeck: (id) =>
      set((s) => ({ ...s, decks: s.decks.filter((d) => d.id !== id), cards: s.cards.filter((c) => c.deckId !== id) })),

    addDeckSource: (deckId, name, text) =>
      set((s) => ({
        ...s,
        decks: s.decks.map((d) => (d.id === deckId
          ? { ...d, sources: [...(d.sources ?? []), { id: uid('src'), name, text, addedAt: Date.now() }] }
          : d)),
      })),
    deleteDeckSource: (deckId, sourceId) =>
      set((s) => ({
        ...s,
        decks: s.decks.map((d) => (d.id === deckId
          ? { ...d, sources: (d.sources ?? []).filter((x) => x.id !== sourceId) }
          : d)),
      })),

    addCards: (deckId, cards) => {
      const now = Date.now();
      const made: Flashcard[] = cards.map((c) => ({
        id: uid('card'), deckId, front: c.front, back: c.back, createdAt: now, ...newCardSrs(),
      }));
      set((s) => ({ ...s, cards: [...s.cards, ...made] }));
    },
    updateCard: (card) =>
      set((s) => ({ ...s, cards: s.cards.map((c) => (c.id === card.id ? card : c)) })),
    deleteCard: (id) => set((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) })),

    addNote: (n) => {
      const note: Note = { id: uid('note'), title: n?.title ?? '', body: n?.body ?? '', updatedAt: Date.now() };
      set((s) => ({ ...s, notes: [note, ...s.notes] }));
      return note;
    },
    updateNote: (id, patch) =>
      set((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
      })),
    deleteNote: (id) => set((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),

    addSession: (sess) => {
      const session: FocusSession = { ...sess, id: uid('sess') };
      set((s) => {
        const stats = touchStreak({
          ...s.stats,
          totalFocusMinutes: s.stats.totalFocusMinutes + session.completedMinutes,
          plantsGrown: s.stats.plantsGrown + (session.completed ? 1 : 0),
          xp: s.stats.xp + Math.round(session.completedMinutes * (session.completed ? 2 : 1)),
        });
        return { ...s, sessions: [session, ...s.sessions].slice(0, 200), stats };
      });
    },

    addChat: (m) => set((s) => {
      const now = Date.now();
      const l: Lang = s.settings.lang ?? defaultSettings.lang;
      const newTitle = translate(l, 'chat.newConversation');
      // Find or create the active thread.
      const threads = [...s.chatThreads];
      let activeId = s.activeChatId;
      let active = threads.find((t) => t.id === activeId);
      if (!active) {
        active = { id: uid('thread'), title: newTitle, messages: [], createdAt: now, updatedAt: now };
        threads.unshift(active);
        activeId = active.id;
      }
      const newMsgs = [...active.messages, m];
      // Auto-title from the first real user message. Porovnává se se všemi jazyky,
      // aby přejmenování fungovalo i po přepnutí jazyka.
      const isUntitled = isUntitledChat(active.title);
      const isFirstUser = isUntitled && m.role === 'user' && m.text.trim();
      const updated: ChatThread = {
        ...active,
        messages: newMsgs,
        title: isFirstUser ? titleFromFirstMessage(newMsgs, l) : active.title,
        updatedAt: now,
      };
      return { ...s, chatThreads: threads.map((t) => (t.id === active!.id ? updated : t)), activeChatId: activeId };
    }),
    updateChat: (id, patch) => set((s) => {
      const activeId = s.activeChatId;
      if (!activeId) return s;
      return {
        ...s,
        chatThreads: s.chatThreads.map((t) => t.id !== activeId ? t : { ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
      };
    }),
    clearChat: () => set((s) => {
      // Wipes the ACTIVE thread's messages and keeps the thread shell (so user stays on it).
      const activeId = s.activeChatId;
      if (!activeId) return s;
      return {
        ...s,
        chatThreads: s.chatThreads.map((t) => t.id !== activeId ? t : { ...t, messages: [], title: translate(s.settings.lang ?? defaultSettings.lang, 'chat.newConversation'), updatedAt: Date.now() }),
      };
    }),

    newChatThread: () => {
      const now = Date.now();
      const thread: ChatThread = { id: uid('thread'), title: translate(lang, 'chat.newConversation'), messages: [], createdAt: now, updatedAt: now };
      set((s) => ({ ...s, chatThreads: [thread, ...s.chatThreads], activeChatId: thread.id }));
      return thread;
    },
    switchChatThread: (id) => set((s) => s.chatThreads.some((t) => t.id === id) ? { ...s, activeChatId: id } : s),
    deleteChatThread: (id) => set((s) => {
      const remaining = s.chatThreads.filter((t) => t.id !== id);
      const newActive = s.activeChatId === id ? (remaining[0]?.id ?? null) : s.activeChatId;
      return { ...s, chatThreads: remaining, activeChatId: newActive };
    }),
    renameChatThread: (id, title) => set((s) => ({
      ...s,
      chatThreads: s.chatThreads.map((t) => (t.id === id ? { ...t, title: title.trim() || t.title } : t)),
    })),

    recordReviews: (count) =>
      set((s) => {
        const stats = touchStreak({
          ...s.stats,
          reviewsDone: s.stats.reviewsDone + count,
          xp: s.stats.xp + count * 3,
        });
        return { ...s, stats };
      }),

    addXp: (amount) => set((s) => ({ ...s, stats: { ...s.stats, xp: s.stats.xp + amount } })),

    updateSettings: (patch) => set((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

    resetAll: () => set((s) => {
      const fresh = seed();
      // keep the user's settings (name, API key, model, goal)
      return { ...fresh, settings: s.settings };
    }),

    importBundle: (updater) => set(updater),

    addExam: (e) => {
      const exam: Exam = { ...e, id: uid('exam'), createdAt: Date.now() };
      set((s) => ({ ...s, exams: [...s.exams, exam].sort((a, b) => a.dateISO.localeCompare(b.dateISO)) }));
      return exam;
    },
    updateExam: (id, patch) =>
      set((s) => ({ ...s, exams: s.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort((a, b) => a.dateISO.localeCompare(b.dateISO)) })),
    deleteExam: (id) =>
      set((s) => ({ ...s, exams: s.exams.filter((e) => e.id !== id), tasks: s.tasks.filter((t) => t.examId !== id) })),

    addTask: (t) => {
      const task: Task = { ...t, id: uid('task'), createdAt: Date.now(), done: false };
      set((s) => ({ ...s, tasks: [...s.tasks, task].sort((a, b) => a.dateISO.localeCompare(b.dateISO)) }));
      return task;
    },
    updateTask: (id, patch) =>
      set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)).sort((a, b) => a.dateISO.localeCompare(b.dateISO)) })),
    toggleTask: (id) =>
      set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
    deleteTask: (id) =>
      set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

    recordQuizMisses: (misses) => {
      if (!misses.length) return;
      const now = Date.now();
      const added: QuizMiss[] = misses.map((m, i) => ({ ...m, id: uid('miss'), ts: now + i }));
      // Cap to last 200 misses so the list doesn't grow forever.
      set((s) => ({ ...s, quizMisses: [...s.quizMisses, ...added].slice(-200) }));
    },
    clearQuizMiss: (id) => set((s) => ({ ...s, quizMisses: s.quizMisses.filter((m) => m.id !== id) })),
    clearAllQuizMisses: () => set((s) => ({ ...s, quizMisses: [] })),

    createClassroom: (name, emoji) => {
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const now = Date.now();
      const room: Classroom = {
        id: uid('room'),
        code: makeRoomCode(),
        name: name.trim() || translate(lang, 'room.defaultName'),
        emoji: emoji || '📚',
        ownerName: me,
        createdAt: now,
        members: [{ name: me, emoji: '⭐', you: true, joinedAt: now }],
        decks: [], notes: [], quizzes: [],
        messages: [{ id: uid('msg'), author: 'system', text: translate(lang, 'room.created'), ts: now, system: true }],
      };
      set((s) => ({ ...s, classrooms: [room, ...s.classrooms] }));
      return room;
    },

    joinClassroom: (code) => {
      const norm = code.trim().toUpperCase();
      if (norm.length < 4) return { ok: false, reason: translate(lang, 'room.codeTooShort') };
      const existing = state.classrooms.find((r) => r.code === norm);
      if (existing) return { ok: true, room: existing };
      // Lokálně neexistuje → vytvoříme "připojenou" místnost s tímto kódem (placeholder,
      // než bude server). Uživatel tak může rovnou sdílet a psát.
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const now = Date.now();
      const room: Classroom = {
        id: uid('room'),
        code: norm,
        name: translate(lang, 'room.namedByCode', { code: norm }),
        emoji: '📚',
        ownerName: me,
        createdAt: now,
        members: [{ name: me, emoji: '⭐', you: true, joinedAt: now }],
        decks: [], notes: [], quizzes: [],
        messages: [{ id: uid('msg'), author: 'system', text: translate(lang, 'room.joinedByCode', { code: norm }), ts: now, system: true }],
      };
      set((s) => ({ ...s, classrooms: [room, ...s.classrooms] }));
      return { ok: true, room };
    },

    leaveClassroom: (id) => set((s) => ({ ...s, classrooms: s.classrooms.filter((r) => r.id !== id) })),

    shareDeckToRoom: (roomId, deck) => {
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const item: SharedDeck = { ...deck, id: uid('sdeck'), sharedBy: me, ts: Date.now() };
      set((s) => ({
        ...s,
        classrooms: s.classrooms.map((r) => r.id !== roomId ? r : {
          ...r,
          decks: [item, ...r.decks],
          messages: [...r.messages, { id: uid('msg'), author: 'system', text: translate(lang, 'room.sharedDeck', { who: me, title: item.title, n: item.cards.length }), ts: Date.now(), system: true }],
        }),
      }));
    },

    shareNoteToRoom: (roomId, note) => {
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const item: SharedNote = { ...note, id: uid('snote'), sharedBy: me, ts: Date.now() };
      set((s) => ({
        ...s,
        classrooms: s.classrooms.map((r) => r.id !== roomId ? r : {
          ...r,
          notes: [item, ...r.notes],
          messages: [...r.messages, { id: uid('msg'), author: 'system', text: translate(lang, 'room.sharedNote', { who: me, title: item.title || translate(lang, 'common.untitled') }), ts: Date.now(), system: true }],
        }),
      }));
    },

    shareQuizToRoom: (roomId, quiz) => {
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const item: SharedQuiz = { ...quiz, id: uid('squiz'), sharedBy: me, ts: Date.now() };
      set((s) => ({
        ...s,
        classrooms: s.classrooms.map((r) => r.id !== roomId ? r : {
          ...r,
          quizzes: [item, ...r.quizzes],
          messages: [...r.messages, { id: uid('msg'), author: 'system', text: translate(lang, 'room.sharedQuiz', { who: me, title: item.title, n: item.questions.length }), ts: Date.now(), system: true }],
        }),
      }));
    },

    postRoomMessage: (roomId, text) => {
      const t = text.trim();
      if (!t) return;
      const me = state.settings.name?.trim() || translate(lang, 'room.you');
      const msg: RoomMessage = { id: uid('msg'), author: me, text: t, ts: Date.now() };
      set((s) => ({
        ...s,
        classrooms: s.classrooms.map((r) => r.id !== roomId ? r : { ...r, messages: [...r.messages, msg] }),
      }));
    },

    removeSharedItem: (roomId, kind, itemId) => set((s) => ({
      ...s,
      classrooms: s.classrooms.map((r) => {
        if (r.id !== roomId) return r;
        if (kind === 'deck') return { ...r, decks: r.decks.filter((d) => d.id !== itemId) };
        if (kind === 'note') return { ...r, notes: r.notes.filter((n) => n.id !== itemId) };
        return { ...r, quizzes: r.quizzes.filter((q) => q.id !== itemId) };
      }),
    })),
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
