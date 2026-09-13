import { GuitarTuning } from '@/types/music';

export const GUITAR_TUNINGS: Record<string, GuitarTuning> = {
  'standard': {
    id: 'standard',
    name: 'Standard (E A D G B e)',
    notes: ['E', 'A', 'D', 'G', 'B', 'E'],
    midiPitches: [40, 45, 50, 55, 59, 64],
  },
  'drop_d': {
    id: 'drop_d',
    name: 'Drop D (D A D G B e)',
    notes: ['D', 'A', 'D', 'G', 'B', 'E'],
    midiPitches: [38, 45, 50, 55, 59, 64],
  },
  'dadgad': {
    id: 'dadgad',
    name: 'DADGAD (D A D G A d)',
    notes: ['D', 'A', 'D', 'G', 'A', 'D'],
    midiPitches: [38, 45, 50, 55, 57, 62],
  },
  'open_d': {
    id: 'open_d',
    name: 'Open D (D A D F# A d)',
    notes: ['D', 'A', 'D', 'F#', 'A', 'D'],
    midiPitches: [38, 45, 50, 54, 57, 62],
  },
  'open_g': {
    id: 'open_g',
    name: 'Open G (D G D G B d)',
    notes: ['D', 'G', 'D', 'G', 'B', 'D'],
    midiPitches: [38, 43, 50, 55, 59, 62],
  },
  'half_step_down': {
    id: 'half_step_down',
    name: 'Half-Step Down (Eb Ab Db Gb Bb eb)',
    notes: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'],
    midiPitches: [39, 44, 49, 54, 58, 63],
  }
};

export const DEFAULT_TUNING = GUITAR_TUNINGS['standard'];
