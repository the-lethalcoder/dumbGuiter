import { StrumPattern } from '@/types/audio';

export const PRESET_PATTERNS: StrumPattern[] = [
  {
    id: 'pop_4_4',
    name: 'Pop Standard (D - D U - U D U)',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.9 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'up', accent: false, velocity: 0.7 },
      { direction: 'rest' },
      { direction: 'up', accent: false, velocity: 0.7 },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'up', accent: false, velocity: 0.7 },
    ]
  },
  {
    id: 'folk_4_4',
    name: 'Folk / Country (D - D - D - D U)',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.9 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'rest' },
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'up', accent: false, velocity: 0.7 },
    ]
  },
  {
    id: 'ballad_4_4',
    name: 'Acoustic Ballad (D - - - D - D U)',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'rest' },
      { direction: 'rest' },
      { direction: 'rest' },
      { direction: 'down', accent: true, velocity: 0.8 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.7 },
      { direction: 'up', accent: false, velocity: 0.65 },
    ]
  },
  {
    id: 'waltz_3_4',
    name: 'Waltz 3/4 (D - D U D U)',
    timeSignature: '3/4',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.9 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'up', accent: false, velocity: 0.7 },
      { direction: 'down', accent: false, velocity: 0.75 },
      { direction: 'up', accent: false, velocity: 0.7 },
    ]
  },
  {
    id: 'slow_rock_6_8',
    name: 'Slow Rock 6/8 (D - D - D - D - D - D -)',
    timeSignature: '6/8',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.9 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.7 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.7 },
      { direction: 'rest' },
    ]
  },
  {
    id: 'straight_quarters',
    name: 'Straight Quarters (D - D - D - D -)',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.8 },
      { direction: 'rest' },
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'rest' },
      { direction: 'down', accent: false, velocity: 0.8 },
      { direction: 'rest' },
    ]
  },
  {
    id: 'island_reggae',
    name: 'Island Chuck (x - D x - - D x)',
    timeSignature: '4/4',
    subdivision: 8,
    steps: [
      { direction: 'mute', velocity: 0.7 },
      { direction: 'rest' },
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'mute', velocity: 0.7 },
      { direction: 'rest' },
      { direction: 'rest' },
      { direction: 'down', accent: true, velocity: 0.85 },
      { direction: 'mute', velocity: 0.7 },
    ]
  }
];

export const DEFAULT_STRUM_PATTERN = PRESET_PATTERNS[0];
