import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';
import { useApp } from '../state/AppContext';
import type { Lang } from '../types';

// Jazykové kolečko. Vpravo nahoře je vlajka aktivního jazyka; po kliknutí se
// pod ní rozbalí zbylé jazyky. Přepne celou appku (i AI odpovídá jinak).
// Pozn.: 'de' a 'es' zatím nemají překlady — appka u nich zůstane v angličtině.

const ORDER: Lang[] = ['en', 'cs', 'de', 'es'];

const BTN = 48;   // kolečko aktivního jazyka
const OPT = 44;   // vlajky v rozbaleném panelu (44 = doporučené min. pro dotyk)
const RING = 3;   // tloušťka prstence kolem aktivní vlajky
const MENU_W = 60; // šířka rozbaleného panelu

// Vlajky kreslené jako SVG — emoji se nedá roztáhnout přes celé kolečko
// a na každé platformě vypadá jinak.
function Flag({ lang, size }: { lang: Lang; size: number }) {
  const id = `clip-${lang}-${size}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Defs>
        <ClipPath id={id}>
          <Circle cx="30" cy="30" r="30" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        {lang === 'en' && (
          // Union Jack kreslený rovnou na čtverec 60×60: diagonály vedou
          // z rohu do rohu, svislý i vodorovný pruh přes střed (30, 30).
          <>
            <Rect width="60" height="60" fill="#012169" />
            <Path d="M0 0 60 60M60 0 0 60" stroke="#fff" strokeWidth="12" />
            <Path d="M0 0 60 60M60 0 0 60" stroke="#C8102E" strokeWidth="7" />
            <Path d="M30 0v60M0 30h60" stroke="#fff" strokeWidth="20" />
            <Path d="M30 0v60M0 30h60" stroke="#C8102E" strokeWidth="12" />
          </>
        )}
        {lang === 'cs' && (
          <>
            <Rect width="60" height="30" fill="#fff" />
            <Rect y="30" width="60" height="30" fill="#D7141A" />
            <Path d="M0 0 30 30 0 60z" fill="#11457E" />
          </>
        )}
        {lang === 'de' && (
          <>
            <Rect width="60" height="20" fill="#000" />
            <Rect y="20" width="60" height="20" fill="#DD0000" />
            <Rect y="40" width="60" height="20" fill="#FFCE00" />
          </>
        )}
        {lang === 'es' && (
          <>
            <Rect width="60" height="60" fill="#AA151B" />
            <Rect y="15" width="60" height="30" fill="#F1BF00" />
          </>
        )}
      </G>
    </Svg>
  );
}

export function LangToggle({ floating }: { floating?: boolean }) {
  const { state, updateSettings } = useApp();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const btnRef = useRef<View>(null);
  const lang = (state.settings.lang ?? 'en') as Lang;
  const others = ORDER.filter((l) => l !== lang);

  // Panel se kreslí v Modalu (leží nad vším), proto si musíme změřit,
  // kde na obrazovce tlačítko je — jinak by se objevil v rohu.
  const openMenu = () => {
    btnRef.current?.measureInWindow((x, y) => {
      setAnchor({ x: x + BTN / 2, y: y + BTN });
      setOpen(true);
    });
  };

  return (
    <View style={[styles.wrap, floating && styles.floating]}>
      <Pressable
        ref={btnRef}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel="Change language"
        hitSlop={10}
        style={[styles.btn, open && styles.btnOpen]}
      >
        {/* prstenec ubírá z obou stran, vlajka musí být o 2×RING menší */}
        <Flag lang={lang} size={BTN - RING * 2} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: anchor.y + 8, left: anchor.x - MENU_W / 2 }]}>
            {others.map((l) => (
              <Pressable
                key={l}
                onPress={() => {
                  updateSettings({ lang: l });
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={l}
                hitSlop={6}
                style={styles.opt}
              >
                <Flag lang={l} size={OPT} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  floating: { position: 'absolute', top: 8, right: 16, zIndex: 50 },

  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    overflow: 'hidden',
    borderWidth: RING,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnOpen: { borderColor: colors.primary },

  // Panel leží v Modalu nad celou obrazovkou; pozice se dopočítá z měření
  // tlačítka, aby jeho střed seděl na střed vlajky.
  menu: {
    position: 'absolute',
    width: MENU_W,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: (MENU_W - OPT) / 2,
    borderRadius: MENU_W / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  opt: {
    width: OPT,
    height: OPT,
    borderRadius: OPT / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
});
