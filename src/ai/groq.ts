// Groq cloud provider (OpenAI-compatible). Implements AIProvider.
// To switch to on-device Llama later, change the active import in provider.ts.

import { ChatMessage } from '../types';
import { AIError, AIProvider, GeneratedCard, GeneratedQuiz, PlanItem, getAiLang } from './provider';
import { translate, aiLangInstruction } from '../i18n';

// Zkratka: hláška pro uživatele ve zvoleném jazyce.
const tr = (key: string, vars?: Record<string, string | number>) => translate(getAiLang(), key, vars);

// Zkratka: instrukce pro model, v jakém jazyce má odpovídat.
const langInstr = () => aiLangInstruction(getAiLang());

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
// Groq vyřadil llama-4-scout 17. 6. 2026; qwen3.6-27b je aktuální model,
// který umí číst obrázky (viz console.groq.com/docs/vision).
const VISION_MODEL = 'qwen/qwen3.6-27b';

// Optional built-in key for the user. Empty by default — they paste their own in Settings.
const DEFAULT_GROQ_KEY_PARTS: string[] = [];
const DEFAULT_GROQ_KEY = DEFAULT_GROQ_KEY_PARTS.join('');

function resolveKey(userKey: string | null): string | null {
  return (userKey && userKey.trim()) || DEFAULT_GROQ_KEY || null;
}

// Pojistka: i když model dostane pokyn nepoužívat Markdown, malé modely ho občas
// vrátí. Odstraní hvězdičky, mřížky nadpisů a zpětné apostrofy, aby text byl čistý.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')        // **tučné** -> tučné
    .replace(/\*(.+?)\*/g, '$1')            // *kurzíva* -> kurzíva
    .replace(/`([^`]+)`/g, '$1')            // `kód` -> kód
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')     // ## Nadpis -> Nadpis
    .replace(/\*+/g, '')                    // osamělé hvězdičky
    .replace(/[ \t]+\n/g, '\n')             // úklid mezer na konci řádků
    .trim();
}

// Vision model občas i přes zákaz přidá vlastní komentář ("Okay, I see…",
// "The text reads:"). Tady ho odřízneme, ať se do poznámek nedostane.
const OCR_CHATTER = [
  // Jen s čárkou/dvojtečkou za slovem — jinak by padla i věta z poznámek.
  /^(okay|ok|sure|alright|certainly|hello|hi)\s*[,:!.]+.*$/i,
  /^(here('s| is)|this is|i (can |will |'ll )?(see|read|transcribe)|the (text|image|page|note)s?\b).*$/i,
  /^i('m| am)?\s*(having|had)?\s*(trouble|difficulty|unable|sorry|can'?t)\b.*$/i,
  /^(let me|i'?ll)\b.*$/i,
  /^(transcription|transcribed text|output|result)\s*:?\s*$/i,
  /^(note|poznámka)\s*:\s*(the|this|it)\b.*$/i,
  /^[-–—*_=]{3,}$/,
];

function cleanOcr(text: string): string {
  const lines = stripMarkdown(text || '').split('\n');

  // Komentář bývá na začátku nebo na konci — uvnitř může jít o skutečný text.
  while (lines.length && (!lines[0].trim() || OCR_CHATTER.some((r) => r.test(lines[0].trim())))) lines.shift();
  while (lines.length && (!lines[lines.length - 1].trim() || OCR_CHATTER.some((r) => r.test(lines[lines.length - 1].trim())))) lines.pop();

  const out = lines.join('\n').trim();
  return out === 'NO_TEXT' ? '' : out;
}

type Role = 'system' | 'user' | 'assistant';
type WireMessage = { role: Role; content: any };
type CallOpts = { apiKey: string | null; model: string; maxTokens?: number; temperature?: number };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function parseRetrySeconds(res: Response, body: string): number {
  const h = res.headers.get('retry-after');
  if (h) {
    const n = parseFloat(h);
    if (!isNaN(n) && n > 0) return n;
  }
  const m = body.match(/try again in\s+(?:(\d+)m)?\s*([\d.]+)\s*s/i);
  if (m) return parseInt(m[1] || '0', 10) * 60 + parseFloat(m[2]);
  return 0;
}

async function callGroq(messages: WireMessage[], opts: CallOpts): Promise<string> {
  const key = resolveKey(opts.apiKey);
  if (!key) throw new AIError(tr('ai.err.noKey'), 'no-key');

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
          messages,
        }),
      });
    } catch {
      throw new AIError(tr('ai.err.network'), 'network');
    }

    if (!res.ok) {
      let detail = '';
      try { const body = await res.json(); detail = body?.error?.message || JSON.stringify(body); }
      catch { detail = await res.text().catch(() => ''); }
      if (res.status === 401) throw new AIError(tr('ai.err.badKey'), 'bad-key');
      if (res.status === 429) {
        const wait = parseRetrySeconds(res, detail);
        if (attempt < maxAttempts - 1 && wait > 0 && wait <= 20) { await sleep(wait * 1000 + 300); continue; }
        throw new AIError(wait > 0
          ? tr('ai.err.rateLimitWait', { s: Math.ceil(wait) })
          : tr('ai.err.rateLimit'), 'rate-limit');
      }
      if (res.status === 413) throw new AIError(tr('ai.err.tooLarge'), 'too-large');
      throw new AIError(tr('ai.err.http', { status: res.status, detail }), 'http');
    }

    const data = await res.json();
    let text = (data?.choices?.[0]?.message?.content ?? '').toString();
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*<\/?think>\s*/gi, '').trim();
    if (!text) throw new AIError(tr('ai.err.empty'), 'bad-output');
    return text;
  }
  throw new AIError(tr('ai.err.rateLimit'), 'rate-limit');
}

function extractJson(text: string): any {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstArr = t.indexOf('['); const firstObj = t.indexOf('{');
  let start = -1;
  if (firstArr === -1) start = firstObj;
  else if (firstObj === -1) start = firstArr;
  else start = Math.min(firstArr, firstObj);
  if (start === -1) throw new AIError(tr('ai.err.badData'), 'bad-output');
  const open = t[start]; const close = open === '[' ? ']' : '}';
  const end = t.lastIndexOf(close);
  if (end === -1) throw new AIError(tr('ai.err.badData'), 'bad-output');
  try { return JSON.parse(t.slice(start, end + 1)); }
  catch { throw new AIError(tr('ai.err.parse'), 'bad-output'); }
}

const TUTOR_SYSTEM = `Jsi StudyGrow AI – špičkový, přátelský a maximálně přesný studijní lektor. Tvým vzorem je precizní, čestný a srozumitelný asistent.

JAK PŘEMÝŠLÍŠ
- Než odpovíš, v duchu si problém rozeber krok za krokem. Ukaž ale jen čistý, srozumitelný výsledek – ne svoje „přemýšlení".
- Buď přesný. Když si nejsi jistý, OTEVŘENĚ to řekni a uveď míru jistoty. NIKDY si nevymýšlej fakta, jména, čísla, modely, značky, data ani zdroje.
- Když něco z dostupných informací nejde určit, řekni co chybí (např. „z téhle fotky to jistě nepoznám, pomohl by …").

JAK ODPOVÍDÁŠ
- Odpovídej v jazyce, který má student nastavený v aplikaci (viz instrukce o jazyce níže).
- Jasně, strukturovaně, k věci. U výpočtů ukaž postup. Používej příklady a analogie.
- Povzbuzuj, ale nelichoť. Na konci můžeš nabídnout krok dál nebo otázku k procvičení.
- Formátuj POUZE v Markdownu: nadpisy (#), **tučně**, odrážky (-), číslované seznamy (1.), > citace, \`kód\`. NIKDY nepoužívej HTML značky jako <br>, <p>, <div> ani Markdown tabulky s | — místo tabulky udělej odrážky. Konce řádků dělej skutečným novým řádkem.

CO NEUMÍŠ (buď upřímný)
- NEUMÍŠ prohlížet internet ani vyhledávat v reálném čase. Nemáš přístup k živým webovým stránkám.
- NEUMÍŠ posílat ani generovat obrázky a NEUMÍŠ otevírat odkazy. Když o to student požádá, slušně to vysvětli.
- NIKDY si nevymýšlej URL adresy, odkazy ani zdroje. Uváděj jen odkazy, kterými si jsi naprosto jistý, jinak žádné. Radši řekni „přesnou adresu ti nedám" než vymyslet odkaz.

PRÁCE S OBRÁZKY A DOKUMENTY (může jich přijít víc najednou)
- Nejdřív si POZORNĚ přečti veškerý obsah obrázků: text, otázky, tabulky, grafy, popisky, rovnice.
- Pracovní list / test / cvičení: vyřeš ho a u KAŽDÉ otázky napiš správnou odpověď (formát „1) … 2) …"). Kde to pomůže, krátce zdůvodni.
- Dokument / učebnice: shrň a vysvětli, co student potřebuje, věcně a správně.
- Identifikace objektu (auto, rostlina, výrobek…): NIKDY neuváděj konkrétní model / značku / rok / generaci jako fakt. Popiš jen to, co je opravdu VIDĚT (logo na masce, tvar karoserie, barva, nápisy) a jasně řekni, že přesný model a rok z fotky spolehlivě určit NELZE. Nanejvýš nabídni 1–2 možnosti označené jako nejistý odhad. Radši „přesně to z fotky nepoznám" než tipovat. (Rozpoznávání přesných modelů aut z fotky je nad rámec tvých schopností.)
- Když je text na fotce nečitelný nebo nejednoznačný, řekni to a nevymýšlej si obsah.`;

export const groqProvider: AIProvider = {
  defaultModel: DEFAULT_MODEL,
  hasDefaultKey: DEFAULT_GROQ_KEY.length > 0,
  resolveKey,
  // Cloudový 120B model zvládá všechno včetně přísného JSONu a fotek.
  capabilities: { chat: true, explain: true, summarize: true, flashcards: true, quiz: true, checkDeck: true, plan: true, vision: true },

  async tutorReply(history, apiKey, model, images, extraSystemContext) {
    const imgs = (images || []).filter(Boolean).slice(0, 6);
    const conv = history.filter((m) => !m.pending && m.text.trim().length > 0).slice(-12);
    const systemPrompt = TUTOR_SYSTEM + langInstr() + (extraSystemContext || '');
    const messages: WireMessage[] = [{ role: 'system', content: systemPrompt }];
    conv.forEach((m, i) => {
      const isLast = i === conv.length - 1;
      if (isLast && imgs.length && m.role === 'user') {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.text || tr('ai.prompt.lookAtImages') },
            ...imgs.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        });
      } else {
        messages.push({ role: m.role as Role, content: m.text.slice(0, 4000) });
      }
    });

    if (imgs.length) return callGroq(messages, { apiKey, model: VISION_MODEL, maxTokens: 2048, temperature: 0.3 });
    try {
      return await callGroq(messages, { apiKey, model, maxTokens: 1500, temperature: 0.6 });
    } catch (e) {
      // Na záložní model přepínáme jen u chyb modelu — u klíče/limitu nemá smysl.
      // Rozhoduje jazykově nezávislý kód, NE text hlášky (ta je přeložená).
      if (e instanceof AIError && (e.code === 'no-key' || e.code === 'bad-key' || e.code === 'rate-limit')) throw e;
      return await callGroq(messages, { apiKey, model: 'llama-3.3-70b-versatile', maxTokens: 1024, temperature: 0.6 });
    }
  },

  async generateFlashcards(source, count, apiKey, model, focus): Promise<GeneratedCard[]> {
    const want = (focus || '').trim();
    const system = `Jsi nástroj, který tvoří studijní kartičky. Vrať POUZE validní JSON pole.
Každý prvek: {"front": "otázka nebo pojem", "back": "stručná, přesná odpověď"}.
Žádný další text, žádné markdown bloky.
DŮLEŽITÉ: Otázky i odpovědi piš VŽDY v jazyce podle instrukce níže, i když materiál obsahuje slova v jiném jazyce. Cizí termíny můžeš v závorce zachovat, ale věty piš v cílovém jazyce.

NEŽ ODPOVÍŠ, projdi si vlastní kartičky a oprav je:
- odpověď musí být věcně správná a opřená o materiál; co v materiálu není, netvrď
- žádné vágní ani zavádějící formulace, žádné překlepy měnící význam
- otázka se musí dát zodpovědět bez znalosti ostatních kartiček
- žádné dvě kartičky se neptají na totéž
Vrať až prověřenou verzi. Radši vrať méně kartiček než nepřesné.${langInstr()}`;
    // Zadání uživatele má přednost před tím, co by si AI vybrala sama.
    const focusBlock = want
      ? `\n\nUživatel se potřebuje naučit PŘESNĚ TOTO:\n"""${want.slice(0, 800)}"""\nDrž se toho. Vynech z materiálu vše, co s tím nesouvisí, i kdyby to bylo zajímavé. Pokud materiál k některé části zadání nic neobsahuje, kartičku k ní netvoř.`
      : '';
    const user = `Vytvoř ${count} kartiček pro učení z následujícího materiálu/tématu. Otázky ať jsou různorodé a testují pochopení, ne jen memorování.${focusBlock}\n\n"""${source.slice(0, 6000)}"""`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { apiKey, model, maxTokens: 2000, temperature: 0.5 }
    );
    const data = extractJson(raw);
    if (!Array.isArray(data)) throw new AIError(tr('ai.err.noCards'), 'bad-output');
    return data.filter((c: any) => c && c.front && c.back)
      .map((c: any) => ({ front: String(c.front).trim(), back: String(c.back).trim() }));
  },

  async generateQuiz(source, count, apiKey, model): Promise<GeneratedQuiz[]> {
    const system = `Jsi nástroj, který tvoří kvízy s výběrem odpovědí. Vrať POUZE validní JSON pole.
Každý prvek: {"question": "...", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "proč je to správně"}.
Přesně 4 možnosti. answerIndex je 0-3. Žádný další text.
DŮLEŽITÉ: Otázky, možnosti i vysvětlení piš VŽDY v jazyce podle instrukce níže, i když materiál obsahuje slova v jiném jazyce.${langInstr()}`;
    const user = `Vytvoř ${count} kvízových otázek z tohoto materiálu/tématu:\n\n"""${source.slice(0, 6000)}"""`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { apiKey, model, maxTokens: 2500, temperature: 0.5 }
    );
    const data = extractJson(raw);
    if (!Array.isArray(data)) throw new AIError(tr('ai.err.noQuiz'), 'bad-output');
    return data.filter((q: any) => q && q.question && Array.isArray(q.options) && q.options.length >= 2)
      .map((q: any) => ({
        question: String(q.question).trim(),
        options: q.options.slice(0, 4).map((o: any) => String(o)),
        answerIndex: Math.max(0, Math.min(3, Number(q.answerIndex) || 0)),
        explanation: String(q.explanation || '').trim(),
      }));
  },

  async summarizeToNotes(source, apiKey, model) {
    const system = `Jsi nástroj na tvorbu přehledných studijních poznámek. Vytvoř strukturované shrnutí jako ČISTÝ TEXT:
- používej krátké odstavce a odrážky uvozené pomlčkou "- "
- klíčové pojmy uveď na začátku řádku (např. "Pojem: vysvětlení"), NE formátováním
- stručné, přehledné, k zapamatování.
ZÁKAZ FORMÁTOVÁNÍ: NIKDY nepoužívej Markdown — žádné hvězdičky (** ani *), žádné mřížky (#) a žádné zpětné apostrofy. Piš obyčejný text.${langInstr()}`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: `Shrň do studijních poznámek:\n\n"""${source.slice(0, 6000)}"""` }],
      { apiKey, model, maxTokens: 1500, temperature: 0.4 }
    );
    return stripMarkdown(raw);
  },

  async extractTextFromImage(base64DataUrl, apiKey) {
    // Instrukce je anglicky — model na ni odpovídá spolehlivěji než na češtinu.
    // Jazyk se tu ZÁMĚRNĚ nevnucuje: přepis musí zachovat jazyk předlohy.
    const messages: WireMessage[] = [
      {
        role: 'system',
        content: `You are an OCR engine, not an assistant. Output ONLY the transcribed text.

Rules:
- Transcribe every piece of text in the image, top to bottom, left to right.
- Keep the original language. Never translate.
- Preserve structure: headings on their own line, bullets as "- ", numbered lists as "1. ".
- NEVER write commentary, greetings, or remarks about the image or your process.
- Never write phrases like "Okay", "I see", "The text reads", "Here is", "I'm having trouble".
- If part of the image is unreadable, write [?] in that spot and continue with the rest.
- If the image contains no text at all, output exactly: NO_TEXT`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe this page.' },
          { type: 'image_url', image_url: { url: base64DataUrl } },
        ],
      },
    ];
    const raw = await callGroq(messages, { apiKey, model: VISION_MODEL, maxTokens: 4000, temperature: 0 });
    return cleanOcr(raw);
  },

  async planStudySession(availableMinutes, goal, context, apiKey, model): Promise<PlanItem[]> {
    const system = `Jsi studijní kouč. Naplánuj realistický studijní blok jako JSON pole úkolů.
Každý prvek: {"task": "konkrétní krok", "minutes": číslo}. Součet minut ať nepřekročí dostupný čas.
Zahrň pauzy a opakování. Vrať POUZE JSON pole, žádný další text.
Texty úkolů ("task") piš v jazyce podle instrukce níže.${langInstr()}`;
    const user = `Mám ${availableMinutes} minut. Cíl: ${goal}. ${context ? 'Kontext: ' + context : ''}`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { apiKey, model, maxTokens: 1200, temperature: 0.5 }
    );
    const data = extractJson(raw);
    if (!Array.isArray(data)) throw new AIError(tr('ai.err.noPlan'), 'bad-output');
    return data.filter((p: any) => p && p.task)
      .map((p: any) => ({ task: String(p.task).trim(), minutes: Math.max(1, Number(p.minutes) || 10) }));
  },

  async explainCard(front, back, style, apiKey, model) {
    const styles: Record<string, string> = {
      analogy: 'pomocí PŘIROVNÁNÍ z běžného života (jídlo, sport, škola, rodina)',
      story: 'jako KRÁTKÝ PŘÍBĚH nebo scénku, která se dobře pamatuje',
      mnemonic: 'pomocí MNEMOTECHNICKÉ POMŮCKY (rýmovačka, zkratka, slovní hříčka v cílovém jazyce)',
      simple: 'MAXIMÁLNĚ JEDNODUŠE, jako bys to vysvětloval desetiletému dítěti',
    };
    const system = `Jsi trpělivý učitel. Student nechápe jednu kartičku — vysvětli mu ji ${styles[style] || styles.simple}.
Piš ČISTÝ TEXT bez Markdownu (žádné hvězdičky ani mřížky). Max 5 vět.${langInstr()}`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: `Otázka: ${front}\nOdpověď: ${back}` }],
      { apiKey, model, maxTokens: 400, temperature: 0.7 }
    );
    return stripMarkdown(raw);
  },

  async checkDeck(cards, apiKey, model) {
    const list = cards.map((c, i) => `${i}. ${c.front} → ${c.back}`).join('\n');
    const system = `Jsi přísný korektor studijních kartiček. Projdi kartičky a najdi PROBLÉMY:
- věcně špatná nebo nepřesná odpověď
- zavádějící / příliš vágní formulace
- překlepy měnící význam
Vrať POUZE JSON pole. Každý problém: {"index": číslo kartičky, "problem": "co je špatně (1 věta)", "fix": "opravená zadní strana" nebo null}.
Kartičky, které jsou v pořádku, do výstupu NEDÁVEJ. Když je vše správně, vrať [].
Texty "problem" a "fix" piš v jazyce podle instrukce níže.${langInstr()}`;
    const raw = await callGroq(
      [{ role: 'system', content: system }, { role: 'user', content: list.slice(0, 6000) }],
      { apiKey, model, maxTokens: 1500, temperature: 0.2 }
    );
    const data = extractJson(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((x: any) => x && typeof x.index === 'number' && x.index >= 0 && x.index < cards.length && x.problem)
      .map((x: any) => ({ index: x.index, problem: String(x.problem), fix: x.fix ? String(x.fix) : null }));
  },
};
