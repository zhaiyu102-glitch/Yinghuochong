// Web Audio API Synthesizer for Firefly Interaction
// Generates rain, cricket chirps, wind swell, and gesture feedback sounds programmatically without asset sizes or 404s.

let audioCtx: AudioContext | null = null;

// Node caches for real-time control
let rainNode: AudioWorkletNode | ScriptProcessorNode | null = null;
let rainFilter: BiquadFilterNode | null = null;
let rainGain: GainNode | null = null;

let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;

let cricketInterval: any = null;
let forestGain: GainNode | null = null;

let musicGain: GainNode | null = null;
let natureGain: GainNode | null = null;
let musicInterval: any = null;
let natureInterval: any = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export const startAmbientSynth = () => {
  const ctx = getAudioContext();
  
  // 1. Create Rain Synthesizer (Filtered White Noise)
  if (!rainGain) {
    rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0, ctx.currentTime);
    rainGain.connect(ctx.destination);

    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.setValueAtTime(800, ctx.currentTime);
    rainFilter.Q.setValueAtTime(1.5, ctx.currentTime);
    rainFilter.connect(rainGain);

    // Dynamic White Noise Buffer
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(rainFilter);
    noiseSource.start(0);

    // LFO to make the rain rustle / fluctuate organically
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // 0.2 Hz slow drift
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);  // frequency swing
    lfo.connect(lfoGain);
    lfoGain.connect(rainFilter.frequency);
    lfo.start(0);
  }

  // 2. Create Wind Synthesizer (Very Low Lowpass Noise Swells)
  if (!windGain) {
    windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.02, ctx.currentTime);
    windGain.connect(ctx.destination);

    windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.setValueAtTime(150, ctx.currentTime);
    windFilter.Q.setValueAtTime(1, ctx.currentTime);
    windFilter.connect(windGain);

    const windNoise = ctx.createBufferSource();
    // Re-use noise buffer
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
       output[i] = Math.random() * 2 - 1;
    }
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;
    windNoise.connect(windFilter);
    windNoise.start(0);

    // Wind modulation (swell lfo)
    const swellLfo = ctx.createOscillator();
    swellLfo.frequency.setValueAtTime(0.08, ctx.currentTime); // very slow
    const swellGain = ctx.createGain();
    swellGain.gain.setValueAtTime(80, ctx.currentTime);
    swellLfo.connect(swellGain);
    swellGain.connect(windFilter.frequency);
    swellLfo.start(0);
  }

  // 3. Ambient crickets generator (Chirping synthesizer)
  if (!forestGain) {
    forestGain = ctx.createGain();
    forestGain.gain.setValueAtTime(0, ctx.currentTime);
    forestGain.connect(ctx.destination);
    
    // Spawns chirps periodically
    let chirpCount = 0;
    cricketInterval = setInterval(() => {
      // Occasional gentle crickets when forest gains volume
      if (!forestGain || forestGain.gain.value < 0.01) return;
      
      const speed = Math.random() > 0.5 ? 45 : 35; // chirp rate
      const now = ctx.currentTime;
      
      // Multi-pulse chirp
      for (let pulse = 0; pulse < 3; pulse++) {
        const pulseStart = now + pulse * 0.08;
        
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(4200 + Math.random() * 200, pulseStart); // 4.2 kHz crickets
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, pulseStart);
        oscGain.gain.linearRampToValueAtTime(0.015, pulseStart + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + 0.06);
        
        osc.connect(oscGain);
        oscGain.connect(forestGain);
        osc.start(pulseStart);
        osc.stop(pulseStart + 0.07);
      }
    }, 1200);
  }

  // 4. Start serene forest music
  startForestMusic(ctx, ctx.destination);

  // 5. Start nature sounds
  startNatureSounds(ctx, ctx.destination);
};

const startForestMusic = (ctx: AudioContext, destination: AudioNode) => {
  if (musicInterval) return;

  musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(0, ctx.currentTime);
  musicGain.connect(destination);

  // Serene G/C pentatonic and major 9th progression
  const chordBook = [
    [130.81, 164.81, 196.00, 246.94, 293.66], // Cmaj9 (C3, E3, G3, B3, D4)
    [110.00, 130.81, 164.81, 196.00, 220.00], // Am9 (A2, C3, E3, G3, A3)
    [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9 (F3, A3, C4, E4, G4)
    [146.83, 196.00, 246.94, 293.66, 370.01], // G9/D (D3, G3, B3, D4, F#4)
  ];

  let currentChordIndex = 0;

  const playNextChord = () => {
    if (!musicGain || musicGain.gain.value < 0.001) return;

    const chord = chordBook[currentChordIndex];
    currentChordIndex = (currentChordIndex + 1) % chordBook.length;

    const now = ctx.currentTime;
    const chordDuration = 9; // Sustained pads
    const fadeTime = 3.5;

    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine"; // Soft sine wave for pure ambient background pad
      osc.frequency.setValueAtTime(freq, now);

      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = "lowpass";
      lpFilter.frequency.setValueAtTime(320, now);
      lpFilter.frequency.exponentialRampToValueAtTime(160, now + chordDuration);

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0, now);
      voiceGain.gain.linearRampToValueAtTime(0.04, now + fadeTime);
      voiceGain.gain.setValueAtTime(0.04, now + chordDuration - fadeTime);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration);

      osc.connect(lpFilter);
      lpFilter.connect(voiceGain);
      voiceGain.connect(musicGain!);

      osc.start(now);
      osc.stop(now + chordDuration);
    });
  };

  playNextChord();
  musicInterval = setInterval(playNextChord, 8500); // 8.5s interval with overlap
};

const startNatureSounds = (ctx: AudioContext, destination: AudioNode) => {
  if (natureInterval) return;

  natureGain = ctx.createGain();
  natureGain.gain.setValueAtTime(0, ctx.currentTime);
  natureGain.connect(destination);

  natureInterval = setInterval(() => {
    if (!natureGain || natureGain.gain.value < 0.001) return;
    
    const now = ctx.currentTime;
    const r = Math.random();

    if (r < 0.45) {
      // Woodland Frog Croak Ribbit
      const duration = 0.4;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(75, now);
      
      const vibrato = ctx.createOscillator();
      vibrato.frequency.setValueAtTime(35, now);
      const vibGain = ctx.createGain();
      vibGain.gain.setValueAtTime(25, now);
      vibrato.connect(vibGain);
      vibGain.connect(osc.frequency);
      
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(180, now);
      filter.Q.setValueAtTime(4, now);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.035, now + 0.06);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(natureGain);

      vibrato.start(now);
      vibrato.stop(now + duration);
      osc.start(now);
      osc.stop(now + duration);
    } else if (r < 0.8) {
      // Forest Breezy Leaf Rustle
      const duration = 1.2;
      const noise = ctx.createBufferSource();
      const bufferSize = 1.2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(0.8, now);

      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(1.5, now);
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(600, now);
      mod.connect(modGain);
      modGain.connect(filter.frequency);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.02, now + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(natureGain);

      mod.start(now);
      mod.stop(now + duration);
      noise.start(now);
      noise.stop(now + duration);
    }
  }, 2800);
};

// Controls rain volume transition over standard timeline
export const fadeInRain = (duration: number = 3) => {
  const ctx = getAudioContext();
  if (rainGain) {
    rainGain.gain.cancelScheduledValues?.(ctx.currentTime);
    rainGain.gain.setValueAtTime(rainGain.gain.value, ctx.currentTime);
    rainGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + duration);
  }
};

export const fadeOutRain = (duration: number = 5) => {
  const ctx = getAudioContext();
  if (rainGain) {
    rainGain.gain.cancelScheduledValues?.(ctx.currentTime);
    rainGain.gain.setValueAtTime(rainGain.gain.value, ctx.currentTime);
    rainGain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + duration);
  }
};

// Forest crickets/wind fade
export const fadeInForestAmbient = (duration: number = 4) => {
  const ctx = getAudioContext();
  if (forestGain) {
    forestGain.gain.cancelScheduledValues?.(ctx.currentTime);
    forestGain.gain.setValueAtTime(forestGain.gain.value, ctx.currentTime);
    forestGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + duration);
  }
  if (windGain) {
    windGain.gain.cancelScheduledValues?.(ctx.currentTime);
    windGain.gain.setValueAtTime(windGain.gain.value, ctx.currentTime);
    windGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + duration);
  }
  if (musicGain) {
    musicGain.gain.cancelScheduledValues?.(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + duration); // Rich background ambient music
  }
  if (natureGain) {
    natureGain.gain.cancelScheduledValues?.(ctx.currentTime);
    natureGain.gain.setValueAtTime(natureGain.gain.value, ctx.currentTime);
    natureGain.gain.linearRampToValueAtTime(0.60, ctx.currentTime + duration); // Natural woodland frogs and rustles
  }
};

// Interactive sound effects
// 1. Firefly Captured Feedback: Sucking glowing energy (Resonant sweep)
export const playGrabSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Resonant sweep sound
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);

    // Warm harmonics
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(160, now);
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.45);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    filter.Q.setValueAtTime(3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    osc2.start(now);
    osc2.stop(now + 0.55);
  } catch (e) {
    console.warn("Grab sound synth bypass:", e);
  }
};

// 2. Firefly Release Feedback (Pentatonic chime cascade and scatter sweep)
export const playReleaseSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Play a shiny 3-note magical pentatonic scale (E5, A5, B5)
    const tones = [659.25, 880.00, 987.77];
    
    tones.forEach((freq, idx) => {
      const toneStart = now + idx * 0.08;
      
      const vco = ctx.createOscillator();
      vco.type = "sine";
      vco.frequency.setValueAtTime(freq, toneStart);
      
      const vibrato = ctx.createOscillator();
      vibrato.frequency.setValueAtTime(12, toneStart);
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.setValueAtTime(15, toneStart);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(vco.frequency);
      vibrato.start(toneStart);
      vibrato.stop(toneStart + 0.8);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq * 1.5, toneStart);
      filter.Q.setValueAtTime(4, toneStart);

      const vca = ctx.createGain();
      vca.gain.setValueAtTime(0, toneStart);
      vca.gain.linearRampToValueAtTime(0.12, toneStart + 0.03);
      vca.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.6);

      vco.connect(filter);
      filter.connect(vca);
      vca.connect(ctx.destination);

      vco.start(toneStart);
      vco.stop(toneStart + 0.7);
    });

    // Breath-like wave sweep (scatter overlay)
    const noise = ctx.createBufferSource();
    const bufferSize = 0.5 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.4);
  } catch (e) {
    console.warn("Release sound synth bypass:", e);
  }
};

export const stopAllAmbientSynth = () => {
  if (cricketInterval) {
    clearInterval(cricketInterval);
    cricketInterval = null;
  }
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
  if (natureInterval) {
    clearInterval(natureInterval);
    natureInterval = null;
  }
  
  if (rainGain) {
    try { rainGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (forestGain) {
    try { forestGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (windGain) {
    try { windGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (musicGain) {
    try { musicGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (natureGain) {
    try { natureGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
};
