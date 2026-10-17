/* UI：主菜单、各功能面板、暂停、结算。DOM 覆盖层实现，与 Canvas 游戏层解耦。 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});
  var U = PW.U;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  var UI = {
    el: {},
    cur: null,        // 当前面板 id
    pending: null,    // 待提交的排行榜成绩
    lastResult: null,

    init: function (hooks) {
      this.hooks = hooks;
      var e = this.el;
      ['boot', 'menu', 'modal', 'modalTitle', 'modalBody', 'modalFoot', 'modalClose',
        'pause', 'pResume', 'pRestart', 'pMenu', 'result', 'resTitle', 'resScore', 'resNew',
        'resName', 'resInput', 'resOk', 'resStats', 'resExtra', 'resFoot', 'achToast',
        'scoreChip', 'achvBadge',
        'btnStart', 'btnDaily', 'btnEndless', 'fullBtn', 'footInfo', 'stage', 'game'
      ].forEach(function (id) { e[id] = $(id); });

      var self = this;

      // 主菜单按钮
      e.btnStart.addEventListener('click', function () {
        PW.Audio.play('click');
        var p = PW.Store.progress();
        self.startLevel(Math.min(p.unlockedLevels, PW.MAX_LEVEL));
      });
      e.btnEndless.addEventListener('click', function () { PW.Audio.play('click'); self.startEndless(); });
      e.btnDaily.addEventListener('click', function () { PW.Audio.play('click'); self.startDaily(); });

      // 面板入口
      var opens = document.querySelectorAll('[data-open]');
      for (var i = 0; i < opens.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            PW.Audio.play('click');
            self.open(btn.getAttribute('data-open'));
          });
        })(opens[i]);
      }

      e.modalClose.addEventListener('click', function () { PW.Audio.play('click'); self.closeModal(); });
      e.modal.addEventListener('click', function (ev) {
        if (ev.target === e.modal) self.closeModal();
      });

      e.pResume.addEventListener('click', function () { PW.Audio.play('click'); hooks.resume(); });
      e.pRestart.addEventListener('click', function () { PW.Audio.play('click'); hooks.restart(); });
      e.pMenu.addEventListener('click', function () { PW.Audio.play('click'); hooks.toMenu(); });

      e.resOk.addEventListener('click', function () { self.submitRank(); });
      e.resInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') self.submitRank();
        ev.stopPropagation();
      });

      e.fullBtn.addEventListener('click', function () { self.toggleFull(); });

      // Esc 关闭面板
      global.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !e.modal.classList.contains('hidden')) {
          self.closeModal();
        }
      });

      this.applyTheme(PW.Store.settings().theme);
      this.refreshFoot();
      this.refreshBadge();
      this.refreshScore();
    },

    /* ---------------- 主题 ---------------- */
    applyTheme: function (id) {
      var th = PW.getTheme(id);
      var root = document.documentElement.style;
      root.setProperty('--ui', th.ui);
      root.setProperty('--accent', th.accent);
      root.setProperty('--yellow', '#FFE600');
      root.setProperty('--bg0', th.bg[0]);
      PW.BG.setTheme(id);
    },

    refreshFoot: function () {
      /* 按「实际生效」的操控方案给提示（自动模式下手机上不会再显示键盘键位） */
      var sc = PW.Input.scheme;
      var txt = sc === 'mouse'
        ? '鼠标移动 · 左键射击 · X 炸弹 · C 技能 · Esc 暂停'
        : (sc === 'touch'
          ? '手指拖动屏幕移动 · 自动射击 · 右下按钮放炸弹 / 技能'
          : '方向键/WASD 移动 · Shift 慢速 · 空格/Z 射击 · X 炸弹 · C 技能 · Esc 暂停');
      this.el.footInfo.textContent = txt;
    },

    toggleFull: function () {
      var d = document;
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        var el = d.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || function () { }).call(el);
      } else {
        (d.exitFullscreen || d.webkitExitFullscreen || function () { }).call(d);
      }
    },

    /* ---------------- 屏幕切换 ---------------- */
    toMenu: function () {
      hide(this.el.pause); hide(this.el.result); this.closeModal();
      this.refreshBadge();
      this.refreshScore();
      show(this.el.menu);
    },
    hideMenu: function () { hide(this.el.menu); },

    /* 主菜单左上角：累计积分 */
    refreshScore: function () {
      if (this.el.scoreChip) {
        this.el.scoreChip.textContent = '累计积分 ' + U.fmt(PW.Store.totalScore());
      }
    },
    /* 成就按钮角标：待领取奖励的成就个数 */
    refreshBadge: function () {
      var el = this.el.achvBadge;
      if (!el) return;
      var n = PW.Store.pendingAch().length;
      el.textContent = n > 9 ? '9+' : String(n);
      el.classList.toggle('hidden', n === 0);
    },
    showPause: function () { show(this.el.pause); },
    hidePause: function () { hide(this.el.pause); },
    hideResult: function () { hide(this.el.result); },

    /* ---------------- 开局 ---------------- */
    startLevel: function (lv) { this.hooks.start({ level: lv }); },
    startEndless: function () { this.hooks.start({ endless: true, level: 6 }); },
    startDaily: function () {
      var d = PW.Store.dailyInfo();
      var mods = UI.dailyMods();
      var msg = '今日词条：' + mods.map(function (m) { return m.name; }).join(' / ');
      if (d.plays > 0) msg += '<br>今日最佳：<b>' + U.fmt(d.best) + '</b>（可重复挑战刷新纪录）';
      this.open('confirmDaily', { mods: mods, msg: msg });
    },
    dailyMods: function () {
      var seed = U.daySeed();
      var rng = U.seeded(seed);
      var pool = PW.MODIFIERS.slice();
      var out = [], n = 2 + (seed % 2);
      for (var i = 0; i < n && pool.length; i++) {
        var k = Math.floor(rng() * pool.length);
        var m = pool.splice(k, 1)[0];
        // 互斥：同类数值词条只保留一个
        var dup = false;
        for (var j = 0; j < out.length; j++) {
          if ((m.enemyHp && out[j].enemyHp) || (m.hp && out[j].hp)) { dup = true; break; }
        }
        if (dup) { i--; continue; }
        out.push(m);
      }
      return out;
    },

    /* ---------------- 面板 ---------------- */
    open: function (id, extra) {
      var e = this.el;
      this.cur = id;
      var body = '', title = '', foot = '';
      switch (id) {
        case 'levels': title = '关 卡 选 择'; body = this.htmlLevels(); break;
        case 'hangar': title = '机 库'; body = this.htmlHangar(); break;
        case 'ranks': title = '排 行 榜'; body = this.htmlRanks(); break;
        case 'achv': title = '成 就'; body = this.htmlAchv(); break;
        case 'dex': title = '敌 机 图 鉴'; body = this.htmlDex(); break;
        case 'profile': title = '战 绩 档 案'; body = this.htmlProfile(); break;
        case 'settings': title = '设 置'; body = this.htmlSettings(); break;
        case 'help': title = '操 作 说 明'; body = this.htmlHelp(); break;
        case 'confirmDaily':
          title = '每 日 挑 战';
          body = '<p class="hint">' + extra.msg + '</p>';
          foot = '<button class="btn btn-primary" data-act="dailyGo">立即挑战</button><button class="btn" data-act="close">返回</button>';
          this._dailyMods = extra.mods;
          break;
        default: return;
      }
      e.modalTitle.textContent = title;
      e.modalBody.innerHTML = body;
      e.modalFoot.innerHTML = foot;
      e.modalFoot.style.display = foot ? 'flex' : 'none';
      show(e.modal);
      this.bindBody(id);
      e.modalBody.scrollTop = 0;
    },

    closeModal: function () {
      hide(this.el.modal);
      this.cur = null;
    },

    bindBody: function (id) {
      var self = this, b = this.el.modalBody, f = this.el.modalFoot;

      function on(root, sel, fn) {
        var list = root.querySelectorAll(sel);
        for (var i = 0; i < list.length; i++) {
          (function (el) { el.addEventListener('click', function (ev) { fn(el, ev); }); })(list[i]);
        }
      }
      function on2(root, sel, evt, fn) {
        var list = root.querySelectorAll(sel);
        for (var i = 0; i < list.length; i++) {
          (function (el) { el.addEventListener(evt, function (ev) { fn(el, ev); }); })(list[i]);
        }
      }

      /* 关卡 */
      on(b, '[data-lv]', function (el) {
        if (el.classList.contains('locked')) { PW.Audio.play('lock'); return; }
        PW.Audio.play('click');
        self.closeModal();
        self.startLevel(parseInt(el.getAttribute('data-lv'), 10));
      });

      /* 战机 */
      on(b, '[data-plane]', function (el) {
        if (el.classList.contains('locked')) { PW.Audio.play('lock'); return; }
        PW.Audio.play('click');
        PW.Store.selectPlane(el.getAttribute('data-plane'));
        self.open('hangar');
      });

      /* 排行榜切换 */
      on(b, '[data-rank]', function (el) {
        PW.Audio.play('click');
        self._rankKind = el.getAttribute('data-rank');
        self.open('ranks');
      });

      /* 主题 */
      on(b, '[data-theme]', function (el) {
        PW.Audio.play('click');
        var id = el.getAttribute('data-theme');
        PW.Store.setSetting('theme', id);
        self.applyTheme(id);
        self.open('settings');
      });

      /* 难度 / 画质 / 控制 */
      on(b, '[data-diff]', function (el) {
        PW.Audio.play('click');
        PW.Store.setSetting('diff', el.getAttribute('data-diff'));
        self.open('settings');
      });
      on(b, '[data-quality]', function (el) {
        PW.Audio.play('click');
        PW.Store.setSetting('quality', el.getAttribute('data-quality'));
        self.hooks.applySettings();
        self.open('settings');
      });
      on(b, '[data-control]', function (el) {
        PW.Audio.play('click');
        PW.Store.setSetting('control', el.getAttribute('data-control'));
        self.hooks.applySettings();
        self.refreshFoot();
        self.open('settings');
      });

      /* 开关 */
      on(b, '[data-toggle]', function (el) {
        var k = el.getAttribute('data-toggle');
        var s = PW.Store.settings();
        var v = !s[k];
        PW.Store.setSetting(k, v);
        PW.Audio.play('click');
        self.hooks.applySettings();
        self.open('settings');
      });

      /* 成就奖励领取（手动入账） */
      on(b, '[data-claim]', function (el) {
        var id = el.getAttribute('data-claim');
        var gain = PW.Store.claimAch(id);
        if (gain > 0) {
          PW.Audio.play('achieve');
          self.achToast(id, '奖励 +' + U.fmt(gain) + ' 已入账');
          self.refreshBadge();
          self.refreshScore();
        }
        self.open('achv');            // 重绘面板（按钮变为「已领取」）
      });

      /* 滑杆 */
      on2(b, '[data-range]', 'input', function (el) {
        var k = el.getAttribute('data-range');
        var v = parseFloat(el.value);
        PW.Store.setSetting(k, v);
        if (k === 'sfx') PW.Audio.setSfx(v);
        if (k === 'bgm') PW.Audio.setBgm(v);
      });

      /* 数据 */
      on(b, '[data-act]', function (el) {
        var a = el.getAttribute('data-act');
        if (a === 'export') self.doExport(el);
        else if (a === 'import') self.doImport();
        else if (a === 'reset') self.doReset();
        else if (a === 'dailyGo') {
          PW.Audio.play('click');
          self.closeModal();
          self.hooks.start({ daily: true, level: 4, mods: self._dailyMods || [] });
        } else if (a === 'close') self.closeModal();
      });

      on(f, '[data-act]', function (el) {
        var a = el.getAttribute('data-act');
        if (a === 'close') self.closeModal();
        else if (a === 'dailyGo') {
          PW.Audio.play('click');
          self.closeModal();
          self.hooks.start({ daily: true, level: 4, mods: self._dailyMods || [] });
        }
      });
    },

    /* ---------------- 各面板 HTML ---------------- */
    htmlLevels: function () {
      var p = PW.Store.progress(), h = '';
      h += '<p class="hint">通关后自动解锁下一关。当前难度：<b>' + PW.getDiff(PW.Store.settings().diff).name + '</b>'
        + '（得分 ×' + PW.getDiff(PW.Store.settings().diff).score + '）</p>';
      for (var i = 0; i < PW.LEVELS.length; i++) {
        var L = PW.LEVELS[i];
        var locked = L.id > p.unlockedLevels;
        var best = p.levelBest[L.id] || 0;
        h += '<div class="item' + (locked ? ' locked' : '') + '" data-lv="' + L.id + '">'
          + '<span class="idx">' + (locked ? '--' : String(L.id).padStart(2, '0')) + '</span>'
          + '<span class="grow"><span class="t">' + esc(L.name) + '</span>'
          + '<span class="d">BOSS：' + esc(PW.getBoss(L.boss).name) + ' · 时长 ' + L.dur + 's'
          + (best ? ' · 最佳 <b>' + U.fmt(best) + '</b>' : '') + '</span></span>'
          + '<span class="v">' + (locked ? '未解锁' : (best ? U.fmt(best) : '未挑战')) + '</span></div>';
      }
      return h;
    },

    htmlHangar: function () {
      var p = PW.Store.progress(), total = PW.Store.totalScore();
      var h = '<p class="hint">累计总分 <b>' + U.fmt(total) + '</b>，达到分数门槛自动解锁新战机。</p><div class="cards">';
      for (var i = 0; i < PW.PLANES.length; i++) {
        var pl = PW.PLANES[i];
        var owned = p.unlockedPlanes.indexOf(pl.id) >= 0;
        var on = p.selectedPlane === pl.id;
        h += '<div class="card' + (on ? ' on' : '') + (owned ? '' : ' locked') + '" data-plane="' + pl.id + '">'
          + '<div class="swatch" style="background:' + pl.color + ';box-shadow:0 0 12px ' + pl.color + '"></div>'
          + '<div class="cn" style="color:' + pl.color + '">' + esc(pl.name) + (on ? ' <span class="tag on">出战中</span>' : '') + '</div>'
          + '<div class="cd">' + esc(pl.desc) + '</div>'
          + this.statBar('速度', pl.speed, 500)
          + this.statBar('装甲', pl.maxHp, 6)
          + this.statBar('射速', pl.fireRateMult * 100, 160)
          + this.statBar('伤害', pl.damageMult * 100, 130)
          + '<div class="cs">技能：' + esc(pl.skill.name) + '</div>'
          + '<div class="cd" style="min-height:0;margin-top:2px">' + esc(pl.skill.desc) + ' · CD ' + pl.skill.cd + 's</div>'
          + (owned ? '' : '<div class="lockmsg">还差 <b>' + U.fmt(Math.max(0, pl.unlock - total))
            + '</b> 分解锁（' + U.fmt(Math.min(total, pl.unlock)) + ' / ' + U.fmt(pl.unlock) + '）</div>'
            + '<span class="sb" style="display:block;margin-top:4px"><i style="width:'
            + U.clamp(total / pl.unlock, 0, 1) * 100 + '%"></i></span>')
          + '</div>';
      }
      return h + '</div>';
    },
    statBar: function (name, v, max) {
      var pct = U.clamp(v / max, 0.08, 1) * 100;
      return '<div class="stats-row"><span class="sn">' + name + '</span><span class="sb"><i style="width:' + pct.toFixed(0) + '%"></i></span></div>';
    },

    htmlRanks: function () {
      var kind = this._rankKind || 'campaign';
      var h = '<div class="seg"><button class="' + (kind === 'campaign' ? 'on' : '') + '" data-rank="campaign">战役榜</button>'
        + '<button class="' + (kind === 'endless' ? 'on' : '') + '" data-rank="endless">无尽榜</button></div>';
      var list = PW.Store.ranks(kind);
      if (!list.length) return h + '<div class="empty">暂无记录，快去创造第一个传奇吧！</div>';
      h += '<table class="rank"><tr><th>排名</th><th>玩家</th><th>关卡</th><th style="text-align:right">分数</th></tr>';
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        h += '<tr><td class="rk">' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>'
          + (r.lv ? ('LV.' + r.lv) : '-') + '</td><td class="rs">' + U.fmt(r.score) + '</td></tr>';
      }
      return h + '</table>';
    },

    htmlAchv: function () {
      var p = PW.Store.progress();
      var got = p.achievements;
      var pending = PW.Store.pendingAch();
      var pendScore = 0;
      pending.forEach(function (id) {
        for (var i = 0; i < PW.ACHIEVEMENTS.length; i++) {
          if (PW.ACHIEVEMENTS[i].id === id) { pendScore += PW.ACHIEVEMENTS[i].reward || 0; break; }
        }
      });
      var h = '<p class="hint">已解锁 <b>' + got.length + ' / ' + PW.ACHIEVEMENTS.length + '</b>'
        + (pending.length
          ? ' · <b style="color:var(--accent)">' + pending.length + ' 个奖励待领取（共 ' + U.fmt(pendScore) + ' 分）</b>，点击右侧「领取」手动入账'
          : ' · 奖励已全部领取')
        + ' · 已累计 <b>' + U.fmt(p.achScore || 0) + '</b> 分（计入累计总分，可用于解锁战机）</p>';
      for (var i = 0; i < PW.ACHIEVEMENTS.length; i++) {
        var a = PW.ACHIEVEMENTS[i];
        var on = got.indexOf(a.id) >= 0;
        var canClaim = on && p.claimed.indexOf(a.id) < 0;
        var claimed = on && p.claimed.indexOf(a.id) >= 0;
        h += '<div class="item' + (on ? ' on' : '') + '" style="cursor:default">'
          + '<span class="idx">' + (on ? '★' : '☆') + '</span>'
          + '<span class="grow"><span class="t">' + esc(a.name) + '</span><span class="d">' + esc(a.desc) + '</span></span>';
        if (canClaim) {
          h += '<button class="claim-btn" data-claim="' + a.id + '">领取 +' + U.fmt(a.reward || 0) + '</button>';
        } else if (claimed) {
          h += '<span class="claimed-tag">已领取</span>';
        } else {
          h += '<span style="color:' + PW.BG.theme.accent + ';font-weight:700;font-size:12px">+' + U.fmt(a.reward || 0) + '</span>';
        }
        h += '</div>';
      }
      return h;
    },

    htmlDex: function () {
      var p = PW.Store.progress();
      var h = '<p class="hint">击落过的敌机会自动收录。已收录 <b>' + p.dex.length + ' / 8</b></p>';
      for (var i = 0; i < PW.ENEMY_IDS.length; i++) {
        var id = PW.ENEMY_IDS[i], e = PW.ENEMIES[id];
        var known = p.dex.indexOf(id) >= 0;
        h += '<div class="item' + (known ? '' : ' locked') + '" style="cursor:default">'
          + '<span class="idx" style="color:' + (known ? e.color : '') + '">' + (known ? '◈' : '?') + '</span>'
          + '<span class="grow"><span class="t">' + (known ? esc(e.name) : '未 知 机 型') + '</span>'
          + '<span class="d">' + (known ? esc(e.tip) : '在战场上击落它以收录') + '</span></span>'
          + '<span class="v">' + (known ? ('HP ' + e.hp + ' · ' + e.score + '分') : '') + '</span></div>';
      }
      return h;
    },

    htmlProfile: function () {
      var p = PW.Store.progress(), s = p.stats;
      var acc = s.shots ? (s.hits / s.shots * 100) : 0;
      var d = PW.Store.dailyInfo();
      var h = '<div class="stat-grid">'
        + this.statBox(U.fmt(s.plays), '出击次数')
        + this.statBox(U.fmt(s.kills), '累计击落')
        + this.statBox(U.fmt(s.bossKills), 'BOSS 击破')
        + this.statBox(U.fmt(s.grazes), '累计擦弹')
        + this.statBox(U.fmt(s.bestCombo), '最长连击')
        + this.statBox(acc.toFixed(1) + '%', '命中率')
        + this.statBox(U.fmt(s.clears), '通关次数')
        + this.statBox(U.time(s.totalTime), '总飞行时长')
        + this.statBox(U.fmt(PW.Store.totalScore()), '累计总分')
        + '</div>';
      h += '<p class="hint" style="margin-top:14px">每日挑战（' + d.date + '）：'
        + (d.plays ? '已挑战 ' + d.plays + ' 次，最佳 <b>' + U.fmt(d.best) + '</b>' : '今日尚未挑战') + '</p>';
      h += '<p class="hint">当前难度：<b>' + PW.getDiff(PW.Store.settings().diff).name + '</b> · 最高解锁关卡：<b>LV.'
        + p.unlockedLevels + '</b> · 已解锁战机：<b>' + p.unlockedPlanes.length + '/6</b></p>';
      return h;
    },
    statBox: function (v, l) {
      return '<div class="s"><div class="sv">' + v + '</div><div class="sl">' + l + '</div></div>';
    },

    htmlSettings: function () {
      var s = PW.Store.settings();
      var h = '';

      /* 背景主题 */
      h += '<p class="hint" style="margin-bottom:6px">背景主题（共 6 套，可随时切换）</p><div class="cards">';
      for (var i = 0; i < PW.THEMES.length; i++) {
        var t = PW.THEMES[i];
        h += '<div class="card' + (s.theme === t.id ? ' on' : '') + '" data-theme="' + t.id + '">'
          + '<div class="swatch" style="height:26px;margin:-10px -10px 8px;background:linear-gradient(180deg,'
          + t.bg[0] + ',' + t.bg[1] + ' 55%,' + t.bg[2] + ')"></div>'
          + '<div class="cn">' + esc(t.name) + '</div><div class="cd">' + esc(t.desc) + '</div></div>';
      }
      h += '</div>';

      h += this.toggleRow('autoTheme', '每关随机主题', '开局时随机挑选一套背景，增加新鲜感', s.autoTheme);

      /* 难度 */
      h += '<p class="hint" style="margin:14px 0 6px">难度</p><div class="seg">';
      for (var d = 0; d < PW.DIFFS.length; d++) {
        var df = PW.DIFFS[d];
        h += '<button class="' + (s.diff === df.id ? 'on' : '') + '" data-diff="' + df.id + '">' + df.name + '</button>';
      }
      h += '</div><p class="hint">' + esc(PW.getDiff(s.diff).desc) + '</p>';

      /* 音频 */
      h += '<p class="hint" style="margin:14px 0 6px">音频</p>';
      h += this.rangeRow('sfx', '音效音量', s.sfx);
      h += this.rangeRow('bgm', '背景音乐', s.bgm);
      h += this.toggleRow('bgmOn', '播放背景音乐', '关闭后只保留音效', s.bgmOn);

      /* 画面 */
      h += '<p class="hint" style="margin:14px 0 6px">画面与操作</p><div class="seg">';
      h += '<button class="' + (s.quality === 'high' ? 'on' : '') + '" data-quality="high">高画质</button>';
      h += '<button class="' + (s.quality === 'low' ? 'on' : '') + '" data-quality="low">流畅</button></div>';
      h += '<div class="seg" style="margin-top:6px">';
      h += '<button class="' + (s.control === 'auto' ? 'on' : '') + '" data-control="auto">自动</button>';
      h += '<button class="' + (s.control === 'keyboard' ? 'on' : '') + '" data-control="keyboard">键盘</button>';
      h += '<button class="' + (s.control === 'mouse' ? 'on' : '') + '" data-control="mouse">鼠标</button>';
      h += '<button class="' + (s.control === 'touch' ? 'on' : '') + '" data-control="touch">触摸</button></div>';
      h += '<p class="hint" style="margin:6px 0 0">自动：触屏设备用拖动，电脑用键盘</p>';
      h += this.toggleRow('autoFire', '自动开火', '关闭后需手动按射击键', s.autoFire);
      h += this.toggleRow('shake', '屏幕震动', '晕动敏感者可关闭', s.shake);

      /* 数据 */
      h += '<p class="hint" style="margin:14px 0 6px">数据</p>';
      h += '<div class="seg" style="margin-bottom:8px">'
        + '<button data-act="export">导出备份</button>'
        + '<button data-act="import">导入备份</button>'
        + '<button data-act="reset">清空存档</button></div>';
      h += '<textarea id="backupBox" style="display:none;width:100%;height:90px;background:rgba(0,0,0,.4);'
        + 'color:#9fe;border:1px solid var(--line);font-family:var(--mono);font-size:11px;padding:6px"></textarea>';
      h += '<p class="hint">存档保存在浏览器本地；换设备或换域名时用导出/导入迁移。</p>';
      return h;
    },

    toggleRow: function (key, label, desc, val) {
      return '<div class="row"><div><div class="rl">' + esc(label) + '</div><div class="rd">' + esc(desc) + '</div></div>'
        + '<div class="sw' + (val ? ' on' : '') + '" data-toggle="' + key + '"><i></i></div></div>';
    },
    rangeRow: function (key, label, val) {
      return '<div class="row"><div><div class="rl">' + esc(label) + '</div></div>'
        + '<input type="range" min="0" max="1" step="0.05" value="' + val + '" data-range="' + key + '" /></div>';
    },

    htmlHelp: function () {
      var h = '<p class="hint"><b>操作</b></p>'
        + '<p class="hint">· 方向键 / WASD：移动<br>· Shift：慢速微调（密集弹幕时很好用）<br>· 空格 / Z：射击（默认自动开火）<br>· X：炸弹，清屏并对全屏敌人造成伤害<br>· C：战机专属技能<br>· Esc / P：暂停</p>'
        + '<p class="hint" style="margin-top:10px"><b>擦弹（Graze）</b></p>'
        + '<p class="hint">贴着敌弹飞过而不被击中，可累积充能；充满自动触发「过载冲击」，清空全屏敌弹并提升火力。这是高分的核心技巧。</p>'
        + '<p class="hint" style="margin-top:10px"><b>道具</b></p><p class="hint">';
      for (var k in PW.POWERUPS) {
        var p = PW.POWERUPS[k];
        h += '<span style="color:' + p.color + '">' + p.letter + '</span> ' + esc(p.name) + '：' + esc(p.desc) + '<br>';
      }
      h += '</p><p class="hint" style="margin-top:10px"><b>受伤规则</b></p>'
        + '<p class="hint">被击中时会损失 1 点装甲并降低 1 级火力，护盾可优先抵挡。装甲归零即失败，可消耗续关机会原地复活。</p>';
      return h;
    },

    /* ---------------- 数据操作 ---------------- */
    doExport: function (btn) {
      var box = document.getElementById('backupBox');
      var txt = PW.Store.exportJSON();
      if (box.style.display === 'none') {
        box.style.display = 'block';
        box.value = txt;
        box.select();
        btn.textContent = '复制内容';
      } else {
        box.select();
        try { document.execCommand('copy'); btn.textContent = '已复制'; } catch (e) { btn.textContent = '请手动复制'; }
      }
    },
    doImport: function () {
      var box = document.getElementById('backupBox');
      if (box.style.display === 'none') { box.style.display = 'block'; box.value = ''; box.placeholder = '粘贴备份内容后点「导入备份」'; return; }
      if (PW.Store.importJSON(box.value)) {
        this.applyTheme(PW.Store.settings().theme);
        this.hooks.applySettings();
        this.open('settings');
        alert('导入成功');
      } else alert('导入失败：内容不是有效的备份');
    },
    doReset: function () {
      if (!confirm('确定清空全部存档？进度、排行榜与成就都会丢失，且无法恢复。')) return;
      PW.Store.reset();
      this.applyTheme(PW.Store.settings().theme);
      this.hooks.applySettings();
      this.open('settings');
    },

    /* ---------------- 结算 ---------------- */
    showResult: function (r) {
      var e = this.el;
      this.lastResult = r;
      hide(e.pause);
      e.resTitle.textContent = r.allCleared ? 'MISSION COMPLETE'
        : (r.cleared ? 'STAGE CLEAR' : (r.endless ? 'ENDLESS END' : 'GAME OVER'));
      e.resTitle.style.color = r.cleared ? 'var(--ui)' : 'var(--accent)';
      e.resScore.textContent = U.fmt(r.score);

      var kind = r.endless ? 'endless' : 'campaign';
      var qualify = PW.Store.qualifies(kind, r.score);
      this.pending = null;
      if (qualify) {
        show(e.resNew); show(e.resName);
        e.resInput.value = '';
        this.pending = { kind: kind, score: r.score, lv: r.level };
        setTimeout(function () { try { e.resInput.focus(); } catch (x) { } }, 60);
      } else { hide(e.resNew); hide(e.resName); }

      e.resStats.innerHTML =
        this.statBox(U.fmt(r.kills), '击落')
        + this.statBox(U.fmt(r.graze), '擦弹')
        + this.statBox(U.fmt(r.combo), '最长连击')
        + this.statBox((r.acc * 100).toFixed(0) + '%', '命中率')
        + this.statBox(U.time(r.time), '存活时长')
        + this.statBox('LV.' + r.level, r.endless ? '起始关卡' : '关卡');

      var extra = [];
      if (r.isNewBest && r.score > 0) extra.push('本关新纪录');
      if (r.newPlanes && r.newPlanes.length) extra.push('解锁新战机：' + r.newPlanes.join('、'));
      if (r.newAch && r.newAch.length) {
        extra.push('成就 ' + r.newAch.map(function (a) { return a.name; }).join('、')
          + (r.achScore ? '（奖励 +' + U.fmt(r.achScore) + ' 分，返回主菜单后可领取）' : ''));
      }
      if (r.noDamage) extra.push('无伤通关');
      if (r.daily) extra.push('每日挑战已完成，最佳成绩已记录');
      if (r.cleared && r.hasNext) extra.push('已解锁下一关');
      if (!r.cleared && r.canRevive) extra.push('剩余续关次数：' + r.revivesLeft);
      e.resExtra.innerHTML = extra.join(' · ');

      var f = '';
      if (r.canRevive) f += '<button class="btn btn-primary" data-res="revive">续关复活</button>';
      if (r.hasNext) f += '<button class="btn btn-primary" data-res="next">下一关</button>';
      f += '<button class="btn" data-res="again">再玩一次</button>';
      f += '<button class="btn btn-ghost" data-res="menu">返回主菜单</button>';
      e.resFoot.innerHTML = f;

      var self = this;
      var btns = e.resFoot.querySelectorAll('[data-res]');
      for (var i = 0; i < btns.length; i++) {
        (function (b) {
          b.addEventListener('click', function () {
            PW.Audio.play('click');
            if (self.pending) self.submitRank();
            var a = b.getAttribute('data-res');
            if (a === 'revive') self.hooks.revive();
            else if (a === 'next') self.hooks.next();
            else if (a === 'again') self.hooks.again();
            else self.hooks.toMenu();
          });
        })(btns[i]);
      }
      show(e.result);
    },

    submitRank: function () {
      if (!this.pending) return;
      var name = (this.el.resInput.value || '').trim().toUpperCase() || 'PILOT';
      PW.Store.pushRank(this.pending.kind, { name: name, score: this.pending.score, lv: this.pending.lv });
      this.pending = null;
      hide(this.el.resNew); hide(this.el.resName);
      PW.Audio.play('achieve');
    },

    /* 成就达成提示（游戏界面底部小条，不遮挡视野；连续解锁时排队展示）
       note: 可选，领取奖励时传「已入账」文案 */
    achToast: function (id, note) {
      var self = this;
      this._achQ = this._achQ || [];
      this._achQ.push({ id: id, note: note || '' });
      if (this._achBusy) return;
      this._achBusy = true;
      (function next() {
        var q = self._achQ;
        if (!q.length) { self._achBusy = false; return; }
        var item = q.shift(), a = null;
        for (var i = 0; i < PW.ACHIEVEMENTS.length; i++) if (PW.ACHIEVEMENTS[i].id === item.id) a = PW.ACHIEVEMENTS[i];
        if (!a) { return next(); }
        var el = self.el.achToast;
        el.innerHTML = '成就达成 · <b>' + esc(a.name) + '</b>'
          + (a.reward ? '<span class="ach-reward">' + (item.note || ('奖励 +' + U.fmt(a.reward) + ' 待领取')) + '</span>' : '');
        show(el);
        PW.Audio.play('achieve');
        clearTimeout(self._achT);
        self._achT = setTimeout(function () {
          hide(self.el.achToast);
          setTimeout(next, 260);   // 留一点间隔再播下一条
        }, 2600);
      })();
    }
  };

  PW.UI = UI;
})(window);
