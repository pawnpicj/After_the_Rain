export function makeSound() {
  let context;
  let noise;
  let master;

  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.25;
      master.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const rain = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const volume = context.createGain();
      rain.buffer = noise;
      rain.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 1450;
      volume.gain.value = 0.13;
      rain.connect(filter).connect(volume).connect(master);
      rain.start();
    }
    context.resume().catch(() => {});
  }

  function play(kind, slow = false) {
    if (!context || context.state !== 'running') return;
    const [pitch, tail, level, useNoise] = {
      shot: [1000, 0.16, 1.05, true],
      enemy: [640, 0.2, 0.38, true],
      impact: [370, 0.12, 0.39, true],
      reload: [2750, 0.07, 0.45, true],
      empty: [176, 0.07, 0.13, false],
      dive: [210, 0.39, 0.29, true],
      clear: [420, 0.55, 0.23, false],
    }[kind];
    const now = context.currentTime;
    const length = tail * (slow ? 1.45 : 1);
    const frequency = pitch * (slow ? 0.55 : 1);
    const volume = context.createGain();
    volume.gain.setValueAtTime(level, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + length);
    volume.connect(master);
    if (useNoise) {
      const burst = context.createBufferSource();
      const filter = context.createBiquadFilter();
      burst.buffer = noise;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(frequency * 2, now);
      filter.frequency.exponentialRampToValueAtTime(frequency * 0.35, now + length);
      burst.connect(filter).connect(volume);
      burst.start();
      burst.stop(now + length);
      burst.onended = () => volume.disconnect();
    } else {
      const tone = context.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(frequency, now);
      tone.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + length);
      tone.connect(volume);
      tone.start();
      tone.stop(now + length);
      tone.onended = () => volume.disconnect();
    }
  }
  function startSiren(seconds) {
    const start = context.currentTime;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2100;
    const volume = context.createGain();
    filter.connect(volume).connect(master);
    const voices = [
      { type: 'sawtooth', ratio: 1, level: 0.74 },
      { type: 'triangle', ratio: 1.5, level: 0.36 },
    ].map(({ type, ratio, level }) => {
      const tone = context.createOscillator();
      tone.type = type;
      const mix = context.createGain();
      mix.gain.value = level;
      tone.connect(mix).connect(filter);
      return { tone, mix, ratio, ended: false };
    });

    for (let offset = 0; offset < seconds; offset += 1.24) {
      const at = start + offset;
      const length = Math.min(1.13, seconds - offset);
      for (const { tone, ratio } of voices) {
        tone.frequency.setValueAtTime(425 * ratio, at);
        tone.frequency.exponentialRampToValueAtTime(865 * ratio, at + length * 0.48);
        tone.frequency.exponentialRampToValueAtTime(465 * ratio, at + length);
      }
      volume.gain.setValueAtTime(0.001, at);
      volume.gain.linearRampToValueAtTime(0.88, at + length * 0.12);
      volume.gain.linearRampToValueAtTime(0.62, at + length * 0.82);
      volume.gain.linearRampToValueAtTime(0.001, at + length);
    }
    for (const voice of voices) {
      voice.tone.onended = () => {
        voice.ended = true;
        voice.tone.disconnect();
        voice.mix.disconnect();
        if (voices.every(item => item.ended)) {
          filter.disconnect();
          volume.disconnect();
        }
      };
      voice.tone.start(start);
      voice.tone.stop(start + seconds);
    }
    return () => {
      const active = voices.filter(voice => !voice.ended);
      if (!active.length) return;
      const now = context.currentTime;
      volume.gain.cancelScheduledValues(now);
      volume.gain.setTargetAtTime(0.001, now, 0.008);
      for (const { tone } of active) tone.stop(now + 0.04);
    };
  }

  function playAlarm(seconds) {
    if (!context || seconds <= 0) return;
    if (context.state === 'running') return startSiren(seconds);

    let cancelled = false;
    let stop;
    context.resume().then(() => {
      if (!cancelled) stop = startSiren(seconds);
    }).catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }

  return { unlock, play, playAlarm };
}
