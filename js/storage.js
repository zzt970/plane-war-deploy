/* 本地存档：设置、进度、双排行榜。localStorage 不可用时降级为内存。 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});

  var KEY = 'pw_neonstrike_v2';
  var RANK_MAX = 10; // 每榜保留条数

  var mem = null;      // 内存降级缓存
  var usable = (function () {
    try {
      var k = '__pw_t__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function blank() {
    return {
      v: 2,
      settings: JSON.parse(JSON.stringify(PW.DEFAULT_SETTINGS)),
      progress: {
        highestLevel: 1,
        unlockedLevels: 1,
        levelBest: {},
        unlockedPlanes: ['falcon'],
        selectedPlane: 'falcon',
        achievements: [],
        claimed: [],     // 已手动领取过奖励的成就（解锁≠到账，需在成就面板领取）
        achScore: 0,     // 成就奖励积分累计（仅领取部分）
        dex: [],
        stats: {
          plays: 0, kills: 0, shots: 0, hits: 0,
          bestCombo: 0, totalTime: 0, clears: 0, bossKills: 0, grazes: 0
        },
        daily: { date: '', best: 0, plays: 0 }
      },
      ranks: { campaign: [], endless: [] }
    };
  }

  var data = null;

  function load() {
    if (data) return data;
    if (!usable) return data = mem || (mem = blank());
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return data = blank();
    try {
      var o = JSON.parse(raw);
      data = merge(blank(), o);
    } catch (e) { data = blank(); }
    return data;
  }

  /* 用存档补全默认结构（应对版本升级后缺字段） */
  function merge(def, o) {
    if (o === null || typeof o !== 'object') return def;
    var out = def;
    for (var k in def) {
      if (!Object.prototype.hasOwnProperty.call(def, k)) continue;
      var dv = def[k], ov = o[k];
      if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
        // 自由键值表（如 levelBest）没有默认键，直接整体采用存档值
        out[k] = (Object.keys(dv).length === 0 && ov && typeof ov === 'object' && !Array.isArray(ov))
          ? ov : merge(dv, ov);
      } else if (ov !== undefined && ov !== null) out[k] = ov;
    }
    // 数组单独覆盖（成就 / 已领取 / 图鉴 / 榜单 / 已解锁战机）
    ['achievements', 'claimed', 'dex'].forEach(function (k) {
      if (Array.isArray(o.progress && o.progress[k])) out.progress[k] = o.progress[k].slice();
    });
    if (o.progress && Array.isArray(o.progress.unlockedPlanes)) out.progress.unlockedPlanes = o.progress.unlockedPlanes.slice();
    if (o.ranks) {
      if (Array.isArray(o.ranks.campaign)) out.ranks.campaign = o.ranks.campaign.slice();
      if (Array.isArray(o.ranks.endless)) out.ranks.endless = o.ranks.endless.slice();
    }
    return out;
  }

  function save() {
    if (!data) return;
    if (!usable) { mem = data; return; }
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { /* 配额不足时静默降级 */ }
  }

  var S = {
    get usable() { return usable; },
    all: function () { return load(); },
    settings: function () { return load().settings; },
    progress: function () { return load().progress; },

    setSetting: function (k, v) { load().settings[k] = v; save(); },

    /* ---------- 进度 ---------- */
    unlockLevel: function (lv) {
      var p = load().progress;
      if (lv > p.unlockedLevels) p.unlockedLevels = Math.min(PW.MAX_LEVEL, lv);
      if (lv > p.highestLevel) p.highestLevel = Math.min(PW.MAX_LEVEL, lv);
      save();
    },
    recordLevelScore: function (lv, score) {
      var p = load().progress;
      if (!p.levelBest[lv] || score > p.levelBest[lv]) p.levelBest[lv] = score;
      save();
    },
    unlockPlane: function (id) {
      var p = load().progress;
      if (p.unlockedPlanes.indexOf(id) < 0) { p.unlockedPlanes.push(id); save(); return true; }
      return false;
    },
    selectPlane: function (id) { load().progress.selectedPlane = id; save(); },
    /* 解锁成就：只标记达成，奖励需用户在成就面板手动领取 */
    unlockAch: function (id) {
      var p = load().progress;
      if (p.achievements.indexOf(id) >= 0) return false;
      p.achievements.push(id);
      save();
      return true;
    },
    /* 已解锁但未领取奖励的成就 id 列表 */
    pendingAch: function () {
      var p = load().progress, out = [];
      p.achievements.forEach(function (id) {
        if (p.claimed.indexOf(id) < 0) out.push(id);
      });
      return out;
    },
    /* 领取单个成就的积分奖励，返回实得分（0 = 已领过/不存在） */
    claimAch: function (id) {
      var p = load().progress;
      if (p.achievements.indexOf(id) < 0 || p.claimed.indexOf(id) >= 0) return 0;
      var gain = 0;
      for (var i = 0; i < PW.ACHIEVEMENTS.length; i++) {
        if (PW.ACHIEVEMENTS[i].id === id) { gain = PW.ACHIEVEMENTS[i].reward || 0; break; }
      }
      p.claimed.push(id);
      p.achScore += gain;                 // 成就奖励计入累计总分
      save();
      // 奖励分也可能让战机达到解锁线，立刻补一次判定
      S.syncPlaneUnlocks(S.totalScore());
      return gain;
    },
    seeEnemy: function (id) {
      var p = load().progress;
      if (p.dex.indexOf(id) < 0) { p.dex.push(id); save(); return true; }
      return false;
    },
    addStats: function (delta) {
      var s = load().progress.stats;
      for (var k in delta) if (s[k] !== undefined) s[k] += delta[k];
      save();
    },
    bestCombo: function (c) {
      var s = load().progress.stats;
      if (c > s.bestCombo) { s.bestCombo = c; save(); }
    },
    /* 战机按累计总分解锁 */
    syncPlaneUnlocks: function (totalScore) {
      var got = [];
      PW.PLANES.forEach(function (p) {
        if (totalScore >= p.unlock && S.unlockPlane(p.id)) got.push(p);
      });
      return got;
    },
    totalScore: function () {
      var p = load().progress, t = 0;
      for (var k in p.levelBest) t += p.levelBest[k] || 0;
      if (p.daily && p.daily.best) t += p.daily.best;
      t += p.achScore || 0;      // 成就奖励也计入累计总分
      return t;
    },

    /* ---------- 每日挑战 ---------- */
    dailyInfo: function () {
      var p = load().progress;
      if (!p.daily || p.daily.date !== PW.U.dayKey()) {
        p.daily = { date: PW.U.dayKey(), best: 0, plays: 0 };
        save();
      }
      return p.daily;
    },
    dailyDone: function () { return S.dailyInfo().plays > 0; },
    submitDaily: function (score) {
      var d = S.dailyInfo();
      d.plays++;
      if (score > d.best) d.best = score;
      save();
    },

    /* ---------- 排行榜（战役榜 / 无尽榜） ---------- */
    ranks: function (kind) { return load().ranks[kind] || []; },
    qualifies: function (kind, score) {
      var list = S.ranks(kind);
      return score > 0 && (list.length < RANK_MAX || score > list[list.length - 1].score);
    },
    pushRank: function (kind, entry) {
      var list = load().ranks[kind] || (load().ranks[kind] = []);
      list.push({ name: entry.name || 'PILOT', score: Math.floor(entry.score), lv: entry.lv || 0, time: entry.time || 0, date: PW.U.dayKey() });
      list.sort(function (a, b) { return b.score - a.score; });
      load().ranks[kind] = list.slice(0, RANK_MAX);
      save();
    },

    /* ---------- 备份 ---------- */
    exportJSON: function () { return JSON.stringify(load(), null, 2); },
    importJSON: function (txt) {
      try {
        var o = JSON.parse(txt);
        if (!o || typeof o !== 'object') return false;
        data = merge(blank(), o);
        save();
        return true;
      } catch (e) { return false; }
    },
    reset: function () { data = blank(); save(); }
  };

  PW.Store = S;
})(window);
