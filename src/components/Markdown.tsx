import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { colors, font, radius } from '../theme';

// Renders a useful subset of Markdown nicely (headings, **bold**, *italic*, `code`,
// - bullets, 1. numbered, > quotes, --- rules, [links](url), tables). Keeps the chat
// clean — no raw asterisks, no raw <br>, clickable links.

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

// bold / italic / code / links — links are clickable.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Order matters: markdown links, autolinks <url>, bare urls, then emphasis/code.
  const regex =
    /(\[[^\]]+\]\([^)]+\)|<https?:\/\/[^>\s]+>|https?:\/\/[^\s)]+|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(<Text key={key++}>{text.slice(last, m.index)}</Text>);
    const tok = m[0];
    if (tok.startsWith('[')) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) {
        const url = mm[2].trim();
        out.push(<Text key={key++} style={styles.link} onPress={() => openUrl(url)}>{mm[1]}</Text>);
      } else out.push(<Text key={key++}>{tok}</Text>);
    } else if (tok.startsWith('<http')) {
      const url = tok.slice(1, -1);
      out.push(<Text key={key++} style={styles.link} onPress={() => openUrl(url)}>{url}</Text>);
    } else if (tok.startsWith('http')) {
      out.push(<Text key={key++} style={styles.link} onPress={() => openUrl(tok)}>{tok}</Text>);
    } else if (tok.startsWith('**')) {
      out.push(<Text key={key++} style={styles.bold}>{tok.slice(2, -2)}</Text>);
    } else if (tok.startsWith('`')) {
      out.push(<Text key={key++} style={styles.code}>{tok.slice(1, -1)}</Text>);
    } else {
      out.push(<Text key={key++} style={styles.italic}>{tok.slice(1, -1)}</Text>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Text key={key++}>{text.slice(last)}</Text>);
  return out;
}

export function Markdown({ text }: { text: string }) {
  // Normalize: drop \r, turn HTML <br> into real line breaks, strip stray closing tags.
  const normalized = text
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|span)>/gi, '');
  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `l${idx}`;
    const t = line.trim();

    if (t === '') { blocks.push(<View key={key} style={{ height: 7 }} />); return; }
    if (/^(---|\*\*\*|___)$/.test(t)) { blocks.push(<View key={key} style={styles.hr} />); return; }

    // Markdown table row: starts with "|" (closing "|" optional — many AIs forget it).
    // Renders as a clean bullet so the note never shows pipes.
    if (/^\|/.test(t)) {
      const inner = t.replace(/^\|/, '').replace(/\|$/, '');
      const cells = inner.split('|').map((c) => c.trim());
      // Skip separator rows like |---|:--:|.
      if (cells.every((c) => c === '' || /^:?-{2,}:?$/.test(c))) return;
      const nonEmpty = cells.filter((c) => c !== '');
      if (nonEmpty.length === 0) return;
      blocks.push(
        <View key={key} style={styles.row}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.itemText}>
            {nonEmpty.length >= 2
              ? [<Text key="h" style={styles.bold}>{nonEmpty[0]}: </Text>, ...renderInline(nonEmpty.slice(1).join(' — '))]
              : renderInline(nonEmpty.join(' '))}
          </Text>
        </View>
      );
      return;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push(<Text key={key} style={[styles.heading, h[1].length === 1 && styles.h1]}>{renderInline(h[2].replace(/\*\*/g, ''))}</Text>);
      return;
    }
    // A line that is entirely **bold** acts like a subheading.
    const boldLine = t.match(/^\*\*(.+?)\*\*:?$/);
    if (boldLine) { blocks.push(<Text key={key} style={styles.heading}>{boldLine[1]}</Text>); return; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      blocks.push(
        <View key={key} style={styles.row}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.itemText}>{renderInline(bullet[1])}</Text>
        </View>
      );
      return;
    }
    const num = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (num) {
      blocks.push(
        <View key={key} style={styles.row}>
          <Text style={styles.num}>{num[1]}.</Text>
          <Text style={styles.itemText}>{renderInline(num[2])}</Text>
        </View>
      );
      return;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      blocks.push(
        <View key={key} style={styles.quote}>
          <Text style={styles.quoteText}>{renderInline(quote[1])}</Text>
        </View>
      );
      return;
    }
    blocks.push(<Text key={key} style={styles.para}>{renderInline(line)}</Text>);
  });

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  para: { color: colors.text, fontSize: font.body, lineHeight: 23 },
  heading: { color: colors.text, fontWeight: '800', fontSize: font.body + 1, marginTop: 8, marginBottom: 2 },
  h1: { fontSize: font.h3 },
  bold: { fontWeight: '800', color: colors.text },
  italic: { fontStyle: 'italic' },
  link: { color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
  code: { fontFamily: 'monospace', backgroundColor: colors.surfaceMuted, color: colors.primary, borderRadius: 4 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 2, paddingLeft: 2 },
  dot: { color: colors.primary, fontSize: font.body, lineHeight: 23, fontWeight: '800' },
  num: { color: colors.primary, fontSize: font.body, lineHeight: 23, fontWeight: '800', minWidth: 18 },
  itemText: { flex: 1, color: colors.text, fontSize: font.body, lineHeight: 23 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 4 },
  quoteText: { color: colors.textMuted, fontSize: font.body, lineHeight: 23, fontStyle: 'italic' },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
});
