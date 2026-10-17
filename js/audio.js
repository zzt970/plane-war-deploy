/* 音频：WebAudio 实时合成，无外部音频文件。
 * 音效柔和化处理：正弦/三角为主、慢起音、低通滤波，避免刺耳。
 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});

  var ctx = null, master = null, sfxGain = null, bgmGain = null;
  var ready = false, muted = false;
  var vol = { sfx: 0.7, bgm: 0.45 };
  var bgmTimer = null, bgmStep = 0, bgmOn = true;

  function ensure() {
    if (ready) return true;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = vol.sfx; sfxGain.connect(master);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(master);
    ready = true;
    return true;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  /* 单音：freq 频率，dur 时长，type 波形，peak 峰值，attack 起音，filter 低通截止 */
  function tone(o) {
    if (!ready || muted) return;
    var t = now();
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.dur || 0.15));

    var peak = (o.peak === undefined ? 0.3 : o.peak);
    var atk = o.attack === undefined ? 0.008 : o.attack;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.15));

    var node = osc;
    if (o.lp) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.lp;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.bus === 'bgm' ? bgmGain : sfxGain);
    osc.start(t);
    osc.stop(t + (o.dur || 0.15) + 0.02);
  }

  /* 噪声爆裂（爆炸 / 击中），带低通 */
  function noise(o) {
    if (!ready || muted) return;
    var t = now();
    var dur = o.dur || 0.2;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = o.hp ? 'highpass' : 'lowpass';
    f.frequency.value = o.cut || 900;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, o.sweep), t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.peak === undefined ? 0.25 : o.peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  var SFX = {
    shoot: function () { tone({ freq: 760, to: 460, dur: 0.07, type: 'triangle', peak: 0.10, lp: 2600 }); },
    enemyShoot: function () { tone({ freq: 300, to: 200, dur: 0.09, type: 'sawtooth', peak: 0.05, lp: 900 }); },
    hit: function () { noise({ dur: 0.07, cut: 2200, sweep: 700, peak: 0.10 }); },
    kill: function () { noise({ dur: 0.20, cut: 1400, sweep: 220, peak: 0.24 }); tone({ freq: 240, to: 90, dur: 0.20, type: 'sine', peak: 0.16 }); },
    bigKill: function () { noise({ dur: 0.42, cut: 1100, sweep: 120, peak: 0.34 }); tone({ freq: 170, to: 55, dur: 0.45, type: 'sine', peak: 0.26 }); },
    hurt: function () { tone({ freq: 200, to: 70, dur: 0.30, type: 'square', peak: 0.16, lp: 700 }); noise({ dur: 0.22, cut: 700, peak: 0.16 }); },
    powerup: function () {
      tone({ freq: 620, to: 940, dur: 0.14, type: 'sine', peak: 0.20 });
      setTimeout(function () { tone({ freq: 940, to: 1300, dur: 0.14, type: 'sine', peak: 0.16 }); }, 70);
    },
    bomb: function () { noise({ dur: 0.65, cut: 1600, sweep: 90, peak: 0.40 }); tone({ freq: 120, to: 40, dur: 0.6, type: 'sine', peak: 0.3 }); },
    skill: function () {
      tone({ freq: 420, to: 1100, dur: 0.28, type: 'sine', peak: 0.24 });
      tone({ freq: 630, to: 1650, dur: 0.32, type: 'triangle', peak: 0.12, lp: 3200 });
    },
    graze: function () { tone({ freq: 1500, to: 1900, dur: 0.05, type: 'sine', peak: 0.055, lp: 4000 }); },
    laser: function () { tone({ freq: 1200, to: 300, dur: 0.45, type: 'sawtooth', peak: 0.14, lp: 2000 }); },
    warn: function () {
      tone({ freq: 330, dur: 0.22, type: 'square', peak: 0.14, lp: 1100 });
      setTimeout(function () { tone({ freq: 330, dur: 0.22, type: 'square', peak: 0.14, lp: 1100 }); }, 260);
    },
    victory: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { tone({ freq: f, dur: 0.34, type: 'sine', peak: 0.24, attack: 0.02 }); }, i * 130);
      });
    },
    over: function () {
      [440, 370, 294, 220].forEach(function (f, i) {
        setTimeout(function () { tone({ freq: f, dur: 0.42, type: 'triangle', peak: 0.22, lp: 1400, attack: 0.03 }); }, i * 190);
      });
    },
    click: function () { tone({ freq: 880, dur: 0.05, type: 'sine', peak: 0.10 }); },
    lock: function () { tone({ freq: 200, dur: 0.12, type: 'square', peak: 0.10, lp: 700 }); },
    achieve: function () {
      [784, 988, 1319].forEach(function (f, i) {
        setTimeout(function () { tone({ freq: f, dur: 0.3, type: 'sine', peak: 0.20, attack: 0.02 }); }, i * 110);
      });
    }
  };

  /* ---------------- BGM：8 步循环音序 ---------------- */
  var SCALE = [0, 3, 5, 7, 10, 12, 15, 12]; // 小调五声，听感偏冷峻
  var ROOT = 110;

  function bgmTick() {
    if (!ready || muted || !bgmOn) return;
    var s = SCALE[bgmStep % SCALE.length];
    var f = ROOT * Math.pow(2, s / 12);
    // 低音
    tone({ freq: f, dur: 0.30, type: 'triangle', peak: 0.16, lp: 700, bus: 'bgm', attack: 0.02 });
    // 琶音
    if (bgmStep % 2 === 1) {
      tone({ freq: f * 4, dur: 0.18, type: 'sine', peak: 0.07, lp: 2600, bus: 'bgm', attack: 0.01 });
    }
    // 打击点
    if (bgmStep % 4 === 0) noiseHit();
    bgmStep++;
  }
  function noiseHit() {
    if (!ready || muted) return;
    var t = now(), dur = 0.09;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
    var g = ctx.createGain(); g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bgmGain);
    src.start(t); src.stop(t + dur);
  }

  var A = {
    /* 浏览器要求用户手势后才能出声 */
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (bgmOn && !bgmTimer) {
        bgmTimer = setInterval(bgmTick, 260);
        if (bgmGain) bgmGain.gain.setTargetAtTime(vol.bgm, now(), 0.6);
      }
    },
    play: function (name) {
      if (!ready) return;
      var f = SFX[name];
      if (f) f();
    },
    setSfx: function (v) { vol.sfx = v; if (sfxGain) sfxGain.gain.value = v; },
    setBgm: function (v) { vol.bgm = v; if (bgmGain && bgmOn) bgmGain.gain.setTargetAtTime(v, now(), 0.2); },
    setBgmOn: function (on) {
      bgmOn = !!on;
      if (!ready) return;
      if (on) {
        if (!bgmTimer) { bgmStep = 0; bgmTimer = setInterval(bgmTick, 260); }
        bgmGain.gain.setTargetAtTime(vol.bgm, now(), 0.4);
      } else {
        bgmGain.gain.setTargetAtTime(0, now(), 0.2);
        if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
      }
    },
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.1);
    },
    get ready() { return ready; }
  };

  PW.Audio = A;
})(window);
