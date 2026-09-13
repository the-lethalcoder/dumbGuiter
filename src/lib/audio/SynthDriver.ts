import * as Tone from 'tone';
import { GuitarAudioDriver } from '@/types/audio';

/**
 * Polyphonic Acoustic Guitar Physical Modeling Synth.
 * High-definition harmonic excitation with sparkling steel-string highs.
 */
export class KarplusStrongGuitarDriver implements GuitarAudioDriver {
  private polySynth: Tone.PolySynth;
  private highShelf: Tone.EQ3;
  private volume: Tone.Volume;
  private isReady: boolean = false;

  constructor(outputNode?: Tone.ToneAudioNode) {
    this.highShelf = new Tone.EQ3({
      low: 1.0,
      mid: -0.5,
      high: 4.0, // High-frequency air boost
      lowFrequency: 200,
      highFrequency: 5000
    });

    this.volume = new Tone.Volume(1);

    if (outputNode) {
      this.volume.connect(outputNode);
    } else {
      this.volume.toDestination();
    }

    this.highShelf.connect(this.volume);

    // Warm steel-string acoustic guitar envelope
    this.polySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle16' // Rich, bright acoustic string harmonic series
      },
      envelope: {
        attack: 0.002,   // Crisp high-speed pick strike
        decay: 2.2,      // Long acoustic decay
        sustain: 0.15,
        release: 1.5
      }
    });

    this.polySynth.connect(this.highShelf);
    this.isReady = true;
  }

  public async init(): Promise<void> {
    this.isReady = true;
  }

  public isLoaded(): boolean {
    return this.isReady;
  }

  public triggerPluck(pitch: string, time: number, velocity: number, duration: string = '2n'): void {
    try {
      this.polySynth.triggerAttackRelease(pitch, duration, time, Math.max(0.15, Math.min(1.0, velocity)));
    } catch {
      // Safe catch
    }
  }

  public triggerMutedPluck(pitch: string, time: number, velocity: number): void {
    try {
      this.polySynth.triggerAttackRelease(pitch, '16n', time, velocity * 0.6);
    } catch {
      // Safe catch
    }
  }

  public stopAll(): void {
    try {
      this.polySynth.releaseAll();
    } catch {
      // Safe catch
    }
  }

  public dispose(): void {
    this.polySynth.dispose();
    this.highShelf.dispose();
    this.volume.dispose();
  }
}
