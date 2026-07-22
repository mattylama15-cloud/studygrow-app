# StudyGrow — přehled projektu

## Co to je

Studijní aplikace pro kohokoli, kdo se učí. React Native / Expo.

**Cíl č. 1:** dostat hotovou appku do App Store a Google Play.
Má přednost před penězi i před technickou dokonalostí.

## Platformy

- **Web (PWA)** — https://mattylama15-cloud.github.io/studygrow/ — testovací prostředí
- **Nativní appka** — hlavní cíl, zatím nepostavená

Při konfliktu vyhrává nativ, ale web nesmí spadnout.

## Technické základy

| Věc | Hodnota |
|---|---|
| Expo SDK | **54** (pinned — Expo Go uživatele podporuje jen tuhle verzi) |
| React Native | 0.81.5 |
| React | 19.1.0 |
| Úložiště | AsyncStorage (na webu = localStorage) |
| Klíč stavu | `studygrow:state:v2` |

**Důležité:** Nikdy nebumpovat SDK bez aktualizace Expo Go.
Balíčky instalovat přes `npx expo install <pkg>`, ne přes raw npm — jinak se rozbijí verze.

## Hlavní funkce appky

- **Kartičky (SRS)** — spaced repetition, balíčky, opakování
- **Focus** — studijní bloky s časovačem, rostlinky/stavby co rostou
- **Poznámky** — psaní, AI shrnutí, OCR z fotek
- **Testy/kvízy** — z textu, poznámek nebo balíčků
- **AI Lektor** — chat s přístupem ke všem datům uživatele (RAG)
- **Opakování chyb** — analýza slabin, chyby z kvízů → kartičky
- **Kalendář** — zkoušky s odpočtem, úkoly
- **Společné studium** — classroomy s kódem, sdílení obsahu, chat
