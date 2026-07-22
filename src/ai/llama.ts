// On-device provider: Llama 3.2 3B (text) + OCR (foto → text).
//
// Běží POUZE v nativním buildu (Expo dev build / EAS), NE ve webové PWA —
// prohlížeč neutáhne 2 GB model. Pro web zůstává groqProvider.
//
// Přepnutí na tenhle provider = JEDEN řádek v provider.ts:
//   import { llamaProvider as activeProvider } from './llama';
//
// Návrhový princip pro malý model:
//   • Volný text (chat, vysvětlení, shrnutí) → v pohodě.
//   • Strukturovaná data (kartičky) → NIKDY nežádat JSON! 3B model ho pravidelně
//     pokazí. Místo toho ŘÁDKOVÝ formát "Q: … | A: …", který si naparsujeme sami.
//   • Kvíz / kontrola balíčku / plán → 3B na přísný JSON nestačí → capabilities je
//     mají vypnuté, takže je UI ani nenabídne (funkce se rozbít nemůže).
//   • Fotky → přes on-device OCR (přepis textu), ne vision-chat.

import { AIError, AIProvider, GeneratedCard, GeneratedQuiz, PlanItem, CardIssue, ExplainStyle, getAiLang } from './provider';
import { ChatMessage } from '../types';
import { translate, aiLangInstruction } from '../i18n';

// Zkratka: hláška pro uživatele ve zvoleném jazyce.
const tr = (key: string, vars?: Record<string, string | number>) => translate(getAiLang(), key, vars);

// Zkratka: instrukce pro model, v jakém jazyce má odpovídat.
const langInstr = () => aiLangInstruction(getAiLang());

// ─────────────────────────────────────────────────────────────────────────────
// Lazy bridge k react-native-executorch.
// Držíme require lazy + v try/catch, aby se web build ani tooling nerozbily,
// když knihovna není nainstalovaná. Instaluje se až v nativním projektu:
//   npx expo install react-native-executorch
// ─────────────────────────────────────────────────────────────────────────────

type LlmHandle = {
  generate: (prompt: string) => Promise<string>;
  isReady: () => boolean;
};

let _llm: LlmHandle | null = null;
let _loading: Promise<LlmHandle> | null = null;

// Model + tokenizer se stáhnou/přibalí v nativním buildu. Zdroje (URL nebo
// bundlované asset ID) se doplní tam — tady držíme jen jméno pro přehled.
const MODEL_ID = 'llama-3.2-3B-instruct';

async function getLlm(): Promise<LlmHandle> {
  if (_llm && _llm.isReady()) return _llm;
  if (_loading) return _loading;

  _loading = (async () => {
    let etorch: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      etorch = require('react-native-executorch');
    } catch {
      throw new AIError(tr('ai.err.nativeOnly'), 'native-only');
    }

    // react-native-executorch nabízí hooky (useLLM) i imperativní API.
    // V providerové vrstvě (mimo React) použijeme imperativní modul.
    const Module = etorch.LLMModule ?? etorch.ExecuTorchLLM ?? etorch.default;
    if (!Module) throw new AIError(tr('ai.err.moduleLoad'), 'native-only');

    const instance = typeof Module === 'function' ? new Module() : Module;

    // Načtení modelu. Přesné názvy metod/parametrů se doladí podle verze
    // knihovny v nativním projektu; sjednotíme je za tímhle rozhraním.
    if (typeof instance.load === 'function') {
      await instance.load({ model: MODEL_ID });
    } else if (typeof instance.loadModel === 'function') {
      await instance.loadModel(MODEL_ID);
    }

    const handle: LlmHandle = {
      isReady: () => (typeof instance.isReady === 'function' ? instance.isReady() : true),
      generate: async (prompt: string) => {
        const fn = instance.generate ?? instance.forward ?? instance.runInference;
        if (typeof fn !== 'function') throw new AIError(tr('ai.err.cannotGenerate'), 'unsupported');
        const out = await fn.call(instance, prompt);
        return typeof out === 'string' ? out : (out?.text ?? String(out ?? ''));
      },
    };
    _llm = handle;
    return handle;
  })();

  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt sestavení pro Llama 3.2 chat formát.
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(system: string, turns: { role: 'user' | 'assistant'; text: string }[]): string {
  // Llama 3 chat template.
  let p = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|>`;
  for (const t of turns) {
    p += `<|start_header_id|>${t.role}<|end_header_id|>\n\n${t.text}<|eot_id|>`;
  }
  p += `<|start_header_id|>assistant<|end_header_id|>\n\n`;
  return p;
}

function cleanOutput(raw: string): string {
  return raw
    .replace(/<\|eot_id\|>[\s\S]*$/g, '')
    .replace(/<\|start_header_id\|>[\s\S]*$/g, '')
    .replace(/<\|end_header_id\|>/g, '')
    .trim();
}

// Pojistka proti Markdownu (malé modely ho stejně občas vysypou).
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*+/g, '')
    .trim();
}

async function run(system: string, turns: { role: 'user' | 'assistant'; text: string }[]): Promise<string> {
  const llm = await getLlm();
  const out = await llm.generate(buildPrompt(system, turns));
  const text = cleanOutput(out);
  if (!text) throw new AIError(tr('ai.err.empty'), 'bad-output');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR bridge (foto → text). react-native-executorch má i OCR modul.
// ─────────────────────────────────────────────────────────────────────────────

async function ocr(imageUri: string): Promise<string> {
  let etorch: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    etorch = require('react-native-executorch');
  } catch {
    throw new AIError(tr('ai.err.ocrNativeOnly'), 'native-only');
  }
  const OcrModule = etorch.OCRModule ?? etorch.ExecuTorchOCR;
  if (!OcrModule) throw new AIError(tr('ai.err.ocrModuleLoad'), 'native-only');
  const inst = typeof OcrModule === 'function' ? new OcrModule() : OcrModule;
  if (typeof inst.load === 'function') await inst.load();
  const fn = inst.recognize ?? inst.forward ?? inst.run;
  if (typeof fn !== 'function') throw new AIError(tr('ai.err.ocrCannotRead'), 'unsupported');
  const res = await fn.call(inst, imageUri);
  // Výstup bývá pole detekcí {text,...} nebo rovnou string.
  if (Array.isArray(res)) return res.map((r: any) => r?.text ?? '').join('\n').trim();
  return typeof res === 'string' ? res.trim() : (res?.text ?? '').toString().trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsery pro řádkové formáty (spolehlivé u malých modelů).
// ─────────────────────────────────────────────────────────────────────────────

// Očekává řádky "Q: … | A: …" (nebo "Otázka: … | Odpověď: …").
function parseCards(raw: string): GeneratedCard[] {
  const out: GeneratedCard[] = [];
  for (const line of raw.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(/^(?:\d+[.)]\s*)?(?:Q|Otázka)\s*:\s*(.+?)\s*\|\s*(?:A|Odpověď)\s*:\s*(.+)$/i);
    if (m) {
      const front = stripMarkdown(m[1]).trim();
      const back = stripMarkdown(m[2]).trim();
      if (front && back) out.push({ front, back });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

const TUTOR_SYSTEM = `Jsi StudyGrow AI – přátelský a přesný studijní lektor.
Odpovídej stručně a srozumitelně. Vysvětluj krok za krokem, používej příklady.
Když si nejsi jistý, přiznej to a nevymýšlej si fakta. Piš čistý text bez Markdownu.`;

export const llamaProvider: AIProvider = {
  defaultModel: MODEL_ID,
  hasDefaultKey: true, // on-device: žádný klíč není potřeba
  resolveKey: () => 'on-device',
  // 3B model utáhne volný text a jednoduché kartičky (řádkový formát).
  // Kvíz / kontrola / plán potřebují přísný JSON → vypnuto. Fotky přes OCR → vision zap.
  capabilities: { chat: true, explain: true, summarize: true, flashcards: true, quiz: false, checkDeck: false, plan: false, vision: true },

  async tutorReply(history, _apiKey, _model, _images, extraSystemContext) {
    // Fotky v chatu on-device neřešíme jako vision-chat: uživatel je přečte přes OCR
    // (tlačítko foto → text) a text pak pošle. Tady jedeme čistě textově.
    const turns = history
      .filter((m) => !m.pending && m.text.trim().length > 0)
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text.slice(0, 3000) }));
    const system = TUTOR_SYSTEM + langInstr() + (extraSystemContext || '');
    return stripMarkdown(await run(system, turns));
  },

  async generateFlashcards(source, count, _apiKey, _model, focus): Promise<GeneratedCard[]> {
    // ŘÁDKOVÝ formát místo JSON — pro malý model klíčové.
    const system = `Tvoříš studijní kartičky. Pro každou kartičku napiš PŘESNĚ jeden řádek ve formátu:
Q: <otázka> | A: <odpověď>
Žádný jiný text, žádné číslování navíc, žádné Markdown. Odpovědi krátké a přesné.
Značky "Q:" a "A:" nech VŽDY anglicky, ale obsah otázky i odpovědi piš v jazyce podle instrukce níže.
Než odpovíš, zkontroluj si kartičky: odpověď musí být správná a opřená o materiál, otázky se nesmí opakovat. Radši méně kartiček než nepřesné.${langInstr()}`;
    const want = (focus || '').trim();
    const user = want
      ? `Vytvoř ${count} kartiček z tohoto materiálu. Uživatel se potřebuje naučit PŘESNĚ TOTO: "${want.slice(0, 400)}". Drž se toho a vynech ostatní.\n\n${source.slice(0, 3500)}`
      : `Vytvoř ${count} kartiček z tohoto materiálu:\n\n${source.slice(0, 3500)}`;
    const raw = await run(system, [{ role: 'user', text: user }]);
    const cards = parseCards(raw);
    if (cards.length === 0) throw new AIError(tr('ai.err.noCardsMade'), 'bad-output');
    return cards.slice(0, count);
  },

  async summarizeToNotes(source, _apiKey, _model): Promise<string> {
    const system = `Vytvoř přehledné studijní shrnutí jako čistý text.
Krátké odrážky uvozené pomlčkou "- ". Žádný Markdown (žádné hvězdičky ani mřížky).${langInstr()}`;
    const raw = await run(system, [{ role: 'user', text: `Shrň do studijních poznámek:\n\n${source.slice(0, 3500)}` }]);
    return stripMarkdown(raw);
  },

  async explainCard(front, back, style, _apiKey, _model): Promise<string> {
    const styles: Record<ExplainStyle, string> = {
      analogy: 'pomocí přirovnání z běžného života',
      story: 'jako krátký příběh, který se dobře pamatuje',
      mnemonic: 'pomocí mnemotechnické pomůcky (rýmovačka, zkratka)',
      simple: 'maximálně jednoduše, jako desetiletému dítěti',
    };
    const system = `Jsi trpělivý učitel. Vysvětli kartičku ${styles[style] || styles.simple}.
Čistý text bez Markdownu, maximálně 5 vět.${langInstr()}`;
    const raw = await run(system, [{ role: 'user', text: `Otázka: ${front}\nOdpověď: ${back}` }]);
    return stripMarkdown(raw);
  },

  async extractTextFromImage(base64DataUrl, _apiKey): Promise<string> {
    return ocr(base64DataUrl);
  },

  // ── Funkce, které 3B spolehlivě nezvládne — capabilities je mají vypnuté,
  //    takže je UI nenabídne. Kdyby je přesto někdo zavolal, jasná hláška. ──
  async generateQuiz(): Promise<GeneratedQuiz[]> {
    throw new AIError(tr('ai.err.quizUnsupported'), 'unsupported');
  },
  async checkDeck(): Promise<CardIssue[]> {
    throw new AIError(tr('ai.err.checkDeckUnsupported'), 'unsupported');
  },
  async planStudySession(): Promise<PlanItem[]> {
    throw new AIError(tr('ai.err.planUnsupported'), 'unsupported');
  },
};
