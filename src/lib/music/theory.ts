import { NoteLetter, Accidental, NoteName } from '@/types/music';

export const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1, 'C♯': 1, 'D♭': 1,
  'D': 2,
  'D#': 3, 'Eb': 3, 'D♯': 3, 'E♭': 3,
  'E': 4, 'Fb': 4, 'E♮': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6, 'F♯': 6, 'G♭': 6,
  'G': 7,
  'G#': 8, 'Ab': 8, 'G♯': 8, 'A♭': 8,
  'A': 9,
  'A#': 10, 'Bb': 10, 'A♯': 10, 'B♭': 10,
  'B': 11, 'Cb': 11,
};

export const PITCH_CLASS_TO_SHARP: NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export const PITCH_CLASS_TO_FLAT: NoteName[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
];

export function getPitchClass(note: string): number {
  const normalized = note.trim();
  const pc = NOTE_TO_PITCH_CLASS[normalized];
  if (pc !== undefined) return pc;
  // Fallback uppercase first char
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return NOTE_TO_PITCH_CLASS[capitalized] ?? 0;
}

export function midiToNoteName(midi: number, preferFlat: boolean = false): string {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi % 12;
  const note = preferFlat ? PITCH_CLASS_TO_FLAT[pc] : PITCH_CLASS_TO_SHARP[pc];
  return `${note}${octave}`;
}

export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-Ga-g][#b♯♭]?)(-?\d+)$/);
  if (!match) return 60; // Middle C
  const note = match[1];
  const octave = parseInt(match[2], 10);
  const pc = getPitchClass(note);
  return (octave + 1) * 12 + pc;
}

// Chord Quality to Intervals
export const QUALITY_INTERVALS: Record<string, number[]> = {
  'maj': [0, 4, 7],
  '': [0, 4, 7],
  'major': [0, 4, 7],
  'M': [0, 4, 7],
  'm': [0, 3, 7],
  'min': [0, 3, 7],
  'minor': [0, 3, 7],
  '-': [0, 3, 7],
  'dim': [0, 3, 6],
  'o': [0, 3, 6],
  '°': [0, 3, 6],
  'diminished': [0, 3, 6],
  'aug': [0, 4, 8],
  '+': [0, 4, 8],
  'augmented': [0, 4, 8],
  'sus': [0, 5, 7],
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
  '5': [0, 7], // Power chord
};

// Extension intervals (added to triad)
export const EXTENSION_INTERVALS: Record<string, number[]> = {
  '6': [9],
  '7': [10],
  'maj7': [11],
  'M7': [11],
  'Δ7': [11],
  'm7': [10],
  'dim7': [9],
  'm7b5': [10], // handled in quality/alterations
  '9': [10, 14], // 7th + 9th (14 = 2)
  'maj9': [11, 14],
  'M9': [11, 14],
  'm9': [10, 14],
  '11': [10, 14, 17], // 7th + 9th + 11th (17 = 5)
  'maj11': [11, 14, 17],
  'm11': [10, 14, 17],
  '13': [10, 14, 17, 21], // 7th + 9th + 11th + 13th (21 = 9)
  'maj13': [11, 14, 17, 21],
  'm13': [10, 14, 17, 21],
  'add9': [14],
  'add2': [2],
  'add11': [17],
  'add4': [5],
  'add6': [9],
  '6/9': [9, 14],
  '69': [9, 14],
};

export const INTERVAL_NAMES: Record<number, string> = {
  0: 'R',
  1: 'b2',
  2: '2',
  3: 'b3',
  4: '3',
  5: '4',
  6: 'b5',
  7: '5',
  8: '#5',
  9: '6',
  10: 'b7',
  11: '7',
  14: '9',
  17: '11',
  21: '13'
};

export function transposeNote(note: NoteName, semitones: number): NoteName {
  const isFlat = note.includes('b') || note.includes('♭');
  const pc = getPitchClass(note);
  const newPc = (pc + semitones + 120) % 12;
  return isFlat ? PITCH_CLASS_TO_FLAT[newPc] : PITCH_CLASS_TO_SHARP[newPc];
}
