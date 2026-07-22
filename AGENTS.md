# Expo SDK 54

This project is pinned to **Expo SDK 54** (expo 54.0.35, react-native 0.81.5, react 19.1.0)
because the user's Expo Go app supports SDK 54. Do NOT bump the SDK unless their Expo Go is updated.

Use `npx expo install <pkg>` (not raw npm) so dependency versions stay SDK-54 compatible.
Docs: https://docs.expo.dev/versions/v54.0.0/

# Jazyky — POVINNÉ u každé nové funkce

Aplikace je vícejazyčná. **Angličtina je výchozí jazyk**, dále čeština a němčina.
Španělština je připravená, ale zatím nemá překlad (spadá na angličtinu).

**Nikdy nepiš text pro uživatele natvrdo do kódu.** Ani dočasně, ani "jen na zkoušku".
Přepínač jazyka o takovém textu neví a zůstane v původním jazyce.

Postup u každé nové funkce nebo obrazovky:

1. Texty piš rovnou jako klíče — `t('deck.newCard')`, ne `"New card"`.
2. Klíč přidej do VŠECH slovníků v `src/i18n.ts`: `cs`, `en`, `de`.
   Zdrojem je angličtina, z ní se překládá do češtiny a němčiny.
3. Slovníky musí mít vždy shodný počet klíčů. Ověř:
   ```
   node -e "const s=require('fs').readFileSync('src/i18n.ts','utf8');const k=x=>new Set([...x.matchAll(/^  '([^']+)':/gm)].map(m=>m[1]));const c=(a,b)=>k(s.slice(s.indexOf(a),s.indexOf(b)));console.log(c('const cs: Dict','const en: Dict').size, c('const en: Dict','const de: Dict').size, c('const de: Dict','const DICTS').size)"
   ```
4. Zástupné symboly (`{n}`, `{name}`) musí zůstat stejné ve všech jazycích —
   jinak se v appce vypíše nesmysl.
5. Čeština má tři tvary množného čísla (1 / 2–4 / 5+), angličtina a němčina dva.
   Kde na tom kód větví, udělej samostatné klíče (vzor: `calendar.inDays1/2/5`).

Mimo React (soubory `.ts` bez komponent) použij `translate(lang, 'klic')`;
hook `useT()` tam nefunguje.

**AI musí odpovídat v jazyce appky.** Každý system prompt potřebuje
`aiLangInstruction(getAiLang())` — vzor v `src/ai/groq.ts`. Výjimka je čtení
textu z fotky: tam se jazyk nevnucuje, přepis má zachovat jazyk předlohy.

Data zakládaná appkou (názvy balíčků, předměty) se ukládají v jazyce platném
při vzniku. Při zobrazení je přelož, ale filtruj podle uložené hodnoty —
vzor `showSubject()` v `src/screens/DecksScreen.tsx`.
