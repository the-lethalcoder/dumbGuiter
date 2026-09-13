import * as Tone from 'tone';
import { SampledGuitarDriver } from './SamplerDriver';
import { ScheduledStrumEvent } from '@/types/audio';

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private driver: SampledGuitarDriver | null = null;
  private reverb: Tone.Freeverb | null = null;
  private masterGain: Tone.Gain | null = null;
  private isInitialized: boolean = false;
  private isPlaying: boolean = false;
  private scheduledEvents: ScheduledStrumEvent[] = [];
  private onChordChangeCallback: ((chordIndex: number) => void) | null = null;
  private onPlaybackEndCallback: (() => void) | null = null;
  private totalDuration: number = 0;
  private loop: boolean = true;

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private constructor() {}

  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isInitialized && this.driver) return;

    try {
      await Tone.start();

      if (!this.masterGain) {
        this.masterGain = new Tone.Gain(1.0).toDestination();
      }

      if (!this.reverb) {
        // Transparent, airy acoustic guitar room reverb
        this.reverb = new Tone.Freeverb({
          roomSize: 0.35,
          dampening: 6000, // Keep high-frequency sparkle
          wet: 0.08       // Subtle air, no muddiness
        });
        this.reverb.connect(this.masterGain);
      }

      if (!this.driver) {
        this.driver = new SampledGuitarDriver(this.reverb);
        await this.driver.init();
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('[AudioEngine] Init warning:', err);
    }
  }

  public setChordChangeCallback(cb: (chordIndex: number) => void) {
    this.onChordChangeCallback = cb;
  }

  public setPlaybackEndCallback(cb: () => void) {
    this.onPlaybackEndCallback = cb;
  }

  public setBpm(bpm: number) {
    if (typeof window === 'undefined') return;
    try {
      Tone.getTransport().bpm.value = bpm;
    } catch {
      // Safe catch
    }
  }

  public setLoop(loop: boolean) {
    this.loop = loop;
    if (typeof window === 'undefined') return;
    try {
      Tone.getTransport().loop = loop;
    } catch {
      // Safe catch
    }
  }

  public scheduleSong(events: ScheduledStrumEvent[]) {
    if (typeof window === 'undefined') return;

    try {
      Tone.getTransport().cancel();
      this.scheduledEvents = events;

      if (events.length === 0) {
        this.totalDuration = 0;
        return;
      }

      const lastEvent = events[events.length - 1];
      this.totalDuration = lastEvent.transportTime + lastEvent.durationSeconds;

      events.forEach((event) => {
        Tone.getTransport().schedule((time) => {
          // 1. Audio Plucks (Sample Accurate Web Audio timing)
          if (event.type === 'strum' && this.driver) {
            event.notes.forEach((note) => {
              this.driver?.triggerPluck(note.pitch, time + note.offset, note.velocity, note.duration);
            });
          }

          // 2. UI Thread Sync (via Tone.Draw)
          Tone.getDraw().schedule(() => {
            if (this.onChordChangeCallback) {
              this.onChordChangeCallback(event.chordIndex);
            }
          }, time);
        }, event.transportTime);
      });

      // End / Loop handler
      Tone.getTransport().schedule((time) => {
        Tone.getDraw().schedule(() => {
          if (!this.loop) {
            this.pause();
            if (this.onPlaybackEndCallback) {
              this.onPlaybackEndCallback();
            }
          }
        }, time);
      }, this.totalDuration);

      Tone.getTransport().loop = this.loop;
      Tone.getTransport().loopEnd = this.totalDuration;
    } catch {
      // Safe catch
    }
  }

  public async play(): Promise<void> {
    if (typeof window === 'undefined') return;

    await this.init();

    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }

    Tone.getTransport().start();
    this.isPlaying = true;
  }

  public pause(): void {
    if (typeof window === 'undefined') return;
    try {
      Tone.getTransport().pause();
      this.driver?.stopAll();
      this.isPlaying = false;
    } catch {
      // Safe catch
    }
  }

  public stop(): void {
    if (typeof window === 'undefined') return;
    try {
      Tone.getTransport().stop();
      Tone.getTransport().position = 0;
      this.driver?.stopAll();
      this.isPlaying = false;
      if (this.onChordChangeCallback) {
        this.onChordChangeCallback(0);
      }
    } catch {
      // Safe catch
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
