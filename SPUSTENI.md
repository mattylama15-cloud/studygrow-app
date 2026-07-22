# StudyGrow — jak appku spustit na telefonu 📱

StudyGrow je studijní aplikace (React Native + Expo), která kombinuje:
- 🌳 **Focus časovač** s pěstováním zahrady (jako Forest)
- ✨ **AI lektor** – vysvětlí ti látku (jako Astra / Knowunity)
- 🃏 **Kartičky s chytrým opakováním** (spaced repetition) + kvízy
- 📝 **Poznámky**, ze kterých AI vytvoří kartičky, kvíz nebo shrnutí
- 🔥 Série, levely, XP a odznaky pro motivaci

## Spuštění na mobilu (Expo Go)

1. V telefonu měj nainstalované **Expo Go** (máš ✅) a buď na **stejné Wi-Fi** jako počítač.
2. Na počítači otevři terminál ve složce `StudyGrow` a spusť:
   ```
   npx expo start
   ```
3. V terminálu se zobrazí **QR kód**.
   - **iPhone:** otevři appku **Fotoaparát**, namiř na QR kód a klepni na žlutý proužek → otevře se v Expo Go.
   - **Android:** otevři **Expo Go → Scan QR code** a naskenuj kód.
4. Chvíli počkej (poprvé se „balí" JavaScript ~10–20 s) a appka naběhne. 🎉

### Když se telefon nepřipojí (firewall / jiná síť)
Spusť to přes tunel (funguje i na mobilních datech):
```
npx expo start --tunnel
```

## Odemknutí AI funkcí (lektor, generování kartiček)
AI běží na Claude API od Anthropic. V appce jdi do **Profil → Nastavení → Anthropic API klíč** a vlož svůj klíč (`sk-ant-…`).
Klíč získáš na https://console.anthropic.com/settings/keys (je placený podle spotřeby).
Bez klíče funguje všechno ostatní (focus, kartičky, kvízy z balíčků, poznámky).

## Užitečné příkazy
- `npx expo start` – spustí dev server (QR kód)
- stiskni `r` v terminálu – reload appky
- stiskni `j` – otevře debugger

## Co dál (vydání na App Store)
Pro reálné vydání je potřeba:
1. Účet Apple Developer (99 $/rok).
2. Build přes EAS: `npm i -g eas-cli`, `eas build -p ios`.
3. **Důležité (bezpečnost):** AI klíč nesmí být v appce u uživatelů. Před vydáním nasaď
   malý backend proxy (serverless funkce), který volá Anthropic API, a appka bude volat ten.
   Detaily jsou popsané v `src/ai/client.ts`.
