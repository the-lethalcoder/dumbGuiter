import { create } from 'zustand';
import {
  SongAST,
  ChordToken,
  RestToken,
  GuitarTuning,
  SongSection
} from '@/types/music';
import { StrumPattern } from '@/types/audio';
import { parseSongInput, parseChordToken } from '../music/parser';
import { getVoicingForChord, VoicingCache } from '../music/voicings';
import { transposeNote } from '../music/theory';
import { DEFAULT_TUNING, GUITAR_TUNINGS } from '../music/tunings';
import { DEFAULT_STRUM_PATTERN, PRESET_PATTERNS } from '../audio/patterns';
import { buildScheduledEvents } from '../audio/StrumScheduler';
import { AudioEngine } from '../audio/AudioEngine';

export const SAMPLE_SONGS: Record<string, { title: string; text: string; bpm: number; patternId: string }> = {
  'let_it_be': {
    title: 'Let It Be - The Beatles',
    bpm: 110,
    patternId: 'pop_4_4',
    text: `[Verse 1]
C                 G
When I find myself in times of trouble
Am            F
Mother Mary comes to me
C                G
Speaking words of wisdom
F*    C*
Let it be

[Chorus]
Am        G
Let it be, let it be
F         C
Let it be, let it be
C                G
Whisper words of wisdom
F*    C*
Let it be`
  },
  'stand_by_me': {
    title: 'Stand By Me - Ben E. King',
    bpm: 118,
    patternId: 'pop_4_4',
    text: `[Intro]
A(4) A(4) F#m(4) F#m(4)
D(4) E(4) A(4) A(4)

[Verse 1]
A
When the night has come
F#m
And the land is dark
        D        E             A
And the moon is the only light we'll see`
  },
  'hotel_california': {
    title: 'Hotel California - Eagles',
    bpm: 140,
    patternId: 'folk_4_4',
    text: `[Intro]
Bm(4) F#(4) A(4) E(4)
G(4) D(4) Em(4) F#(4)

[Verse 1]
Bm                      F#
On a dark desert highway, cool wind in my hair
A                     E
Warm smell of colitas, rising up through the air
G                         D
Up ahead in the distance, I saw a shimmering light
Em
My head grew heavy and my sight grew dim
F#*
I had to stop for the night`
  },
  'jazz_autumn_leaves': {
    title: 'Autumn Leaves (Jazz Progression)',
    bpm: 125,
    patternId: 'ballad_4_4',
    text: `[A Section]
Cm7(4) F7(4) Bbmaj7(4) Ebmaj7(4)
Am7b5(4) D7b9(4) Gm(4) G7(4)

[B Section]
Am7b5(4) D7b9(4) Gm(4) Gm(4)
Cm7(4) F7(4) Bbmaj7(4) Ebmaj7(4)
Am7b5(4) D7b9(4) Gm7(2) C7(2) Fm7(4)`
  }
};

interface SongState {
  rawInput: string;
  songAst: SongAST;
  allEvents: (ChordToken | RestToken)[];
  activeChordIndex: number;
  isPlaying: boolean;
  bpm: number;
  capo: number;
  tuning: GuitarTuning;
  strumPattern: StrumPattern;
  transposeOffset: number;
  loop: boolean;
  fretboardLabelMode: 'name' | 'interval' | 'finger';
  activeTab: 'builder' | 'text';

  // Actions
  setRawInput: (text: string) => void;
  setBpm: (bpm: number) => void;
  setCapo: (capo: number) => void;
  setTuning: (tuningId: string) => void;
  setStrumPattern: (pattern: StrumPattern) => void;
  setTransposeOffset: (offset: number) => void;
  transpose: (semitones: number) => void;
  setLoop: (loop: boolean) => void;
  setActiveChordIndex: (index: number) => void;
  setFretboardLabelMode: (mode: 'name' | 'interval' | 'finger') => void;
  setActiveTab: (tab: 'builder' | 'text') => void;

  // Builder actions
  updateChordToken: (sectionId: string, chordId: string, updates: Partial<ChordToken>) => void;
  addChordToSection: (sectionId: string, chordStr: string) => void;
  removeChordFromSection: (sectionId: string, chordId: string) => void;
  reorderChordsInSection: (sectionId: string, startIndex: number, endIndex: number) => void;
  addSection: (name: string) => void;
  removeSection: (sectionId: string) => void;
  loadSampleSong: (key: string) => void;

  // Audio Playback Actions
  initAudioClient: () => void;
  togglePlay: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
}

function resolveVoicingsForAst(ast: SongAST, tuning: GuitarTuning, capo: number): { ast: SongAST; allEvents: (ChordToken | RestToken)[] } {
  const allEvents: (ChordToken | RestToken)[] = [];

  const updatedSections = ast.sections.map(section => {
    const updatedEvents = section.events.map(event => {
      if (event.type === 'chord') {
        const chord = event as ChordToken;
        const voicing = getVoicingForChord(chord, tuning.midiPitches, capo);
        const resolvedChord = { ...chord, voicing };
        allEvents.push(resolvedChord);
        return resolvedChord;
      }
      allEvents.push(event);
      return event;
    });

    return {
      ...section,
      events: updatedEvents
    };
  });

  return {
    ast: { ...ast, sections: updatedSections },
    allEvents
  };
}

function updateAudioSchedule(allEvents: (ChordToken | RestToken)[], bpm: number, pattern: StrumPattern, tuning: GuitarTuning, capo: number) {
  if (typeof window === 'undefined') return;
  const scheduled = buildScheduledEvents(allEvents, bpm, pattern, tuning.midiPitches, capo);
  AudioEngine.getInstance().scheduleSong(scheduled);
}

const initialText = SAMPLE_SONGS['let_it_be'].text;
const initialAstRaw = parseSongInput(initialText);
const { ast: initialAst, allEvents: initialEvents } = resolveVoicingsForAst(initialAstRaw, DEFAULT_TUNING, 0);

export const useSongStore = create<SongState>((set, get) => {
  return {
    rawInput: initialText,
    songAst: initialAst,
    allEvents: initialEvents,
    activeChordIndex: 0,
    isPlaying: false,
    bpm: 110,
    capo: 0,
    tuning: DEFAULT_TUNING,
    strumPattern: DEFAULT_STRUM_PATTERN,
    transposeOffset: 0,
    loop: true,
    fretboardLabelMode: 'name',
    activeTab: 'builder',

    initAudioClient: () => {
      if (typeof window === 'undefined') return;
      const engine = AudioEngine.getInstance();
      engine.setChordChangeCallback((index) => {
        set({ activeChordIndex: index });
      });
      engine.setPlaybackEndCallback(() => {
        set({ isPlaying: false, activeChordIndex: 0 });
      });
      const { allEvents, bpm, strumPattern, tuning, capo } = get();
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setRawInput: (text: string) => {
      const { tuning, capo, bpm, strumPattern } = get();
      const parsed = parseSongInput(text);
      const { ast, allEvents } = resolveVoicingsForAst(parsed, tuning, capo);

      set({ rawInput: text, songAst: ast, allEvents, activeChordIndex: 0 });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setBpm: (bpm: number) => {
      set({ bpm });
      if (typeof window !== 'undefined') {
        AudioEngine.getInstance().setBpm(bpm);
      }
      const { allEvents, strumPattern, tuning, capo } = get();
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setCapo: (capo: number) => {
      VoicingCache.invalidate();
      set({ capo });
      const { songAst, tuning, bpm, strumPattern } = get();
      const { ast, allEvents } = resolveVoicingsForAst(songAst, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setTuning: (tuningId: string) => {
      const tuning = GUITAR_TUNINGS[tuningId] || DEFAULT_TUNING;
      VoicingCache.invalidate();
      set({ tuning });
      const { songAst, capo, bpm, strumPattern } = get();
      const { ast, allEvents } = resolveVoicingsForAst(songAst, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setStrumPattern: (strumPattern: StrumPattern) => {
      set({ strumPattern });
      const { allEvents, bpm, tuning, capo } = get();
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setTransposeOffset: (offset: number) => {
      set({ transposeOffset: offset });
    },

    transpose: (semitones: number) => {
      const { songAst, tuning, capo, bpm, strumPattern, transposeOffset } = get();

      const updatedSections = songAst.sections.map(sec => ({
        ...sec,
        events: sec.events.map(ev => {
          if (ev.type === 'chord') {
            const chord = ev as ChordToken;
            const newRoot = transposeNote(chord.root, semitones);
            const newBass = chord.bassNote ? transposeNote(chord.bassNote, semitones) : undefined;
            const newRaw = `${newRoot}${chord.quality}${chord.extensions.length > 0 ? chord.extensions[0] : ''}${newBass ? '/' + newBass : ''}${chord.articulation === 'one_shot' ? '*' : ''}(${chord.durationBeats})`;
            return parseChordToken(newRaw) as ChordToken;
          }
          return ev;
        })
      }));

      const newAst: SongAST = { ...songAst, sections: updatedSections };
      const { ast, allEvents } = resolveVoicingsForAst(newAst, tuning, capo);

      set({
        songAst: ast,
        allEvents,
        transposeOffset: transposeOffset + semitones
      });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    setLoop: (loop: boolean) => {
      set({ loop });
      if (typeof window !== 'undefined') {
        AudioEngine.getInstance().setLoop(loop);
      }
    },

    setActiveChordIndex: (activeChordIndex: number) => {
      set({ activeChordIndex });
    },

    setFretboardLabelMode: (fretboardLabelMode) => {
      set({ fretboardLabelMode });
    },

    setActiveTab: (activeTab) => {
      set({ activeTab });
    },

    updateChordToken: (sectionId: string, chordId: string, updates: Partial<ChordToken>) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();

      const updatedSections = songAst.sections.map(sec => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          events: sec.events.map(ev => {
            if (ev.id === chordId && ev.type === 'chord') {
              const merged = { ...ev, ...updates } as ChordToken;
              const voicing = getVoicingForChord(merged, tuning.midiPitches, capo);
              return { ...merged, voicing };
            }
            return ev;
          })
        };
      });

      const { ast, allEvents } = resolveVoicingsForAst({ ...songAst, sections: updatedSections }, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    addChordToSection: (sectionId: string, chordStr: string) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();
      const parsed = parseChordToken(chordStr);

      const updatedSections = songAst.sections.map(sec => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          events: [...sec.events, parsed as (ChordToken | RestToken)]
        };
      });

      const { ast, allEvents } = resolveVoicingsForAst({ ...songAst, sections: updatedSections }, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    removeChordFromSection: (sectionId: string, chordId: string) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();

      const updatedSections = songAst.sections.map(sec => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          events: sec.events.filter(ev => ev.id !== chordId)
        };
      });

      const { ast, allEvents } = resolveVoicingsForAst({ ...songAst, sections: updatedSections }, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    reorderChordsInSection: (sectionId: string, startIndex: number, endIndex: number) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();

      const updatedSections = songAst.sections.map(sec => {
        if (sec.id !== sectionId) return sec;
        const result = Array.from(sec.events);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return { ...sec, events: result };
      });

      const { ast, allEvents } = resolveVoicingsForAst({ ...songAst, sections: updatedSections }, tuning, capo);
      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    addSection: (name: string) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();
      const newSec: SongSection = {
        id: `sec_${Date.now()}`,
        name: name || `Section ${songAst.sections.length + 1}`,
        events: [
          parseChordToken('C(4)') as ChordToken,
          parseChordToken('G(4)') as ChordToken,
        ]
      };

      const { ast, allEvents } = resolveVoicingsForAst({
        ...songAst,
        sections: [...songAst.sections, newSec]
      }, tuning, capo);

      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    removeSection: (sectionId: string) => {
      const { songAst, tuning, capo, bpm, strumPattern } = get();
      if (songAst.sections.length <= 1) return;

      const { ast, allEvents } = resolveVoicingsForAst({
        ...songAst,
        sections: songAst.sections.filter(s => s.id !== sectionId)
      }, tuning, capo);

      set({ songAst: ast, allEvents });
      updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
    },

    loadSampleSong: (key: string) => {
      const sample = SAMPLE_SONGS[key];
      if (!sample) return;
      const { setRawInput, setBpm, setStrumPattern } = get();
      const pattern = PRESET_PATTERNS.find(p => p.id === sample.patternId) || DEFAULT_STRUM_PATTERN;
      setBpm(sample.bpm);
      setStrumPattern(pattern);
      setRawInput(sample.text);
    },

    togglePlay: async () => {
      const { isPlaying, play, pause } = get();
      if (isPlaying) {
        pause();
      } else {
        await play();
      }
    },

    play: async () => {
      const { allEvents, bpm, strumPattern, tuning, capo } = get();
      if (typeof window !== 'undefined') {
        const engine = AudioEngine.getInstance();
        updateAudioSchedule(allEvents, bpm, strumPattern, tuning, capo);
        await engine.play();
        set({ isPlaying: true });
      }
    },

    pause: () => {
      if (typeof window !== 'undefined') {
        AudioEngine.getInstance().pause();
        set({ isPlaying: false });
      }
    },

    stop: () => {
      if (typeof window !== 'undefined') {
        AudioEngine.getInstance().stop();
        set({ isPlaying: false, activeChordIndex: 0 });
      }
    }
  };
});
