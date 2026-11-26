// Tidewater Airlift — synthesized sound: no audio files, everything is
// generated with the Web Audio API, so the game stays offline and self-contained.
// One file, one job: engine hum, wind, chimes, thuds and fanfares.

export function createAudio() {
  const audio = {
    ctx: null, master: null, engineOsc: null, engineGain: null, windGain: null,
    muted: false, started: false,
  };

  function ensure() {
    if (audio.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine: a low sawtooth through a low-pass filter.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Wind: looped noise through a band-pass.
      const len = audio.ctx.sampleRate * 2;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = audio.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = audio.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      noise.connect(bp);
      bp.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      noise.start();
      audio.started = true;
    } catch (e) {
      audio.ctx = null;
    }
  }

  function unlock() {
    ensure();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock,
    setMuted(m) {
      audio.muted = m;
      if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return audio.muted; },
    // Called every frame with the plane's state.
    update(throttle, speed, flying) {
      if (!audio.ctx || audio.muted) return;
      const t = audio.ctx.currentTime;
      audio.engineGain.gain.setTargetAtTime(flying ? 0.02 + throttle * 0.05 : 0, t, 0.1);
      audio.engineOsc.frequency.setTargetAtTime(55 + throttle * 75 + speed * 0.4, t, 0.1);
      audio.windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.0012) : 0, t, 0.2);
    },
    ring() { tone(880, 0.18); tone(1318, 0.28, 'sine', 0.2, 0.07); },
    thud() { tone(70, 0.25, 'sine', 0.4); tone(50, 0.3, 'triangle', 0.3, 0.02); },
    crash() {
      if (!audio.ctx || audio.muted) return;
      const t0 = audio.ctx.currentTime;
      const len = audio.ctx.sampleRate * 0.6;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g); g.connect(audio.master);
      src.start(t0);
      tone(55, 0.7, 'sine', 0.4);
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, i * 0.12));
    },
    click() { tone(660, 0.06, 'square', 0.08); },
  };
}
