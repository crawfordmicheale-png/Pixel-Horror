/* audio.js — fully procedural sound via Web Audio API.
   No audio files: the dread is synthesized (drones, hull groans, beeps,
   heartbeat, stingers) so the game stays self-contained. Must be started
   from a user gesture (the BOOT button), per browser autoplay rules. */
(function () {
  "use strict";
  const AURORA = window.AURORA;

  const A = (AURORA.audio = {});
  let ctx = null;
  let master = null;
  let droneGain = null;
  let started = false;
  let tensionTarget = 0; // 0..1, how "hunted" the player is
  let tension = 0;

  A.start = function () {
    if (started) return;
    started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no audio available; game still runs silently
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    buildDrone();
    tick();
  };

  A.resume = function () {
    if (ctx && ctx.state === "suspended") ctx.resume();
  };

  // Low, evolving reactor drone — two detuned oscillators through a slow filter.
  function buildDrone() {
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 220;
    filt.Q.value = 3;
    droneGain.connect(filt);
    filt.connect(master);

    [55, 55.4, 82.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.35 : 0.6;
      o.connect(g);
      g.connect(droneGain);
      o.start();
    });

    // Slow LFO on filter cutoff for a breathing feel.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);
    lfo.start();

    A._filt = filt;
  }

  function noiseBuffer(dur) {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Terminal / UI blip.
  A.beep = function (freq = 660, dur = 0.06, vol = 0.15) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  };

  A.error = function () {
    A.beep(180, 0.18, 0.2);
    setTimeout(() => A.beep(140, 0.22, 0.2), 90);
  };

  A.confirm = function () {
    A.beep(520, 0.07, 0.14);
    setTimeout(() => A.beep(780, 0.1, 0.14), 80);
  };

  // Metallic hull groan — filtered noise sweep.
  A.groan = function () {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.4);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(90, ctx.currentTime);
    filt.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 2.0);
    filt.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.6);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 2.4);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + 2.4);
  };

  // Distant clang / drip / footstep-in-the-dark.
  A.clang = function () {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(AURORA.util.rand(200, 500), ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.4);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.5);
  };

  // Sharp stinger when the presence sees / grabs you.
  A.stinger = function () {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.8);
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + 0.8);

    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(1200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.7);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    o.connect(g2);
    g2.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.7);
  };

  // Tension controls a heartbeat + a rising high tone.
  let heartOsc = null,
    heartGain = null,
    dreadOsc = null,
    dreadGain = null;

  function ensureTensionVoices() {
    if (heartGain) return;
    heartGain = ctx.createGain();
    heartGain.gain.value = 0;
    heartGain.connect(master);

    dreadGain = ctx.createGain();
    dreadGain.gain.value = 0;
    dreadGain.connect(master);
    dreadOsc = ctx.createOscillator();
    dreadOsc.type = "sine";
    dreadOsc.frequency.value = 1400;
    dreadOsc.connect(dreadGain);
    dreadOsc.start();
  }

  function heartbeat() {
    if (!ctx || tension < 0.05) return;
    ensureTensionVoices();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(60, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.14);
    const vol = 0.05 + tension * 0.28;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    // second thump
    setTimeout(() => {
      if (!ctx) return;
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "sine";
      o2.frequency.setValueAtTime(52, ctx.currentTime);
      o2.frequency.exponentialRampToValueAtTime(34, ctx.currentTime + 0.14);
      g2.gain.setValueAtTime(vol * 0.8, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o2.connect(g2);
      g2.connect(master);
      o2.start();
      o2.stop(ctx.currentTime + 0.2);
    }, 170);
  }

  A.setTension = function (v) {
    tensionTarget = AURORA.util.clamp(v, 0, 1);
  };

  // Duck the drone slightly when reading a log, etc.
  A.duck = function (on) {
    if (droneGain) droneGain.gain.value = on ? 0.05 : 0.12;
  };

  let lastBeat = 0;
  function tick() {
    if (!ctx) return;
    tension += (tensionTarget - tension) * 0.05;

    // heartbeat rate scales with tension
    const now = performance.now();
    const interval = AURORA.util.lerp(1100, 430, tension);
    if (tension > 0.05 && now - lastBeat > interval) {
      heartbeat();
      lastBeat = now;
    }

    // dread tone rises with tension
    if (dreadGain) dreadGain.gain.value = tension * 0.02;
    if (A._filt) A._filt.frequency.value = 220 + tension * 500;

    // occasional random ambient events at low tension
    requestAnimationFrame(tick);
  }

  // Ambient random events driven by the game loop calling this occasionally.
  A.ambientRoll = function () {
    if (!ctx) return;
    const r = Math.random();
    if (r < 0.35) A.groan();
    else if (r < 0.7) A.clang();
  };

  A.isReady = () => !!ctx;
})();
