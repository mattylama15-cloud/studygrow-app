// Export and import of user data (decks + cards + notes) as JSON.
// Designed so a single .json file can be moved between devices or backed up.

import { Platform, Share } from 'react-native';
import { AppState, Deck, Flashcard, Note } from './types';
import { uid } from './utils';
import { newCardSrs } from './srs';
import { translate } from './i18n';
import { getAiLang } from './ai/provider';

// Zkratka: hláška pro uživatele ve zvoleném jazyce.
const tr = (key: string) => translate(getAiLang(), key);

export type ExportBundle = {
  version: 1;
  exportedAt: number;
  decks: Deck[];
  cards: Flashcard[];
  notes: Note[];
};

export function buildBundle(state: AppState): ExportBundle {
  return {
    version: 1,
    exportedAt: Date.now(),
    decks: state.decks,
    cards: state.cards,
    notes: state.notes,
  };
}

function formatStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Download (web) or share (native) the user's data as a JSON file. */
export async function exportToFile(state: AppState): Promise<void> {
  const bundle = buildBundle(state);
  const json = JSON.stringify(bundle, null, 2);
  const filename = `studygrow-backup-${formatStamp()}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // Native: use Share so the user picks Files / Messages / wherever.
  try {
    await Share.share({ message: json, title: filename });
  } catch {
    // ignore — user cancelled
  }
}

/** On web only: open a file picker and read JSON. Returns parsed bundle or null. */
export function pickJsonOnWeb(): Promise<ExportBundle | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const text = await file.text();
      try { resolve(parseBundle(text)); }
      catch { resolve(null); }
    };
    input.click();
  });
}

export function parseBundle(json: string): ExportBundle {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') throw new Error(tr('import.err.notValidFile'));
  if (parsed.version !== 1) throw new Error(tr('import.err.unknownVersion'));
  if (!Array.isArray(parsed.decks) || !Array.isArray(parsed.cards) || !Array.isArray(parsed.notes)) {
    throw new Error(tr('import.err.noData'));
  }
  return parsed as ExportBundle;
}

/** Merge an imported bundle into existing state. New ids are minted to avoid collisions. */
export function mergeBundle(state: AppState, bundle: ExportBundle): { state: AppState; addedDecks: number; addedCards: number; addedNotes: number } {
  // Re-key decks and cards so an old id can't clobber an existing record.
  const deckIdMap = new Map<string, string>();
  const importedDecks: Deck[] = bundle.decks.map((d) => {
    const newId = uid('d');
    deckIdMap.set(d.id, newId);
    return { ...d, id: newId, createdAt: d.createdAt || Date.now() };
  });
  const importedCards: Flashcard[] = bundle.cards.map((c) => {
    const deckId = deckIdMap.get(c.deckId) || c.deckId;
    // Reset SRS state so imported cards are due today rather than carrying old scheduling.
    return { id: uid('c'), deckId, front: c.front, back: c.back, createdAt: Date.now(), ...newCardSrs() };
  });
  const importedNotes: Note[] = bundle.notes.map((n) => ({ ...n, id: uid('n') }));

  return {
    state: {
      ...state,
      decks: [...state.decks, ...importedDecks],
      cards: [...state.cards, ...importedCards],
      notes: [...state.notes, ...importedNotes],
    },
    addedDecks: importedDecks.length,
    addedCards: importedCards.length,
    addedNotes: importedNotes.length,
  };
}
