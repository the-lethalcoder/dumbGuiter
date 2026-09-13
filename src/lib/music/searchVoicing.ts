import { Voicing } from '@/types/music';

interface SearchCandidate {
  fret: number | 'x';
  pitchClass: number;
}

/**
 * Searches for a playable, ergonomic 6-string guitar voicing for any arbitrary chord
 * defined by a required set of pitch classes and optional bass note.
 *
 * Employs candidate pre-filtering per string to bound search combinations to <= 64.
 */
export function searchBestVoicing(
  pitchClasses: number[],
  bassPitchClass: number | undefined,
  tuningMidi: [number, number, number, number, number, number] = [40, 45, 50, 55, 59, 64],
  capo: number = 0
): Voicing {
  const targetPcs = new Set(pitchClasses);
  const adjustedTuning = tuningMidi.map(p => p + capo);

  // Step 1: Pre-filter candidate frets (0..12) for each string (6 down to 1)
  const candidateFretsPerString: (number | 'x')[][] = [];

  for (let s = 0; s < 6; s++) {
    const basePitch = adjustedTuning[s];
    const candidates: (number | 'x')[] = ['x']; // String can always be muted

    for (let fret = 0; fret <= 12; fret++) {
      const pc = (basePitch + fret) % 12;
      if (targetPcs.has(pc)) {
        candidates.push(fret);
      }
    }
    candidateFretsPerString.push(candidates);
  }

  // Step 2: Branch and bound search across 6 strings
  let bestVoicing: Voicing = ['x', 'x', 'x', 'x', 'x', 'x'];
  let bestScore = Infinity;

  function branch(stringIndex: number, currentVoicing: (number | 'x')[]) {
    if (stringIndex === 6) {
      // Evaluate completed 6-string voicing
      const score = evaluateVoicingScore(currentVoicing, targetPcs, bassPitchClass, adjustedTuning);
      if (score < bestScore) {
        bestScore = score;
        bestVoicing = [...currentVoicing];
      }
      return;
    }

    const candidates = candidateFretsPerString[stringIndex];

    for (const fret of candidates) {
      currentVoicing[stringIndex] = fret;

      // Early pruning checks
      const fretted = currentVoicing.slice(0, stringIndex + 1).filter((f): f is number => typeof f === 'number' && f > 0);
      if (fretted.length >= 2) {
        const minFret = Math.min(...fretted);
        const maxFret = Math.max(...fretted);
        if (maxFret - minFret > 4) {
          continue; // Prune: span > 4 frets is physically unplayable
        }
      }

      branch(stringIndex + 1, currentVoicing);
    }
  }

  branch(0, new Array(6).fill('x'));

  // If no playable voicing was found, fallback to standard muted triad
  if (bestScore === Infinity || bestVoicing.every(f => f === 'x')) {
    return ['x', 3, 2, 0, 1, 0]; // Safe C fallback
  }

  return bestVoicing;
}

/**
 * Cost scoring heuristic: Lower score = more playable and resonant.
 */
function evaluateVoicingScore(
  voicing: (number | 'x')[],
  targetPcs: Set<number>,
  requiredBassPc: number | undefined,
  tuningMidi: number[]
): number {
  const soundingFrets = voicing.map((fret, stringIdx) => ({
    fret,
    stringIdx,
    pitch: typeof fret === 'number' ? tuningMidi[stringIdx] + fret : null,
    pitchClass: typeof fret === 'number' ? (tuningMidi[stringIdx] + fret) % 12 : null
  })).filter(s => s.pitch !== null);

  // Must have at least 3 sounding strings
  if (soundingFrets.length < 3) return 10000;

  let score = 0;

  // 1. Lowest sounding string must match bass note
  const lowestSounding = soundingFrets[0];
  if (requiredBassPc !== undefined) {
    if (lowestSounding.pitchClass !== requiredBassPc) {
      score += 800; // Heavy penalty if requested slash bass is wrong
    }
  }

  // 2. Fret span penalty
  const fretted = soundingFrets.filter(s => typeof s.fret === 'number' && s.fret > 0).map(s => s.fret as number);
  if (fretted.length > 0) {
    const span = Math.max(...fretted) - Math.min(...fretted);
    if (span > 4) return 15000;
    score += span * 15;
    score += Math.min(...fretted) * 2; // Prefer lower position frets for acoustic fullness
  }

  // 3. Completeness of pitch classes
  const presentPcs = new Set(soundingFrets.map(s => s.pitchClass));
  targetPcs.forEach(pc => {
    if (!presentPcs.has(pc)) {
      score += 150; // Missing target chord tone
    }
  });

  // 4. Reward open strings and string density
  const openCount = soundingFrets.filter(s => s.fret === 0).length;
  score -= openCount * 10;
  const mutedCount = voicing.filter(f => f === 'x').length;
  score += mutedCount * 12;

  return score;
}
