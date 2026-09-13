import * as Tone from 'tone';
import { GuitarAudioDriver } from '@/types/audio';
import { KarplusStrongGuitarDriver } from './SynthDriver';

// Local High-Resolution Studio Acoustic Guitar Sample Map
const LOCAL_SAMPLE_URLS: Record<string, string> = {
  'E2': '/audio/acoustic-guitar/E2.mp3',
  'G2': '/audio/acoustic-guitar/G2.mp3',
  'A2': '/audio/acoustic-guitar/A2.mp3',
  'B2': '/audio/acoustic-guitar/B2.mp3',
  'C3': '/audio/acoustic-guitar/C3.mp3',
  'D3': '/audio/acoustic-guitar/D3.mp3',
  'E3': '/audio/acoustic-guitar/E3.mp3',
  'G3': '/audio/acoustic-guitar/G3.mp3',
  'A3': '/audio/acoustic-guitar/A3.mp3',
  'B3': '/audio/acoustic-guitar/B3.mp3',
  'C4': '/audio/acoustic-guitar/C4.mp3',
  'D4': '/audio/acoustic-guitar/D4.mp3',
  'E4': '/audio/acoustic-guitar/E4.mp3',
  'G4': '/audio/acoustic-guitar/G4.mp3',
  'A4': '/audio/acoustic-guitar/A4.mp3',
  'B4': '/audio/acoustic-guitar/B4.mp3',
  'C5': '/audio/acoustic-guitar/C5.mp3',
  'E5': '/audio/acoustic-guitar/E5.mp3',
};

export class SampledGuitarDriver implements GuitarAudioDriver {
  private sampler: Tone.Sampler | null = null;
  private synthFallback: KarplusStrongGuitarDriver;
  private equalizer: Tone.EQ3;
  private compressor: Tone.Compressor;
  private volume: Tone.Volume;
  private isLoadedState: boolean = false;

  constructor(outputNode?: Tone.ToneAudioNode) {
    // Studio Master Acoustic Guitar EQ:
    // Low: warm body at 100Hz
    // Mid: slight dip at 400Hz to remove boxiness
    // High: sparkling +3dB air boost at 6kHz+ for steel-string clarity
    this.equalizer = new Tone.EQ3({
      low: 1.5,
      mid: -1.0,
      high: 3.5,
      lowFrequency: 250,
      highFrequency: 4500
    });

    // Gentle acoustic compressor for punch and sustain
    this.compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 2.5,
      attack: 0.005,
      release: 0.25
    });

    this.volume = new Tone.Volume(2);

    this.equalizer.connect(this.compressor);
    this.compressor.connect(this.volume);

    if (outputNode) {
      this.volume.connect(outputNode);
    } else {
      this.volume.toDestination();
    }

    this.synthFallback = new KarplusStrongGuitarDriver(this.equalizer);
  }

  public async init(): Promise<void> {
    if (this.isLoadedState && this.sampler) return;

    try {
      this.sampler = new Tone.Sampler({
        urls: LOCAL_SAMPLE_URLS,
        onload: () => {
          this.isLoadedState = true;
          console.log('[SampledGuitarDriver] High-resolution acoustic guitar sample bank loaded.');
        },
        onerror: (err) => {
          console.warn('[SampledGuitarDriver] Local audio sample loading failed, using synth:', err);
        }
      });

      this.sampler.connect(this.equalizer);
    } catch (err) {
      console.warn('[SampledGuitarDriver] Init error:', err);
    }
  }

  public isLoaded(): boolean {
    return this.isLoadedState;
  }

  public triggerPluck(pitch: string, time: number, velocity: number, duration: string = '2n'): void {
    if (this.sampler && this.sampler.loaded) {
      try {
        // High-definition sampled pluck with natural sustain
        this.sampler.triggerAttackRelease(pitch, duration, time, Math.min(1.0, Math.max(0.2, velocity * 1.1)));
        return;
      } catch {
        // Fallback
      }
    }
    this.synthFallback.triggerPluck(pitch, time, velocity, duration);
  }

  public triggerMutedPluck(pitch: string, time: number, velocity: number): void {
    if (this.sampler && this.sampler.loaded) {
      try {
        this.sampler.triggerAttackRelease(pitch, '16n', time, velocity * 0.7);
        return;
      } catch {
        // Fallback
      }
    }
    this.synthFallback.triggerMutedPluck(pitch, time, velocity);
  }

  public stopAll(): void {
    try {
      this.sampler?.releaseAll();
      this.synthFallback.stopAll();
    } catch {
      // Safe catch
    }
  }

  public dispose(): void {
    this.sampler?.dispose();
    this.synthFallback.dispose();
    this.equalizer.dispose();
    this.compressor.dispose();
    this.volume.dispose();
  }
}
