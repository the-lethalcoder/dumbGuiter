import { ChordArticulation, Voicing } from './music';

export type StrumDirection = 'down' | 'up' | 'mute' | 'rest';

export interface StrumStep {
  direction: StrumDirection;
  accent?: boolean;
  velocity?: number;
}

export interface StrumPattern {
  id: string;
  name: string;
  timeSignature: '4/4' | '3/4' | '6/8';
  subdivision: 8 | 16;
  steps: StrumStep[];
}

export interface PluckNote {
  pitch: string;       // e.g. "C4", "G3"
  midi: number;
  stringIndex: number; // 0 (low E) to 5 (high e)
  fret: number;
  offset: number;      // In seconds from chord start (for strum sweep)
  velocity: number;    // 0.0 to 1.0
  duration: string;    // e.g. "2n", "4n"
}

export interface ScheduledStrumEvent {
  chordId: string;
  chordIndex: number;
  chordName: string;
  transportTime: number; // In Tone.Transport seconds or bars:beats:sixteenths
  durationSeconds: number;
  type: 'strum' | 'rest';
  articulation: ChordArticulation;
  notes: PluckNote[];
  voicing?: Voicing;
}

export interface GuitarAudioDriver {
  init(): Promise<void>;
  isLoaded(): boolean;
  triggerPluck(pitch: string, time: number, velocity: number, duration?: string): void;
  triggerMutedPluck(pitch: string, time: number, velocity: number): void;
  stopAll(): void;
  dispose(): void;
}
