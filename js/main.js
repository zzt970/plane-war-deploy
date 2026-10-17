/* 启动与主循环：缩放、场景调度、UI 联动 */
(function (global) {
  'use strict';
  var PW = global.PW;
  var U = PW.U;

  var canvas, ctx, scene, bgTime = 0, decor = [];
  var lastOpts = null;
  var pausedByKey = false;

  function toLogical(cx, cy) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) / r.width * PW.VIEW.w,
      y: (cy - r.top) / r.height * PW.VIEW.h
    };
  }

  /* ---------------- 缩放 ---------------- */
  function resize() {
    var vw = global.innerWidth, vh = global.innerHeight;
    var pad = vw < 560 ? 6 : 18;
    var scale = Math.min((vw - pad) / PW.VIEW.w, (vh - pad) / PW.VIEW.h);
    scale = Math.max(0.3, scale);
    var cssW = Math.round(PW.VIEW.w * scale), cssH = Math.round(PW.VIEW.h * scale);
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(PW.VIEW.w * dpr);
    canvas.height = Math.round(PW.VIEW.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PW.BG.resize(PW.VIEW.w, PW.VIEW.h);
  }

  /* ---------------- 设置应用 ---------------- */
  function applySettings() {
    var s = PW.Store.settings();
    PW.Audio.setSfx(s.sfx);
    PW.Audio.setBgm(s.bgm);
    PW.Audio.setBgmOn(s.bgmOn);
    PW.Input.setScheme(s.control);
    PW.BG.setQuality(s.quality);
    if (scene) scene.setQuality(s.quality);
  }

  /* ---------------- 开局 ---------------- */
  function startGame(opts) {
    opts = opts || {};
    lastOpts = {
      level: opts.level || 1,
      endless: !!opts.endless,
      daily: !!opts.daily,
      mods: opts.mods || []
    };
    var s = PW.Store.settings();
    var prog = PW.Store.progress();

    var themeId = s.autoTheme ? PW.THEMES[Math.floor(Math.random() * PW.THEMES.length)].id : s.theme;
    PW.UI.applyTheme(themeId);

    PW.UI.hideMenu();
    PW.UI.hideResult();
    PW.UI.hidePause();
    pausedByKey = false;

    applySettings();
    scene.setQuality(s.quality);
    scene.start({
      level: opts.level || 1,
      endless: !!opts.endless,
      daily: !!opts.daily,
      mods: opts.mods || [],
      plane: prog.selectedPlane,
      diff: s.diff,
      cb: {
        onEnd: function (r) { PW.UI.showResult(r); },
        onAchieve: function (id) { PW.UI.achToast(id); },
        sfx: function (n) { PW.Audio.play(n); }
      }
    });
  }

  function togglePause(force) {
    if (!scene.running) return;
    var want = force === undefined ? !scene.paused : force;
    if (want === scene.paused) return;
    if (want) { scene.pause(); PW.UI.showPause(); }
    else { scene.resume(); PW.UI.hidePause(); }
  }

  /* ---------------- 菜单装饰 ---------------- */
  function initDecor() {
    decor = [];
    for (var i = 0; i < 7; i++) {
      decor.push({
        x: U.rand(30, PW.VIEW.w - 30), y: U.rand(-400, PW.VIEW.h),
        sp: U.rand(18, 52), r: U.rand(10, 20),
        c: ['#00F0FF', '#00FF88', '#B026FF', '#FF2E88'][i % 4], t: U.rand(0, 6.28)
      });
    }
  }
  function renderDecor(g, dt) {
    for (var i = 0; i < decor.length; i++) {
      var d = decor[i];
      d.y += d.sp * dt; d.t += dt;
      if (d.y > PW.VIEW.h + 40) { d.y = -40; d.x = U.rand(30, PW.VIEW.w - 30); }
      g.save();
      g.globalAlpha = 0.24;
      g.strokeStyle = d.c; g.lineWidth = 1.4;
      g.translate(d.x + Math.sin(d.t * 0.8) * 12, d.y);
      g.beginPath();
      g.moveTo(0, d.r); g.lineTo(-d.r * 0.8, -d.r * 0.6); g.lineTo(0, -d.r * 0.25); g.lineTo(d.r * 0.8, -d.r * 0.6);
      g.closePath(); g.stroke();
      g.restore();
    }
  }

  /* ---------------- 主循环 ---------------- */
  var last = 0;
  function loop(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    bgTime += dt;

    // 暂停键
    if (PW.Input.take('pause')) togglePause();

    if (scene.running && !scene.paused) scene.update(dt);

    ctx.clearRect(0, 0, PW.VIEW.w, PW.VIEW.h);
    // 游戏中、暂停中、结算展示时都渲染游戏画面（暂停/结算为静止帧）
    var resultOpen = PW.UI.el.result && !PW.UI.el.result.classList.contains('hidden');
    if (scene.running || resultOpen) {
      scene.render();
    } else {
      PW.BG.render(ctx, bgTime, dt);
      renderDecor(ctx, dt);
    }
    global.requestAnimationFrame(loop);
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    if (!canvas || !ctx) {
      document.getElementById('boot').innerHTML = '<div class="boot-text">CANVAS 不可用</div>';
      return;
    }

    scene = new PW.Scene(canvas);
    scene.g = ctx;

    resize();
    global.addEventListener('resize', resize);
    global.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

    PW.Input.bind(canvas, toLogical);
    PW.Input.onAnyKey(function () { PW.Audio.unlock(); });

    // 移动端虚拟按钮
    canvas.addEventListener('touchstart', function (e) {
      if (PW.Input.scheme !== 'touch' || !scene.btns.length) return;
      var t = e.changedTouches[0];
      var p = toLogical(t.clientX, t.clientY);
      var hit = scene.hitButton(p.x, p.y);
      if (!hit) return;
      PW.Audio.unlock();
      if (hit === 'pause') togglePause();
      else PW.Input.press(hit);
      PW.Input.clearDrag();
    }, true);

    // 点击画布解锁音频
    canvas.addEventListener('mousedown', function () { PW.Audio.unlock(); });

    /* 最小公开 API：便于调试与自动化测试 */
    PW.Main = {
      start: startGame,
      pause: togglePause,
      quit: function () { PW.UI.hooks.toMenu(); },
      scene: function () { return scene; }
    };

    PW.UI.init({
      start: startGame,
      resume: function () { togglePause(false); },
      restart: function () {
        PW.UI.hidePause();
        startGame(lastOpts || { level: 1 });
      },
      toMenu: function () {
        scene.stop();
        togglePause(false);
        PW.UI.toMenu();
        var s = PW.Store.settings();
        PW.UI.applyTheme(s.autoTheme ? PW.THEMES[0].id : s.theme);
      },
      revive: function () {
        PW.UI.hideResult();
        if (scene.revive()) { scene.running = true; }
      },
      next: function () {
        startGame({ level: Math.min(PW.MAX_LEVEL, (lastOpts ? lastOpts.level : 1) + 1) });
      },
      again: function () {
        startGame(lastOpts || { level: 1 });
      },
      applySettings: applySettings
    });

    applySettings();
    initDecor();

    document.getElementById('boot').classList.add('hidden');
    PW.UI.toMenu();

    global.requestAnimationFrame(loop);
    console.log('[PlaneWar] 霓虹之翼 NEON WINGS 已启动 v2.1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})(window);
