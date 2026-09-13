import { ChordToken, RestToken, Voicing } from '@/types/music';
import { StrumPattern, ScheduledStrumEvent, PluckNote, StrumDirection } from '@/types/audio';
import { midiToNoteName } from '../music/theory';

export function buildScheduledEvents(
  songEvents: (ChordToken | RestToken)[],
  bpm: number,
  pattern: StrumPattern,
  tuningMidi: [number, number, number, number, number, number] = [40, 45, 50, 55, 59, 64],
  capo: number = 0
): ScheduledStrumEvent[] {
  const secondsPerBeat = 60 / bpm;
  let currentTransportTime = 0;
  const scheduled: ScheduledStrumEvent[] = [];

  songEvents.forEach((event, chordIndex) => {
    const chordDurationSeconds = event.durationBeats * secondsPerBeat;

    if (event.type === 'rest') {
      scheduled.push({
        chordId: event.id,
        chordIndex,
        chordName: 'N.C.',
        transportTime: currentTransportTime,
        durationSeconds: chordDurationSeconds,
        type: 'rest',
        articulation: event.articulation,
        notes: []
      });
      currentTransportTime += chordDurationSeconds;
      return;
    }

    const chord = event as ChordToken;
    const voicing = chord.voicing || ['x', 3, 2, 0, 1, 0];

    // Compute sounding notes
    const soundingNotes = voicing.map((fret, stringIdx) => {
      if (typeof fret === 'number') {
        const midi = tuningMidi[stringIdx] + capo + fret;
        return {
          stringIdx,
          fret,
          midi,
          pitch: midiToNoteName(midi)
        };
      }
      return null;
    }).filter((n): n is NonNullable<typeof n> => n !== null);

    const pluckNotes: PluckNote[] = [];

    if (chord.articulation === 'one_shot') {
      // One-shot articulation (*): Play single downstroke and sustain
      const sweepDuration = calculateStrumSweep(bpm);
      soundingNotes.forEach((n, idx) => {
        const stringProgress = soundingNotes.length > 1 ? idx / (soundingNotes.length - 1) : 0;
        const offset = stringProgress * sweepDuration;
        const baseVel = 0.9 - stringProgress * 0.15; // Low strings slightly louder
        const jitter = (Math.random() - 0.5) * 0.003; // +/- 1.5ms

        pluckNotes.push({
          pitch: n.pitch,
          midi: n.midi,
          stringIndex: n.stringIdx,
          fret: n.fret,
          offset: Math.max(0, offset + jitter),
          velocity: Math.min(1.0, Math.max(0.2, baseVel + (Math.random() - 0.5) * 0.05)),
          duration: `${chord.durationBeats}m`
        });
      });
    } else {
      // Standard Strum Pattern Mode
      const steps = pattern.steps;
      const stepCount = steps.length;
      // In 4/4 time signature, 8 steps = eighth notes = 0.5 beat per step
      const beatsPerStep = pattern.timeSignature === '4/4' ? (4 / stepCount) : (3 / stepCount);
      const totalStepsInChord = Math.round((chord.durationBeats / beatsPerStep));

      for (let s = 0; s < totalStepsInChord; s++) {
        const patternStep = steps[s % stepCount];
        const stepTimeOffset = s * beatsPerStep * secondsPerBeat;

        if (patternStep.direction === 'rest') continue;

        const isDown = patternStep.direction === 'down';
        const isMute = patternStep.direction === 'mute';
        const sweepDuration = calculateStrumSweep(bpm);

        // Strings order: downstroke = 6 to 1; upstroke = 1 to 6
        const orderedNotes = isDown ? [...soundingNotes] : [...soundingNotes].reverse();

        orderedNotes.forEach((n, idx) => {
          const stringProgress = orderedNotes.length > 1 ? idx / (orderedNotes.length - 1) : 0;
          const offset = stepTimeOffset + (stringProgress * sweepDuration);
          let vel = (patternStep.velocity ?? 0.75);

          if (patternStep.accent) vel += 0.15;
          if (!isDown) vel *= 0.9; // Upstrokes slightly gentler

          const jitter = (Math.random() - 0.5) * 0.003;

          pluckNotes.push({
            pitch: n.pitch,
            midi: n.midi,
            stringIndex: n.stringIdx,
            fret: n.fret,
            offset: Math.max(0, offset + jitter),
            velocity: Math.min(1.0, Math.max(0.2, vel + (Math.random() - 0.5) * 0.04)),
            duration: isMute ? '16n' : '4n'
          });
        });
      }
    }

    scheduled.push({
      chordId: chord.id,
      chordIndex,
      chordName: chord.raw,
      transportTime: currentTransportTime,
      durationSeconds: chordDurationSeconds,
      type: 'strum',
      articulation: chord.articulation,
      notes: pluckNotes,
      voicing
    });

    currentTransportTime += chordDurationSeconds;
  });

  return scheduled;
}

function calculateStrumSweep(bpm: number): number {
  // Strum speed scaled dynamically by tempo (15ms to 40ms)
  const base = 0.035 * (120 / bpm);
  return Math.min(0.045, Math.max(0.015, base));
}
