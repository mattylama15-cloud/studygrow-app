// Focus timer state, lifted OUT of FocusScreen so it survives tab switches.
// Lives in a tiny context provided high up in <App>. Persisted to AsyncStorage too
// so the timer keeps running even if the app reloads (e.g. PWA tab refresh).

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'studygrow:focusTimer:v1';

export type FocusTimerState = {
  running: boolean;
  // Wall-clock end time in ms epoch. We always derive `remaining` from this so the
  // timer is accurate even after the JS engine sleeps (mobile background, tab inactive).
  endsAt: number | null;
  minutes: number; // planned total
  /** Sekundy zbývající v okamžiku pauzy. Null = neběží pauza. */
  pausedLeft: number | null;
};

type Ctx = {
  state: FocusTimerState;
  remaining: number; // seconds, clamped at 0
  /** Start a fresh timer for `minutes` and report when it finishes (true) or is given up (false). */
  start: (minutes: number, onComplete: (completed: boolean) => void) => void;
  /** Zastaví odpočet a zapamatuje si zbývající čas. Relace běží dál. */
  pause: () => void;
  /** Rozjede odpočet od zapamatovaného času. */
  resume: () => void;
  /** End early (failed). The pending onComplete (if any) is called with `false`. */
  giveUp: () => void;
  /** Cancel without firing onComplete — used after onComplete already fired. */
  reset: () => void;
};

const FocusCtx = createContext<Ctx | null>(null);

export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FocusTimerState>({ running: false, endsAt: null, minutes: 25, pausedLeft: null });
  const [remaining, setRemaining] = useState(25 * 60);
  const callbackRef = useRef<((c: boolean) => void) | null>(null);
  const firedRef = useRef(false);

  // Hydrate from disk once on mount so a refresh doesn't lose a running timer.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as FocusTimerState;
        // Pozastavená relace přežije restart — čas stojí, takže se jen obnoví.
        if (saved.running && saved.pausedLeft != null) {
          setState(saved);
          setRemaining(saved.pausedLeft);
        } else if (saved.running && saved.endsAt && saved.endsAt > Date.now()) {
          setState(saved);
          setRemaining(Math.max(0, Math.round((saved.endsAt - Date.now()) / 1000)));
        }
      } catch {}
    })();
  }, []);

  // Persist whenever state changes.
  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  // Tick: derive remaining seconds from wall clock — accurate across sleeps.
  useEffect(() => {
    // Za pauzy se netiká — zbývající čas drží `pausedLeft`.
    if (!state.running || !state.endsAt || state.pausedLeft != null) return;
    const tick = () => {
      const left = Math.round((state.endsAt! - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        if (!firedRef.current) {
          firedRef.current = true;
          callbackRef.current?.(true);
          callbackRef.current = null;
        }
        setState((s) => ({ ...s, running: false, endsAt: null }));
      } else {
        setRemaining(left);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [state.running, state.endsAt, state.pausedLeft]);

  const start = useCallback((minutes: number, onComplete: (c: boolean) => void) => {
    firedRef.current = false;
    callbackRef.current = onComplete;
    const endsAt = Date.now() + minutes * 60 * 1000;
    setState({ running: true, endsAt, minutes, pausedLeft: null });
    setRemaining(minutes * 60);
  }, []);

  // Pauza NEruší relaci — jen zastaví odpočet. `running` zůstává true, aby
  // appka dál věděla, že focus probíhá; odpočet stojí díky `pausedLeft`.
  const pause = useCallback(() => {
    setState((s) => {
      if (!s.running || s.pausedLeft != null || !s.endsAt) return s;
      const left = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
      return { ...s, endsAt: null, pausedLeft: left };
    });
  }, []);

  const resume = useCallback(() => {
    setState((s) => {
      if (!s.running || s.pausedLeft == null) return s;
      return { ...s, endsAt: Date.now() + s.pausedLeft * 1000, pausedLeft: null };
    });
  }, []);

  // Za pauzy hodiny stojí na zapamatované hodnotě.
  useEffect(() => {
    if (state.pausedLeft != null) setRemaining(state.pausedLeft);
  }, [state.pausedLeft]);

  const giveUp = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      callbackRef.current?.(false);
      callbackRef.current = null;
    }
    setState((s) => ({ ...s, running: false, endsAt: null, pausedLeft: null }));
  }, []);

  const reset = useCallback(() => {
    firedRef.current = false;
    callbackRef.current = null;
    setState((s) => ({ ...s, running: false, endsAt: null, pausedLeft: null }));
  }, []);

  return <FocusCtx.Provider value={{ state, remaining, start, pause, resume, giveUp, reset }}>{children}</FocusCtx.Provider>;
}

export function useFocusTimer(): Ctx {
  const c = useContext(FocusCtx);
  if (!c) throw new Error('useFocusTimer must be used within FocusTimerProvider');
  return c;
}
