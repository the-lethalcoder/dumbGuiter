import { ChordToken, Voicing } from '@/types/music';
import { searchBestVoicing } from './searchVoicing';

// Common guitar shape library: mapped by `${normalizedRoot}:${quality}`
export const COMMON_VOICINGS: Record<string, Voicing[]> = {
  // Majors
  'C:maj': [['x', 3, 2, 0, 1, 0], ['x', 3, 5, 5, 5, 3], [8, 10, 10, 9, 8, 8]],
  'C:': [['x', 3, 2, 0, 1, 0]],
  'D:maj': [['x', 'x', 0, 2, 3, 2], ['x', 5, 7, 7, 7, 5]],
  'D:': [['x', 'x', 0, 2, 3, 2]],
  'E:maj': [[0, 2, 2, 1, 0, 0], ['x', 7, 9, 9, 9, 7]],
  'E:': [[0, 2, 2, 1, 0, 0]],
  'F:maj': [[1, 3, 3, 2, 1, 1], ['x', 'x', 3, 2, 1, 1], ['x', 8, 10, 10, 10, 8]],
  'F:': [[1, 3, 3, 2, 1, 1]],
  'G:maj': [[3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 3, 3], [3, 5, 5, 4, 3, 3]],
  'G:': [[3, 2, 0, 0, 0, 3]],
  'A:maj': [['x', 0, 2, 2, 2, 0], [5, 7, 7, 6, 5, 5]],
  'A:': [['x', 0, 2, 2, 2, 0]],
  'B:maj': [['x', 2, 4, 4, 4, 2], [7, 9, 9, 8, 7, 7]],
  'B:': [['x', 2, 4, 4, 4, 2]],

  // Sharps / Flats
  'F#:maj': [[2, 4, 4, 3, 2, 2]], 'Gb:maj': [[2, 4, 4, 3, 2, 2]],
  'C#:maj': [['x', 4, 6, 6, 6, 4]], 'Db:maj': [['x', 4, 6, 6, 6, 4]],
  'G#:maj': [[4, 6, 6, 5, 4, 4]], 'Ab:maj': [[4, 6, 6, 5, 4, 4]],
  'D#:maj': [['x', 6, 8, 8, 8, 6]], 'Eb:maj': [['x', 6, 8, 8, 8, 6]],
  'A#:maj': [['x', 1, 3, 3, 3, 1]], 'Bb:maj': [['x', 1, 3, 3, 3, 1]],

  // Minors
  'Am:m': [['x', 0, 2, 2, 1, 0], [5, 7, 7, 5, 5, 5]], 'Am:min': [['x', 0, 2, 2, 1, 0]],
  'A:m': [['x', 0, 2, 2, 1, 0]], 'A:min': [['x', 0, 2, 2, 1, 0]],
  'Bm:m': [['x', 2, 4, 4, 3, 2]], 'B:m': [['x', 2, 4, 4, 3, 2]],
  'Cm:m': [['x', 3, 5, 5, 4, 3]], 'C:m': [['x', 3, 5, 5, 4, 3]],
  'Dm:m': [['x', 'x', 0, 2, 3, 1]], 'D:m': [['x', 'x', 0, 2, 3, 1]],
  'Em:m': [[0, 2, 2, 0, 0, 0], ['x', 7, 9, 9, 8, 7]], 'E:m': [[0, 2, 2, 0, 0, 0]],
  'Fm:m': [[1, 3, 3, 1, 1, 1]], 'F:m': [[1, 3, 3, 1, 1, 1]],
  'Gm:m': [[3, 5, 5, 3, 3, 3]], 'G:m': [[3, 5, 5, 3, 3, 3]],
  'F#m:m': [[2, 4, 4, 2, 2, 2]], 'F#:m': [[2, 4, 4, 2, 2, 2]],
  'C#m:m': [['x', 4, 6, 6, 5, 4]], 'C#:m': [['x', 4, 6, 6, 5, 4]],
  'G#m:m': [[4, 6, 6, 4, 4, 4]], 'G#:m': [[4, 6, 6, 4, 4, 4]],
  'Ebm:m': [['x', 6, 8, 8, 7, 6]], 'Eb:m': [['x', 6, 8, 8, 7, 6]],
  'Bbm:m': [['x', 1, 3, 3, 2, 1]], 'Bb:m': [['x', 1, 3, 3, 2, 1]],

  // Dominant 7ths
  'C:7': [['x', 3, 2, 3, 1, 0]],
  'D:7': [['x', 'x', 0, 2, 1, 2]],
  'E:7': [[0, 2, 0, 1, 0, 0]],
  'F:7': [[1, 3, 1, 2, 1, 1]],
  'G:7': [[3, 2, 0, 0, 0, 1]],
  'A:7': [['x', 0, 2, 0, 2, 0]],
  'B:7': [['x', 2, 1, 2, 0, 2]],
  'F#:7': [[2, 4, 2, 3, 2, 2]],
  'Bb:7': [['x', 1, 3, 1, 3, 1]],

  // Major 7ths
  'C:maj7': [['x', 3, 2, 0, 0, 0]],
  'D:maj7': [['x', 'x', 0, 2, 2, 2]],
  'E:maj7': [[0, 2, 1, 1, 0, 0]],
  'F:maj7': [['x', 'x', 3, 2, 1, 0], [1, 3, 2, 2, 1, 1]],
  'G:maj7': [[3, 2, 0, 0, 0, 2]],
  'A:maj7': [['x', 0, 2, 1, 2, 0]],
  'B:maj7': [['x', 2, 4, 3, 4, 2]],
  'Bb:maj7': [['x', 1, 3, 2, 3, 1]],

  // Minor 7ths
  'Am:7': [['x', 0, 2, 0, 1, 0]], 'A:m7': [['x', 0, 2, 0, 1, 0]],
  'Bm:7': [['x', 2, 0, 2, 0, 2], ['x', 2, 4, 2, 3, 2]], 'B:m7': [['x', 2, 4, 2, 3, 2]],
  'Cm:7': [['x', 3, 5, 3, 4, 3]], 'C:m7': [['x', 3, 5, 3, 4, 3]],
  'Dm:7': [['x', 'x', 0, 2, 1, 1]], 'D:m7': [['x', 'x', 0, 2, 1, 1]],
  'Em:7': [[0, 2, 0, 0, 0, 0], [0, 2, 2, 0, 3, 0]], 'E:m7': [[0, 2, 0, 0, 0, 0]],
  'F#m:7': [[2, 4, 2, 2, 2, 2]], 'F#:m7': [[2, 4, 2, 2, 2, 2]],

  // Suspended & Adds
  'C:sus4': [['x', 3, 3, 0, 1, 0]], 'C:sus2': [['x', 3, 0, 0, 1, 0]],
  'D:sus4': [['x', 'x', 0, 2, 3, 3]], 'D:sus2': [['x', 'x', 0, 2, 3, 0]],
  'E:sus4': [[0, 2, 2, 2, 0, 0]],
  'G:sus4': [[3, 3, 0, 0, 1, 3]],
  'A:sus4': [['x', 0, 2, 2, 3, 0]], 'A:sus2': [['x', 0, 2, 2, 0, 0]],
  'C:add9': [['x', 3, 2, 0, 3, 0]],
  'G:add9': [[3, 2, 0, 2, 0, 3]],
};

/**
 * In-memory LRU Memoization Cache for Voicings.
 */
export class VoicingCache {
  private static cache = new Map<string, Voicing>();

  public static getCacheKey(
    pitchClasses: number[],
    bassPitchClass: number | undefined,
    capo: number,
    tuning: number[]
  ): string {
    const pcKey = [...pitchClasses].sort((a, b) => a - b).join(',');
    const bassKey = bassPitchClass !== undefined ? bassPitchClass : 'none';
    const tuningKey = tuning.join(',');
    return `${pcKey}_b${bassKey}_c${capo}_t${tuningKey}`;
  }

  public static get(key: string): Voicing | undefined {
    return this.cache.get(key);
  }

  public static set(key: string, voicing: Voicing): void {
    if (this.cache.size > 2000) this.cache.clear();
    this.cache.set(key, voicing);
  }

  public static invalidate(): void {
    this.cache.clear();
  }
}

/**
 * Returns the best 6-string voicing for a given ChordToken.
 */
export function getVoicingForChord(
  chord: ChordToken,
  tuningMidi: [number, number, number, number, number, number] = [40, 45, 50, 55, 59, 64],
  capo: number = 0
): Voicing {
  // If no slash bass and standard tuning/no capo, check common dictionary
  const isStandardTuning = tuningMidi.join(',') === '40,45,50,55,59,64' && capo === 0;

  if (isStandardTuning && chord.bassNote === undefined) {
    const lookupKey = `${chord.root}:${chord.quality}`;
    if (COMMON_VOICINGS[lookupKey]) {
      return COMMON_VOICINGS[lookupKey][0];
    }
  }

  // Check Cache
  const cacheKey = VoicingCache.getCacheKey(chord.pitchClasses, chord.bassPitchClass, capo, tuningMidi);
  const cached = VoicingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Algorithmic Search Fallback
  const searched = searchBestVoicing(chord.pitchClasses, chord.bassPitchClass, tuningMidi, capo);
  VoicingCache.set(cacheKey, searched);
  return searched;
}
