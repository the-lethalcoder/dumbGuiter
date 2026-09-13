import {
  ChordToken,
  RestToken,
  RepeatToken,
  SectionHeaderToken,
  ParsedSongToken,
  SongAST,
  SongSection,
  LyricLine,
  LyricLineSegment,
  NoteName
} from '@/types/music';
import { getPitchClass, QUALITY_INTERVALS, EXTENSION_INTERVALS } from './theory';

let idCounter = 0;
function uniqueId(prefix: string = 'token'): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

// Regex components
const ROOT_REGEX = /^([A-Ga-g][#b♯♭]?)/;
const QUALITY_REGEX = /^(maj|major|M|m|min|minor|-|dim|o|°|aug|\+|sus2|sus4|sus|5)/i;
const EXTENSION_REGEX = /^(maj7|M7|Δ7|m7|dim7|m7b5|9|maj9|M9|m9|11|maj11|m11|13|maj13|m13|add9|add2|add11|add4|add6|6\/9|69|6|7)/i;
const REST_REGEX = /^(N\.?C\.?|NC|SILENCE|REST)(\*)?(\((\d+(\.\d+)?)\))?$/i;
const REPEAT_BAR_REGEX = /^(%|repeat)(\((\d+(\.\d+)?)\))?$/i;
const REPEAT_COUNT_REGEX = /^[xX](\d+)$/;
const SECTION_HEADER_REGEX = /^\[([^\]]+)\]$|^\{([^}]+)\}$/;

/**
 * Checks if a token strictly looks like a valid chord/rest/repeat control token.
 */
export function isStrictChordToken(tokenStr: string): boolean {
  const clean = tokenStr.trim();
  if (!clean) return false;
  if (REST_REGEX.test(clean)) return true;
  if (REPEAT_BAR_REGEX.test(clean)) return true;
  if (REPEAT_COUNT_REGEX.test(clean)) return true;

  // Check chord grammar
  const parsed = parseChordToken(clean, 0);
  if (parsed.type === 'chord') {
    return parsed.isValid;
  }
  return true;
}

/**
 * Parses a single token string into a ChordToken or RestToken.
 */
export function parseChordToken(rawToken: string, columnOffset: number = 0): ChordToken | RestToken | RepeatToken {
  const raw = rawToken.trim();

  // 1. Rest / N.C.
  const restMatch = raw.match(REST_REGEX);
  if (restMatch) {
    const isOneShot = Boolean(restMatch[2]);
    const duration = restMatch[4] ? parseFloat(restMatch[4]) : 4;
    return {
      type: 'rest',
      id: uniqueId('rest'),
      raw,
      durationBeats: isNaN(duration) ? 4 : duration,
      articulation: isOneShot ? 'one_shot' : 'strum_pattern',
      columnOffset
    };
  }

  // 2. Bar Repeat (%)
  const repeatBarMatch = raw.match(REPEAT_BAR_REGEX);
  if (repeatBarMatch) {
    const duration = repeatBarMatch[3] ? parseFloat(repeatBarMatch[3]) : 4;
    return {
      type: 'repeat',
      id: uniqueId('repeat'),
      raw,
      repeatCount: 1,
      scope: 'previous_chord'
    };
  }

  // 3. Count Multiplier (x2, x4)
  const countMatch = raw.match(REPEAT_COUNT_REGEX);
  if (countMatch) {
    const count = parseInt(countMatch[1], 10);
    return {
      type: 'repeat',
      id: uniqueId('repeat'),
      raw,
      repeatCount: isNaN(count) ? 2 : count,
      scope: 'line'
    };
  }

  // 4. Parse Chord Token
  let remaining = raw;
  let durationBeats = 4; // Default 4 beats
  let isOneShot = false;

  // Extract duration annotation e.g. (2) or (1.5) or /2
  const durationMatch = remaining.match(/\((\d+(\.\d+)?)\)$|\/(\d+(\.\d+)?)$/);
  if (durationMatch) {
    const durStr = durationMatch[1] || durationMatch[3];
    durationBeats = parseFloat(durStr);
    if (isNaN(durationBeats)) durationBeats = 4;
    remaining = remaining.slice(0, durationMatch.index);
  }

  // Extract one-shot articulation e.g. * at end
  if (remaining.endsWith('*')) {
    isOneShot = true;
    remaining = remaining.slice(0, -1);
  }

  // Extract Slash Bass e.g. /F# or /C
  let bassNote: NoteName | undefined = undefined;
  let bassPitchClass: number | undefined = undefined;
  const slashIndex = remaining.lastIndexOf('/');
  if (slashIndex > 0) {
    const bassPart = remaining.slice(slashIndex + 1);
    const bassMatch = bassPart.match(ROOT_REGEX);
    if (bassMatch) {
      bassNote = (bassMatch[1].charAt(0).toUpperCase() + bassMatch[1].slice(1)) as NoteName;
      bassPitchClass = getPitchClass(bassNote);
      remaining = remaining.slice(0, slashIndex);
    }
  }

  // Extract Root Note
  const rootMatch = remaining.match(ROOT_REGEX);
  if (!rootMatch) {
    return {
      type: 'chord',
      id: uniqueId('err'),
      raw,
      root: 'C',
      rootPitchClass: 0,
      quality: '',
      extensions: [],
      alterations: [],
      intervals: [0, 4, 7],
      pitchClasses: [0, 4, 7],
      durationBeats,
      articulation: isOneShot ? 'one_shot' : 'strum_pattern',
      columnOffset,
      isValid: false,
      errorMessage: `Unrecognized chord root in "${raw}"`
    };
  }

  const rootStr = (rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1)) as NoteName;
  const rootPitchClass = getPitchClass(rootStr);
  remaining = remaining.slice(rootMatch[0].length);

  // Extract Quality & Extensions & Alterations
  let quality = '';
  const extensions: number[] = [];
  const alterations: string[] = [];
  const intervalsSet = new Set<number>([0]); // Root is always interval 0

  // Check Quality
  const qualityMatch = remaining.match(QUALITY_REGEX);
  if (qualityMatch) {
    quality = qualityMatch[0].toLowerCase();
    remaining = remaining.slice(qualityMatch[0].length);
  }

  // Map base triad intervals
  const baseIntervals = QUALITY_INTERVALS[quality] || [0, 4, 7];
  baseIntervals.forEach(i => intervalsSet.add(i));

  // Check Extensions
  const extMatch = remaining.match(EXTENSION_REGEX);
  if (extMatch) {
    const extStr = extMatch[0].toLowerCase();
    remaining = remaining.slice(extMatch[0].length);

    if (extStr.includes('7') || extStr === '9' || extStr === '11' || extStr === '13') {
      // 7th present
      if (extStr.includes('maj7') || extStr.includes('m7b5')) {
        // handled specifically
      }
    }

    const extIntervals = EXTENSION_INTERVALS[extStr] || [];
    extIntervals.forEach(i => {
      intervalsSet.add(i % 12);
      extensions.push(i);
    });

    if (extStr.includes('m7b5')) {
      intervalsSet.delete(7); // Remove perfect 5th
      intervalsSet.add(6);    // Add flat 5th
      intervalsSet.add(10);   // Add minor 7th
      alterations.push('b5');
    }
  }

  // Parse Alterations (e.g. b5, #9, #11, b13)
  const altRegex = /(\(?[#b♯♭\+-](?:5|9|11|13)\)?)/gi;
  let altMatch: RegExpExecArray | null;
  while ((altMatch = altRegex.exec(remaining)) !== null) {
    const alt = altMatch[1].replace(/[()]/g, '');
    alterations.push(alt);
    if (alt.includes('b5') || alt.includes('-5')) {
      intervalsSet.delete(7);
      intervalsSet.add(6);
    } else if (alt.includes('#5') || alt.includes('+5')) {
      intervalsSet.delete(7);
      intervalsSet.add(8);
    } else if (alt.includes('b9')) {
      intervalsSet.add(1);
    } else if (alt.includes('#9')) {
      intervalsSet.add(3);
    } else if (alt.includes('#11')) {
      intervalsSet.add(6);
    } else if (alt.includes('b13')) {
      intervalsSet.add(8);
    }
  }

  // Clean trailing unparsed characters (if any illegal leftovers remain)
  const cleanedRemainder = remaining.replace(altRegex, '').trim();
  const isValid = cleanedRemainder.length === 0;

  // Calculate absolute pitch classes from intervals
  const intervals = Array.from(intervalsSet).sort((a, b) => a - b);
  const pitchClasses = intervals.map(interval => (rootPitchClass + interval) % 12);

  return {
    type: 'chord',
    id: uniqueId('chord'),
    raw,
    root: rootStr,
    rootPitchClass,
    quality,
    extensions,
    alterations,
    intervals,
    pitchClasses,
    bassNote,
    bassPitchClass,
    durationBeats,
    articulation: isOneShot ? 'one_shot' : 'strum_pattern',
    columnOffset,
    isValid,
    errorMessage: isValid ? undefined : `Unknown modifier "${cleanedRemainder}" in chord "${raw}"`
  };
}

/**
 * Main parser entry: parses arbitrary text into a structured SongAST.
 */
export function parseSongInput(rawText: string): SongAST {
  const lines = rawText.split('\n');
  const sections: SongSection[] = [];
  let currentSection: SongSection = {
    id: uniqueId('section'),
    name: 'Main',
    events: [],
    lyrics: []
  };

  const sectionRegistry = new Map<string, (ChordToken | RestToken)[]>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Check for Section Header (e.g. [Verse 1], [Chorus])
    const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
    if (sectionMatch) {
      const sectionName = sectionMatch[1] || sectionMatch[2];

      // Save previous section if it has events
      if (currentSection.events.length > 0 || (currentSection.lyrics && currentSection.lyrics.length > 0)) {
        sections.push(currentSection);
        sectionRegistry.set(currentSection.name.toLowerCase(), [...currentSection.events]);
      }

      currentSection = {
        id: uniqueId('sec'),
        name: sectionName,
        events: [],
        lyrics: []
      };

      // Check if this section is standalone and has prior definition
      const existing = sectionRegistry.get(sectionName.toLowerCase());
      if (existing && existing.length > 0) {
        // Peek next line: if next line is another section or empty, copy previous section chords
        const nextLine = lines[i + 1]?.trim();
        if (!nextLine || SECTION_HEADER_REGEX.test(nextLine)) {
          currentSection.events = existing.map(e => ({ ...e, id: uniqueId('inherited') }));
        }
      }

      i++;
      continue;
    }

    // 2. Check for Inline Bracket / ChordPro format e.g. [G]Wise men [Em]say
    if (line.includes('[') && line.includes(']')) {
      const parsedChordPro = parseChordProLine(line);
      if (parsedChordPro.events.length > 0) {
        currentSection.events.push(...parsedChordPro.events);
        if (currentSection.lyrics) {
          currentSection.lyrics.push(parsedChordPro.lyricLine);
        }
        i++;
        continue;
      }
    }

    // 3. Line Classification
    const tokens = line.split(/\s+/).filter(t => t.length > 0);
    const allTokensValidChords = tokens.length > 0 && tokens.every(isStrictChordToken);

    if (allTokensValidChords) {
      // It's a Chord Line
      const chordEventsOnLine: (ChordToken | RestToken)[] = [];
      let lastIndex = 0;

      tokens.forEach(tok => {
        const col = line.indexOf(tok, lastIndex);
        lastIndex = col + tok.length;
        const parsed = parseChordToken(tok, col);

        if (parsed.type === 'repeat') {
          // Handle repeat token
          if (parsed.scope === 'previous_chord' && currentSection.events.length > 0) {
            const lastChord = currentSection.events[currentSection.events.length - 1];
            chordEventsOnLine.push({ ...lastChord, id: uniqueId('rpt') });
          }
        } else {
          chordEventsOnLine.push(parsed);
        }
      });

      // Check if next line is a lyric line to anchor chords over lyrics
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.trim().match(SECTION_HEADER_REGEX) && !nextLine.split(/\s+/).filter(t => t.length > 0).every(isStrictChordToken)) {
        // Interleaved pair
        const lyricSegments = anchorChordsToLyrics(chordEventsOnLine, line, nextLine);
        if (currentSection.lyrics) {
          currentSection.lyrics.push({
            segments: lyricSegments,
            rawChordsLine: line,
            rawLyricsLine: nextLine
          });
        }
        currentSection.events.push(...chordEventsOnLine);
        i += 2; // Consumed both chord line and lyric line
        continue;
      } else {
        // Standalone chord line
        currentSection.events.push(...chordEventsOnLine);
        if (currentSection.lyrics) {
          currentSection.lyrics.push({
            segments: chordEventsOnLine.map(c => ({ text: '', chord: c })),
            rawChordsLine: line
          });
        }
        i++;
        continue;
      }
    } else {
      // Plain lyric line without chords
      if (currentSection.lyrics) {
        currentSection.lyrics.push({
          segments: [{ text: line }],
          rawLyricsLine: line
        });
      }
      i++;
    }
  }

  // Push final section
  if (currentSection.events.length > 0 || (currentSection.lyrics && currentSection.lyrics.length > 0)) {
    sections.push(currentSection);
  }

  // If completely empty, return default starter progression
  if (sections.length === 0 || sections.every(s => s.events.length === 0)) {
    sections.push({
      id: uniqueId('starter'),
      name: 'Verse 1',
      events: [
        parseChordToken('C(4)') as ChordToken,
        parseChordToken('G(4)') as ChordToken,
        parseChordToken('Am(4)') as ChordToken,
        parseChordToken('F(4)') as ChordToken,
      ]
    });
  }

  return {
    sections,
    rawInput: rawText
  };
}

/**
 * Parses inline [Chord] lyrics lines.
 */
function parseChordProLine(line: string): { events: (ChordToken | RestToken)[]; lyricLine: LyricLine } {
  const events: (ChordToken | RestToken)[] = [];
  const segments: LyricLineSegment[] = [];

  const bracketRegex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(line)) !== null) {
    const chordStr = match[1];
    const textBefore = line.slice(lastIndex, match.index);
    const parsed = parseChordToken(chordStr, match.index);

    if (parsed.type === 'chord' || parsed.type === 'rest') {
      events.push(parsed);
      segments.push({
        text: textBefore,
        chord: parsed
      });
    } else {
      segments.push({ text: textBefore });
    }

    lastIndex = match.index + match[0].length;
  }

  const trailingText = line.slice(lastIndex);
  if (trailingText) {
    segments.push({ text: trailingText });
  }

  return {
    events,
    lyricLine: {
      segments,
      rawLyricsLine: line
    }
  };
}

/**
 * Anchors column-positioned chords to the corresponding syllables in the lyric line below.
 */
function anchorChordsToLyrics(
  chords: (ChordToken | RestToken)[],
  chordLine: string,
  lyricLine: string
): LyricLineSegment[] {
  const segments: LyricLineSegment[] = [];
  const sortedChords = [...chords].sort((a, b) => (a.columnOffset ?? 0) - (b.columnOffset ?? 0));

  let currentLyricIndex = 0;

  for (let i = 0; i < sortedChords.length; i++) {
    const chord = sortedChords[i];
    const chordCol = chord.columnOffset ?? 0;
    const nextChordCol = sortedChords[i + 1]?.columnOffset ?? lyricLine.length;

    const start = Math.min(chordCol, lyricLine.length);
    const end = Math.min(nextChordCol, lyricLine.length);

    if (start > currentLyricIndex) {
      segments.push({
        text: lyricLine.slice(currentLyricIndex, start)
      });
    }

    const syllableText = lyricLine.slice(start, Math.max(start, end));
    segments.push({
      text: syllableText || ' ',
      chord
    });

    currentLyricIndex = Math.max(start, end);
  }

  if (currentLyricIndex < lyricLine.length) {
    segments.push({
      text: lyricLine.slice(currentLyricIndex)
    });
  }

  return segments;
}
