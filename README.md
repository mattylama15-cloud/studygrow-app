# StudyGrow

A study app for students: spaced-repetition flashcards, focus sessions, and an
AI tutor that works from your own notes.

**Live PWA:** https://mattylama15-cloud.github.io/studygrow/

## Why

Most study apps put AI behind a subscription students can't afford, or send
everything to a server. StudyGrow is built the other way round: the long-term
goal is on-device AI (Llama 3B + OCR, ~1.5–2 GB) so the app works offline, with
no API keys and no cost to the student. Groq is a temporary bridge for the web
version while the native app is being built.

## What it does

- **Flashcards** with spaced repetition — photograph a page of your notes, tell
  the AI what you actually need to learn from it, and it builds the cards around
  that instead of guessing what's important.
- **Focus sessions** — a timer that grows a small illustration as you work,
  pausable, with a daily goal.
- **AI tutor** — answers questions using your own decks, notes and upcoming exams
  as context, in whichever language the app is set to.
- **Quizzes**, a calendar for exams, a coach that resurfaces the cards you keep
  getting wrong, and shared study rooms.

Fully bilingual in four languages: English (default), Czech, German, Spanish —
including AI replies, date formats and text-to-speech.

## Running it

Requires Node and the Expo CLI. The project is pinned to **Expo SDK 54**.

```bash
npm install
npx expo start --web     # web
npx expo start           # then scan the QR code with Expo Go
```

The AI features need a free [Groq](https://console.groq.com) API key, entered in
the app under Settings. The key is stored on the device only and is never sent
anywhere except to Groq.

Deploy the web build to GitHub Pages with:

```bash
node scripts/deploy-web.mjs
```

## Layout

```
src/
  screens/      one file per screen
  components/   shared UI, growth illustrations, progress ring
  state/        app state (AsyncStorage) and the focus timer
  ai/           provider interface + Groq and on-device Llama backends
  i18n.ts       all four dictionaries
  srs.ts        spaced-repetition scheduling
```

`AGENTS.md` holds the project conventions — most importantly that user-facing
text is never hardcoded, it goes into all four dictionaries.

## Status

Early. Built solo by a student; the app runs as a PWA today, with the native
iOS/Android build and on-device AI as the next milestones.

## License

MIT — see [LICENSE](LICENSE).
