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
  
  if (rainGain) {
    try { rainGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (forestGain) {
    try { forestGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
  if (windGain) {
    try { windGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0); } catch (e){}
  }
};
