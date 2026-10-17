/* 游戏主场景：状态机、生成、碰撞、计分、成就判定 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});
  var U = PW.U, C = PW.C, E = PW.Ent;
  var W = PW.VIEW.w, H = PW.VIEW.h;

  /* ------------------------ 场景 ------------------------ */
  function Scene(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.quality = 'high';
    this.cb = {};              // 回调：onEnd / onAchieve / onToast
    this.running = false;
    this.paused = false;
    this.phase = 'idle';       // intro / play / bossWarn / cleared / dying / over
    this.time = 0;
    this.shake = 0;
    this.toasts = [];
    this.beams = [];
    this.btns = [];
    this.reset();
  }

  Scene.prototype.reset = function () {
    this.bullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = new E.Particles(this.quality === 'high' ? 300 : 120);
    this.boss = null;
    this.player = null;
    this.levelId = 1;
    this.levelTime = 0;
    this.levelDur = 45;
    this.score = 0;
    this.displayScore = 0;
    this.comboBest = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.graze = 0;
    this.bossKills = 0;
    this.tookDamage = false;
    this.usedBombLowHp = false;
    this.revivesLeft = 0;
    this.spawnT = 1.0;
    this.phaseT = 0;
    this.endless = false;
    this.daily = false;
    this.mods = [];
    this.hi = 0;
    this.toasts.length = 0;
    this.beams.length = 0;
    this.shake = 0;
  };

  Scene.prototype.setQuality = function (q) {
    this.quality = q;
    this.particles = new E.Particles(q === 'high' ? 300 : 120);
  };

  /* ------------------------ 开局 ------------------------ */
  Scene.prototype.start = function (opts) {
    this.reset();
    this.cb = opts.cb || this.cb;
    var prog = PW.Store.progress();
    var cfg = PW.getPlane(opts.plane || prog.selectedPlane);
    var diff = PW.getDiff(opts.diff || PW.Store.settings().diff);

    this.diff = diff;
    this.levelId = opts.level || 1;
    this.endless = !!opts.endless;
    this.daily = !!opts.daily;
    this.mods = opts.mods || [];
    this.hi = (prog.levelBest[this.levelId] || 0);
    this.revivesLeft = diff.revives;
    this.levelDur = this.endless ? Infinity : PW.getLevel(this.levelId).dur;
    this.planeCfg = cfg;
    this.themeId = opts.theme || null;

    /* 敌机配额：本关必须全部击落（不含母舰小蜂），打光才召唤 BOSS */
    var lvCfg = PW.getLevel(this.levelId);
    this.quota = this.endless ? Infinity : (lvCfg.total || 30);
    this.cap = Math.max(3, lvCfg.cap || 6);
    this.spawned = 0;

    var hpOverride = null;
    if (this.hasMod('one_hit')) hpOverride = 1;
    this.player = new E.Player(cfg, { hp: hpOverride });

    this.rng = this.daily ? U.seeded(U.daySeed() + this.levelId * 977) : Math.random;
    this.phase = 'intro';
    this.phaseT = 2.2;
    this.time = 0;
    this.levelTime = 0;
    this.spawnT = 1.2;
    this._newAch = [];      // 本局新解锁的成就（场景跨局复用，必须重置）
    this.running = true;
    this.paused = false;

    PW.Store.addStats({ plays: 1 });
    PW.Input.clear();
  };

  Scene.prototype.hasMod = function (id) {
    for (var i = 0; i < this.mods.length; i++) if (this.mods[i].id === id) return true;
    return false;
  };
  Scene.prototype.modVal = function (key, def) {
    var v = def;
    for (var i = 0; i < this.mods.length; i++) {
      if (this.mods[i][key] !== undefined) {
        if (key === 'spawn' || key === 'enemyHp' || key === 'enemySpeed' || key === 'dmg' || key === 'drop' || key === 'graze') v *= this.mods[i][key];
      }
    }
    return v;
  };

  /* ------------------------ 输入 -> 移动 ------------------------ */
  Scene.prototype.moveVector = function () {
    var p = this.player, mv = { x: 0, y: 0, slow: false };
    if (!p || !p.alive) return mv;
    var scheme = PW.Input.scheme;

    /* 键盘轴始终参与（桌面默认） */
    var a = PW.Input.axis();
    mv.x = a.x; mv.y = a.y; mv.slow = a.slow;

    /* 鼠标跟手：仅鼠标方案，避免触屏时误跟 */
    if (scheme === 'mouse') {
      var pt = PW.Input.pointer;
      if (pt.active) {
        var dx = pt.x - p.x, dy = pt.y - p.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > 2) {
          var k = Math.min(1, d / 34);
          mv.x = dx / d * k; mv.y = dy / d * k;
        }
      }
    }

    /* 触摸拖动始终生效：不论当前方案是什么，手指拖动都能带动飞机 */
    var dg = PW.Input.takeDrag();
    if (dg && (dg.x || dg.y)) {
      mv.x = U.clamp(mv.x + dg.x * 1.6 / 16, -1, 1);
      mv.y = U.clamp(mv.y + dg.y * 1.6 / 16, -1, 1);
    }
    return mv;
  };

  /* ------------------------ 更新 ------------------------ */
  Scene.prototype.update = function (dt) {
    if (!this.running || this.paused) return;
    this.time += dt;
    var p = this.player;

    /* 阶段推进 */
    this.phaseT -= dt;
    if (this.phase === 'intro') {
      if (this.phaseT <= 0) this.phase = 'play';
    } else if (this.phase === 'bossWarn') {
      if (this.phaseT <= 0) this.spawnBoss();
    } else if (this.phase === 'cleared') {
      if (this.phaseT <= 0) this.finish(true);
    } else if (this.phase === 'dying') {
      if (this.phaseT <= 0) this.finish(false);
    }

    if (this.phase === 'play' && !this.boss) {
      this.levelTime += dt;
      /* 通关条件：配额投完 + 场上敌机清零（无尽模式不出 BOSS，持续刷） */
      if (!this.endless && this.spawned >= this.quota && this.aliveEnemyCount() === 0) {
        this.phase = 'bossWarn';
        this.phaseT = 2.0;
        if (this.cb.sfx) this.cb.sfx('warn');
      }
    }

    /* 时间凝滞系数 */
    var slow = (p && p.skillT > 0 && p.cfg.skill.id === 'freeze') ? 0.35 : 1;

    /* 玩家 */
    if (p) {
      var mv = this.moveVector();
      p.update(dt, mv);

      // 射击
      var wantFire = PW.Input.firing || PW.Store.settings().autoFire;
      if (this.phase === 'play' && p.alive && wantFire && p.canFire()) this.playerFire();

      // 动作键
      if (this.phase === 'play') {
        if (PW.Input.take('bomb')) this.useBomb();
        if (PW.Input.take('skill')) this.useSkill();
      }
    }

    /* 生成敌潮：配额未投完且同屏未满时才补位 */
    if (this.phase === 'play' && !this.boss &&
      this.spawned < this.quota && this.aliveEnemyCount() < this.cap) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnWave();
        var base = this.endless ? Math.max(0.34, 1.05 - this.levelTime / 110) : PW.getLevel(this.levelId).spawn;
        this.spawnT = base * this.modVal('spawn', 1) * this.diff.spawn * U.rand(0.75, 1.3);
      }
    }

    /* 敌机 */
    var self = this;
    var world = {
      player: p,
      slow: slow,
      spawnEnemyBullet: function (x, y, vx, vy, color, r, homing) { self.spawnEnemyBullet(x, y, vx, vy, color, r, homing); },
      spawnMinion: function (x, y, boss) { self.spawnMinion(x, y, boss); },
      onLaser: function (src) { self.fireLaser(src); }
    };
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      e.update(dt, world);
      if (!e.alive) this.enemies.splice(i, 1);
    }
    if (this.boss) {
      this.boss.update(dt, world);
      if (!this.boss.alive) this.onBossDead();
    }

    /* 子弹 */
    for (var b = this.bullets.length - 1; b >= 0; b--) {
      var bl = this.bullets[b];
      if (!bl.alive) { this.bullets.splice(b, 1); continue; }
      bl.slow = bl.friendly ? 1 : slow;
      bl.update(dt, p, this.enemies.concat(this.boss ? [this.boss] : []));
      if (!bl.alive) this.bullets.splice(b, 1);
    }

    /* 道具 */
    for (var u = this.powerups.length - 1; u >= 0; u--) {
      var pu = this.powerups[u];
      pu.update(dt, p);
      if (!pu.alive) { this.powerups.splice(u, 1); continue; }
      if (p && p.alive && U.hit(pu.x, pu.y, pu.r + 6, p.x, p.y, p.r + 8)) {
        this.applyPower(pu.type);
        this.powerups.splice(u, 1);
      }
    }

    /* 碰撞 */
    this.collide(dt);

    this.particles.update(dt);
    for (var bm = this.beams.length - 1; bm >= 0; bm--) {
      this.beams[bm].t -= dt;
      if (this.beams[bm].t <= 0) this.beams.splice(bm, 1);
    }
    for (var t = this.toasts.length - 1; t >= 0; t--) {
      this.toasts[t].life -= dt;
      if (this.toasts[t].life <= 0) this.toasts.splice(t, 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);

    /* 分数滚动 */
    this.displayScore += (this.score - this.displayScore) * Math.min(1, dt * 8);
    if (Math.abs(this.score - this.displayScore) < 1) this.displayScore = this.score;
  };

  /* ------------------------ 射击 ------------------------ */
  Scene.prototype.playerFire = function () {
    var p = this.player;
    p.markFired();
    var w = p.weapon();
    var lv = p.weaponLv;
    var n = w.bullets + p.cfg.extraSpread;
    var spread = w.spread * Math.PI / 180;
    var dmg = p.damage() * this.modVal('dmg', 1);
    var chainBase = p.cfg.chain || 0;
    var chain = chainBase;
    if (p.skillT > 0 && p.cfg.skill.id === 'thunder') chain = 4;
    var homing = w.homing > 0 ? 3.2 + p.cfg.homingBonus : 0;

    for (var i = 0; i < n; i++) {
      var a = (n === 1) ? 0 : (i / (n - 1) - 0.5) * 2 * (spread / 2) * (n - 1) / Math.max(1, (n - 1) / 2);
      // 均匀扇形
      a = (i - (n - 1) / 2) * (spread / Math.max(1, (n - 1))) * 2;
      var vx = Math.sin(a) * 760, vy = -Math.cos(a) * 760;
      this.bullets.push(new E.Bullet({
        x: p.x, y: p.y - 14, vx: vx, vy: vy, r: 4,
        dmg: dmg, color: p.cfg.color, friendly: true,
        homing: (w.homing > 0 && i % 2 === 0) ? homing : 0,
        chain: (w.homing > 0 && i % 2 === 0) ? 0 : chain
      }));
    }
    // 幻影的额外追踪弹
    for (var k = 0; k < p.cfg.homingBonus; k++) {
      this.bullets.push(new E.Bullet({
        x: p.x + (k % 2 ? 12 : -12), y: p.y - 6,
        vx: (k % 2 ? 210 : -210), vy: -520, r: 4,
        dmg: dmg * 0.6, color: C.accent, friendly: true, homing: 4.5
      }));
    }
    this.shots += n;
    if (this.cb.sfx) this.cb.sfx('shoot');
  };

  Scene.prototype.spawnEnemyBullet = function (x, y, vx, vy, color, r, homing) {
    var k = this.diff.bullet;
    this.bullets.push(new E.Bullet({
      x: x, y: y, vx: vx * k, vy: vy * k, r: r || 5.5,
      dmg: 1, color: color || C.danger, friendly: false, homing: homing || 0
    }));
    if (this.cb.sfx) this.cb.sfx('enemyShoot');
  };

  Scene.prototype.spawnMinion = function (x, y, fromBoss) {
    var m = new E.Enemy(PW.MINION, x, y, { minion: true, hpMul: this.modVal('enemyHp', 1) * this.diff.hp, speedMul: this.modVal('enemySpeed', 1) });
    m.baseX = x;
    this.enemies.push(m);
  };

  /* ------------------------ 敌潮生成 ------------------------ */
  /* 场上未击落的敌机数（不含母舰小蜂，小蜂是额外目标） */
  Scene.prototype.aliveEnemyCount = function () {
    var n = 0;
    for (var i = 0; i < this.enemies.length; i++) if (!this.enemies[i].isMinion) n++;
    return n;
  };
  /* 本关还剩多少架要打（未投放 + 场上存活） */
  Scene.prototype.remaining = function () {
    if (this.endless) return Infinity;
    return Math.max(0, this.quota - this.spawned) + this.aliveEnemyCount();
  };

  Scene.prototype.spawnWave = function () {
    var lv = PW.getLevel(this.levelId);
    var pool = this.endless ? ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'] : lv.pool;
    // 无尽模式按时间解锁更硬的敌机
    if (this.endless) {
      var cap = 2 + Math.floor(this.levelTime / 45);
      pool = pool.slice(0, Math.min(pool.length, cap + 2));
    }
    if (this.daily) pool = ['E1', 'E2', 'E3', 'E4', 'E5'].slice(0, 3 + Math.min(2, Math.floor(this.levelTime / 30)));
    if (!pool.length) pool = ['E1'];

    var r = this.rng();
    var hpMul = this.modVal('enemyHp', 1) * this.diff.hp;
    var spMul = this.modVal('enemySpeed', 1);
    var self = this;
    /* 受配额与同屏上限双重约束，保证场面可控且一架不多投 */
    function add(id, x, y) {
      var cfg = PW.ENEMIES[id];
      if (!cfg) return;
      if (self.spawned >= self.quota) return;
      if (self.aliveEnemyCount() >= self.cap) return;
      self.spawned++;
      self.enemies.push(new E.Enemy(cfg, x, y, { hpMul: hpMul, speedMul: spMul }));
    }

    if (r < 0.50) {
      // 单只 / 双只
      var id = pool[Math.floor(this.rng() * pool.length)];
      add(id, U.rand(50, W - 50), -30);
      if (this.rng() < 0.35) add(id, U.rand(50, W - 50), -80);
    } else if (r < 0.78) {
      // 横排编队
      var id2 = pool[Math.floor(this.rng() * pool.length)];
      if (PW.ENEMIES[id2].suicide) id2 = pool[0];
      var cnt = 3 + Math.floor(this.rng() * 3);
      var x0 = U.rand(70, W - 70 - (cnt - 1) * 46);
      for (var i = 0; i < cnt; i++) add(id2, x0 + i * 46, -30 - i * 6);
    } else if (r < 0.92) {
      // V 字
      var id3 = pool[Math.floor(this.rng() * pool.length)];
      var cn = 3 + Math.floor(this.rng() * 2);
      var cx = U.rand(120, W - 120);
      for (var j = 0; j < cn; j++) {
        add(id3, cx - j * 42, -30 - j * 34);
        if (j > 0) add(id3, cx + j * 42, -30 - j * 34);
      }
    } else {
      // 两侧夹击
      var id4 = pool[Math.floor(this.rng() * pool.length)];
      var n2 = 2 + Math.floor(this.rng() * 2);
      for (var s = 0; s < n2; s++) {
        add(id4, 30, -30 - s * 46);
        add(id4, W - 30, -30 - s * 46);
      }
    }
  };

  /* ------------------------ BOSS ------------------------ */
  Scene.prototype.spawnBoss = function () {
    var theme = PW.getBoss(this.levelId);
    this.boss = new E.Boss(theme, this.modVal('enemyHp', 1) * this.diff.hp);
    this.phase = 'play';
    this.shakeAdd(8);
  };
  Scene.prototype.onBossDead = function () {
    var b = this.boss;
    this.boss = null;
    this.bossKills++;
    this.addScore(3000 * this.diff.score, b.x, b.y, true);
    this.particles.spark(b.x, b.y, b.color, 60, 320, 1.1);
    this.particles.ring(b.x, b.y, b.color, 260, 0.8);
    this.particles.ring(b.x, b.y, '#FFFFFF', 180, 0.6);
    this.shakeAdd(22);
    if (this.cb.sfx) this.cb.sfx('bigKill');
    // 掉落
    for (var i = 0; i < 3; i++) this.dropPower(b.x - 40 + i * 40, b.y, true);
    PW.Store.addStats({ bossKills: 1 });
    {
      this.phase = 'cleared';
      this.phaseT = 2.6;
      this.clearLevel();
    }
  };

  /* ------------------------ 激光 ------------------------ */
  Scene.prototype.fireLaser = function (src) {
    var p = this.player;
    if (!p || !p.alive) return;
    this.shakeAdd(9);
    if (this.cb.sfx) this.cb.sfx('laser');
    // 判定：玩家 x 是否落在光束宽度内
    var wdt = src.id && src.id === 'E8' ? 14 : 22;
    if (Math.abs(p.x - src.laserX) < wdt + p.r && p.y > src.y) {
      if (p.takeHit()) this.onPlayerHurt();
    }
  };

  /* ------------------------ 道具 ------------------------ */
  Scene.prototype.dropPower = function (x, y, force) {
    var type = U.weighted(PW.PU_DROP);
    if (this.hasMod('no_heal') && type === 'heal') type = 'shield';
    this.powerups.push(new E.PowerUp(type, x, y));
  };
  Scene.prototype.applyPower = function (type) {
    var p = this.player;
    var info = PW.POWERUPS[type];
    if (!p) return;
    switch (type) {
      case 'weapon':
        if (p.weaponLv < PW.WEAPONS.length) { p.weaponLv++; this.toast('火力提升 Lv.' + p.weaponLv, info.color); }
        else { this.addScore(800); this.toast('火力已满  +800', info.color); }
        break;
      case 'shield':
        if (p.shield < 3) { p.shield++; this.toast('护盾 +1', info.color); }
        else { this.addScore(600); this.toast('护盾已满  +600', info.color); }
        break;
      case 'score':
        p.scoreMulT = 10; this.toast('得分 x2  10s', info.color);
        break;
      case 'bomb':
        if (p.bombs < 5) { p.bombs++; this.toast('炸弹 +1', info.color); }
        else { this.addScore(900); this.toast('炸弹已满  +900', info.color); }
        break;
      case 'heal':
        if (p.hp < p.maxHp) { p.hp++; this.toast('装甲修复 +1', info.color); }
        else { this.addScore(1000); this.toast('装甲完好  +1000', info.color); }
        break;
      case 'wing':
        if (p.addWingman()) this.toast('僚机就位', info.color);
        else { this.addScore(700); this.toast('僚机已满  +700', info.color); }
        break;
      case 'wipe':
        this.wipeScreen();
        this.toast('全屏清除', info.color);
        break;
    }
    this.particles.spark(p.x, p.y - 10, info.color, 12, 180, 0.5);
    if (this.cb.sfx) this.cb.sfx('powerup');
  };

  /* 统一清弹：只标记 alive，避免在遍历中改数组导致索引错位 */
  Scene.prototype.clearEnemyBullets = function (fx) {
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (b.friendly || !b.alive) continue;
      b.alive = false;
      if (fx) this.particles.spark(b.x, b.y, b.color, 3, 90, 0.35);
    }
  };

  Scene.prototype.wipeScreen = function () {
    var i;
    this.clearEnemyBullets(true);
    for (i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (!e.alive) continue;
      e.hurt(1e4);                 // 直接致死，保留死亡特效与图鉴记录
      this.onEnemyDead(e, true);   // 计入击杀 / 连击 / 掉落，与炸弹行为一致
      this.enemies.splice(i, 1);
    }
    this.particles.ring(W / 2, H / 2, '#FFFFFF', 520, 0.7);
    this.shakeAdd(10);
  };

  /* ------------------------ 主动技能 ------------------------ */
  Scene.prototype.useBomb = function () {
    var p = this.player;
    if (!p || !p.alive || p.bombs <= 0) return;
    p.bombs--;
    if (p.hp <= 1) this.usedBombLowHp = true;
    if (this.cb.sfx) this.cb.sfx('bomb');
    this.shakeAdd(20);
    this.particles.ring(p.x, p.y, C.purple, 620, 0.85);
    this.particles.ring(p.x, p.y, '#FFFFFF', 420, 0.6);
    this.clearEnemyBullets(false);
    for (var j = this.enemies.length - 1; j >= 0; j--) {
      var e = this.enemies[j];
      var r = e.hurt(6);
      if (r === 'dead') this.onEnemyDead(e, true);
      else this.particles.spark(e.x, e.y, e.color, 6, 160, 0.4);
    }
    if (this.boss) {
      var br = this.boss.hurt(30);
      if (br === 'dead') this.onBossDead();
    }
    p.invuln = Math.max(p.invuln, 1.6);
  };

  Scene.prototype.useSkill = function () {
    var p = this.player;
    if (!p || !p.alive || p.skillCd > 0) return;
    var sk = p.cfg.skill;
    p.skillCd = sk.cd;
    p.skillT = sk.dur;
    if (this.cb.sfx) this.cb.sfx('skill');
    this.toast(sk.name + ' 启动', p.cfg.color);
    this.particles.ring(p.x, p.y, p.cfg.color, 200, 0.6);
    if (sk.id === 'phase') this.clearEnemyBullets(true);
    this.shakeAdd(6);
  };

  /* ------------------------ 碰撞 ------------------------ */
  Scene.prototype.collide = function (dt) {
    var i, j, p = this.player;
    var targets = this.enemies.slice();
    if (this.boss) targets.push(this.boss);

    /* 玩家子弹 -> 敌机 */
    for (i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      if (!b.friendly || !b.alive) continue;
      for (j = 0; j < targets.length; j++) {
        var e = targets[j];
        if (!e.alive) continue;
        if (!U.hit(b.x, b.y, b.r, e.x, e.y, e.r)) continue;
        this.hits++;
        var res = e.hurt(b.dmg);
        this.particles.spark(b.x, b.y, e.color, 3, 140, 0.3);
        if (this.cb.sfx) this.cb.sfx('hit');

        if (res === 'dead') {
          if (e === this.boss) this.onBossDead();
          else this.onEnemyDead(e, false, b);
        }
        // 链式闪电
        if (b.chain > 0) this.chainTo(b, e);
        // 穿透
        if (b.pierce > 0) { b.pierce--; }
        else b.alive = false;
        break;
      }
    }

    if (!p || !p.alive) return;

    /* 敌弹 -> 玩家（含擦弹） */
    var grazeMul = this.modVal('graze', 1) * p.cfg.grazeBonus;
    for (i = this.bullets.length - 1; i >= 0; i--) {
      var eb = this.bullets[i];
      if (eb.friendly || !eb.alive) continue;
      var d = U.dist(eb.x, eb.y, p.x, p.y);
      if (d <= p.r + eb.r) {
        eb.alive = false;
        if (p.takeHit()) this.onPlayerHurt();
        else this.particles.spark(p.x, p.y, C.primary, 6, 130, 0.3);
        continue;
      }
      // 擦弹
      if (!eb.grazed && d <= p.grazeR + eb.r) {
        eb.grazed = true;
        this.graze++;
        p.charge = Math.min(100, p.charge + 2.2);
        this.addScore(Math.round(30 * grazeMul));
        this.particles.spark(eb.x, eb.y, U.alpha('#FFFFFF', 0.9), 2, 70, 0.25);
        if (this.cb.sfx && this.graze % 3 === 0) this.cb.sfx('graze');
        if (p.charge >= 100) this.triggerOverdrive();
      }
    }

    /* 敌机撞机 */
    for (i = this.enemies.length - 1; i >= 0; i--) {
      var en = this.enemies[i];
      if (!en.alive) continue;
      if (U.hit(en.x, en.y, en.r * 0.82, p.x, p.y, p.r + 3)) {
        if (p.takeHit()) this.onPlayerHurt();
        if (!en.cfg.elite) {
          en.alive = false;
          this.onEnemyDead(en, true);
        }
      }
    }
    /* Boss 撞机 */
    if (this.boss && U.hit(this.boss.x, this.boss.y, this.boss.r * 0.7, p.x, p.y, p.r + 3)) {
      if (p.takeHit()) this.onPlayerHurt();
    }

    /* 僚机射击 */
    this.updateWingmen(dt, targets);
  };

  Scene.prototype.updateWingmen = function (dt, targets) {
    var p = this.player;
    if (!p) return;
    for (var i = 0; i < p.wingmen.length; i++) {
      var wm = p.wingmen[i];
      wm.fireT -= dt;
      if (wm.fireT > 0) continue;
      wm.fireT = 0.28;
      var pos = p.wingmanPos(wm);
      this.bullets.push(new E.Bullet({
        x: pos.x, y: pos.y - 8, vx: 0, vy: -640, r: 3.4,
        dmg: p.damage() * 0.55 * this.modVal('dmg', 1), color: C.green, friendly: true
      }));
      this.shots++;
    }
  };

  /* 链式闪电：命中后跳向附近目标 */
  Scene.prototype.chainTo = function (bullet, origin) {
    var left = bullet.chain - 1;
    if (left <= 0) return;
    var targets = this.enemies.slice();
    if (this.boss) targets.push(this.boss);
    var cur = { x: origin.x, y: origin.y };
    var used = [origin];
    var dmg = bullet.dmg * 0.65;
    for (var k = 0; k < left; k++) {
      var best = null, bd = 140 * 140;
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (!t.alive || used.indexOf(t) >= 0) continue;
        var d2 = U.dist2(cur.x, cur.y, t.x, t.y);
        if (d2 < bd) { bd = d2; best = t; }
      }
      if (!best) break;
      this.beams.push({ x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, t: 0.22, color: C.purple });
      var r = best.hurt(dmg);
      this.particles.spark(best.x, best.y, C.purple, 4, 150, 0.3);
      if (r === 'dead') {
        if (best === this.boss) this.onBossDead();
        else this.onEnemyDead(best, false);
      }
      used.push(best);
      cur = { x: best.x, y: best.y };
    }
  };

  /* ------------------------ 击杀 / 受伤 ------------------------ */
  Scene.prototype.onEnemyDead = function (e, silent, bullet) {
    this.kills++;
    var p = this.player;
    if (p) {
      p.combo++;
      p.comboT = 2.4;
      if (p.combo > this.comboBest) this.comboBest = p.combo;
    }
    var base = e.cfg.score * this.diff.score * (p && p.scoreMulT > 0 ? 2 : 1);
    var mul = 1 + Math.min(p ? p.combo : 0, 100) / 100;
    this.addScore(base * mul, e.x, e.y, !silent);

    // 图鉴记录
    if (!e.isMinion && PW.Store.seeEnemy(e.id)) this.notifyDex(e.cfg);

    // 掉落
    var dropRate = e.cfg.elite ? 0.55 : (e.isMinion ? 0.03 : 0.11);
    if (this.hasMod('rich')) dropRate *= 2;
    if (Math.random() < dropRate) this.dropPower(e.x, e.y);

    // 自爆机死亡炸出一圈弹
    if (e.cfg.suicide) {
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * 6.2832;
        this.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, C.danger, 4.5);
      }
      this.particles.ring(e.x, e.y, C.danger, 90, 0.4);
    }
    if (!silent) {
      this.particles.spark(e.x, e.y, e.color, e.isMinion ? 6 : 14, e.isMinion ? 140 : 230, e.isMinion ? 0.35 : 0.55);
      if (this.cb.sfx) this.cb.sfx(e.isMinion ? 'hit' : 'kill');
    }
  };

  Scene.prototype.onPlayerHurt = function () {
    var p = this.player;
    this.tookDamage = true;
    this.shakeAdd(14);
    this.particles.spark(p.x, p.y, C.danger, 18, 240, 0.6);
    this.particles.ring(p.x, p.y, C.danger, 120, 0.5);
    if (this.cb.sfx) this.cb.sfx('hurt');
    if (!p.alive) {
      this.phase = 'dying';
      this.phaseT = 1.4;
      this.particles.spark(p.x, p.y, p.cfg.color, 40, 300, 1.0);
      this.particles.ring(p.x, p.y, '#FFFFFF', 200, 0.7);
      this.shakeAdd(26);
      if (this.cb.sfx) this.cb.sfx('over');
    }
  };

  Scene.prototype.triggerOverdrive = function () {
    var p = this.player;
    p.charge = 0;
    p.overdriveT = 5;
    this.clearEnemyBullets(true);
    this.particles.ring(p.x, p.y, C.yellow, 260, 0.6);
    this.toast('过载冲击！', C.yellow);
    this.shakeAdd(8);
    if (this.cb.sfx) this.cb.sfx('skill');
  };

  /* ------------------------ 计分 ------------------------ */
  Scene.prototype.addScore = function (v, x, y, show) {
    v = Math.round(v);
    if (v <= 0) return;
    this.score += v;
    if (show && x !== undefined) this.particles.text(x, y - 8, '+' + U.fmt(v), C.yellow);
  };

  Scene.prototype.toast = function (text, color) {
    this.toasts.unshift({ text: text, color: color || '#FFFFFF', life: 0.9 });
    if (this.toasts.length > 4) this.toasts.pop();
  };

  Scene.prototype.shakeAdd = function (v) {
    if (!PW.Store.settings().shake) return;
    this.shake = Math.min(30, this.shake + v);
  };

  Scene.prototype.notifyDex = function (cfg) {
    this.toast('图鉴解锁：' + cfg.name, cfg.color);
    if (this.cb.sfx) this.cb.sfx('achieve');
    this.checkAchievements();
  };

  /* ------------------------ 通关 / 结束 ------------------------ */
  Scene.prototype.clearLevel = function () {
    var p = this.player;
    var bonus = 0;
    if (p) {
      bonus += p.hp * 1500;
      bonus += Math.max(0, Math.round((this.levelDur - this.levelTime)) * 20);
      if (!this.tookDamage) bonus += 5000;
    }
    this.addScore(bonus * this.diff.score);
    this.lastBonus = bonus;

    var prog = PW.Store.progress();
    PW.Store.unlockLevel(this.levelId + 1);
    PW.Store.recordLevelScore(this.levelId, this.score);
    PW.Store.addStats({ clears: 1 });
    if (this.levelId >= PW.MAX_LEVEL) PW.Store.unlockAch('ACH_ALL_LEVELS');
    this.checkAchievements();
  };

  Scene.prototype.finish = function (cleared) {
    this.running = false;
    var p = this.player;
    PW.Store.addStats({
      kills: this.kills, shots: this.shots, hits: this.hits,
      grazes: this.graze, totalTime: Math.round(this.time)
    });
    PW.Store.bestCombo(this.comboBest);
    var newPlanes = PW.Store.syncPlaneUnlocks(PW.Store.totalScore());
    if (this.daily) PW.Store.submitDaily(this.score);
    // 无论是否通关都记录本关最高分，先比对再写入
    var prevBest = PW.Store.progress().levelBest[this.levelId] || 0;
    var isNewBest = this.score > prevBest;
    PW.Store.recordLevelScore(this.levelId, this.score);
    this.checkAchievements();

    /* 本局新解锁的成就与奖励分合计 */
    var newAchList = [], achReward = 0;
    (this._newAch || []).forEach(function (id) {
      for (var i = 0; i < PW.ACHIEVEMENTS.length; i++) {
        if (PW.ACHIEVEMENTS[i].id === id) {
          newAchList.push({ name: PW.ACHIEVEMENTS[i].name, reward: PW.ACHIEVEMENTS[i].reward || 0 });
          achReward += PW.ACHIEVEMENTS[i].reward || 0;
          break;
        }
      }
    });

    var result = {
      cleared: cleared,
      score: this.score,
      level: this.levelId,
      endless: this.endless,
      daily: this.daily,
      kills: this.kills,
      graze: this.graze,
      combo: this.comboBest,
      bossKills: this.bossKills,
      noDamage: !this.tookDamage,
      time: this.time,
      acc: this.shots ? this.hits / this.shots : 0,
      revivesLeft: this.revivesLeft,
      canRevive: !cleared && this.revivesLeft > 0,
      hasNext: cleared && this.levelId < PW.MAX_LEVEL && !this.daily,
      allCleared: cleared && this.levelId >= PW.MAX_LEVEL && !this.daily,
      isNewBest: isNewBest,
      newPlanes: newPlanes.map(function (p) { return p.name; }),
      newAch: newAchList,
      achScore: achReward,
      hi: Math.max(prevBest, this.score)
    };
    if (this.cb.onEnd) this.cb.onEnd(result);
  };

  /* 续关：保留分数与关卡进度，恢复满血 */
  Scene.prototype.revive = function () {
    if (this.revivesLeft <= 0) return false;
    this.revivesLeft--;
    var p = this.player;
    this.running = true;
    p.alive = true;
    p.hp = p.maxHp;
    p.invuln = 3;
    p.combo = 0;
    p.weaponLv = Math.max(1, p.weaponLv);
    this.phase = 'play';
    this.phaseT = 0;
    this.clearEnemyBullets(false);
    this.particles.ring(p.x, p.y, C.green, 300, 0.7);
    this.toast('重新启动！剩余续关 ' + this.revivesLeft, C.green);
    if (this.cb.sfx) this.cb.sfx('victory');
    return true;
  };

  /* ------------------------ 成就 ------------------------ */
  Scene.prototype.checkAchievements = function () {
    var prog = PW.Store.progress();
    var got = this._newAch || (this._newAch = []);   // 本局累计新解锁的成就
    var self = this;
    function give(id) { if (PW.Store.unlockAch(id)) got.push(id); }

    if (this.kills >= 1 || prog.stats.kills >= 1) give('ACH_FIRST_BLOOD');
    if (this.comboBest >= 100) give('ACH_COMBO_100');
    if (this.bossKills >= 1) give('ACH_BOSS_SLAYER');
    if (this.score >= 100000) give('ACH_SCORE_100K');
    if (this.graze >= 500) give('ACH_GRAZE_500');
    if (this.endless && this.levelTime >= 300) give('ACH_ENDLESS_5M');
    if (this.daily) give('ACH_DAILY');
    if (prog.dex.length >= 8) give('ACH_DEX_ALL');
    if (prog.achievements.indexOf('ACH_ALL_LEVELS') < 0 && (prog.levelBest[PW.MAX_LEVEL] || 0) > 0 && this.levelId >= PW.MAX_LEVEL) give('ACH_ALL_LEVELS');
    if (this.phase === 'cleared') {
      if (!this.tookDamage) give('ACH_NO_DAMAGE');
      if (this.usedBombLowHp) give('ACH_BOMB_SAVE');
      if (this.diff.id === 'hard') give('ACH_HARD_CLEAR');
    }
    for (var i = 0; i < got.length; i++) {
      if (this.cb.onAchieve) this.cb.onAchieve(got[i]);
    }
    /* 注意：成就奖励改为手动领取，解锁判定在 Store.claimAch 内触发，
       这里不再即时加分，避免玩家未领取就改变了战机解锁进度 */
  };

  /* ------------------------ 渲染 ------------------------ */
  Scene.prototype.render = function () {
    var g = this.g;
    g.save();
    if (this.shake > 0.4) {
      g.translate(U.rand(-this.shake, this.shake) * 0.5, U.rand(-this.shake, this.shake) * 0.5);
    }

    PW.BG.render(g, this.time, 1 / 60);

    // 链式闪电
    for (var i = 0; i < this.beams.length; i++) {
      var b = this.beams[i];
      g.save();
      g.globalAlpha = U.clamp(b.t / 0.22, 0, 1);
      g.strokeStyle = b.color; g.lineWidth = 2.4;
      if (this.quality === 'high') { g.shadowColor = b.color; g.shadowBlur = 12; }
      g.beginPath();
      // 抖动折线，模拟电弧
      var seg = 5;
      g.moveTo(b.x1, b.y1);
      for (var s = 1; s <= seg; s++) {
        var k = s / seg;
        g.lineTo(U.lerp(b.x1, b.x2, k) + U.rand(-7, 7), U.lerp(b.y1, b.y2, k) + U.rand(-7, 7));
      }
      g.stroke();
      g.restore();
    }

    for (i = 0; i < this.powerups.length; i++) this.powerups[i].render(g, this.quality);
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].render(g, this.quality);
    if (this.boss) this.boss.render(g, this.quality);
    if (this.player) this.player.render(g, this.quality);
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].render(g, this.quality);
    this.particles.render(g);
    g.restore();

    // HUD
    PW.HUD.render(g, this);

    // 阶段文案
    if (this.phase === 'intro') {
      var a = U.clamp(this.phaseT / 0.6, 0, 1);
      PW.HUD.dim(g, 0.35 * U.clamp(this.phaseT / 2.2, 0, 1) + 0.2);
      var title = this.endless ? 'ENDLESS' : (this.daily ? 'DAILY CHALLENGE' : 'LEVEL ' + this.levelId);
      var sub = this.endless ? '生存下去，能撑多久'
        : (this.daily ? this.modText() : PW.getLevel(this.levelId).name + ' · 击落 ' + this.quota + ' 架');
      PW.HUD.banner(g, title, sub, PW.BG.theme.ui, a);
      if (this.daily) {
        g.save();
        g.textAlign = 'center';
        g.fillStyle = U.alpha('#FFFFFF', 0.75);
        g.font = '12px "Consolas", monospace';
        var lines = this.modDesc();
        for (var li = 0; li < lines.length; li++) g.fillText(lines[li], W / 2, H * 0.42 + 52 + li * 18);
        g.restore();
      }
    } else if (this.phase === 'bossWarn') {
      var k = 1 - this.phaseT / 2.0;
      g.save();
      g.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(this.time * 9));
      g.fillStyle = C.danger;
      g.fillRect(0, 0, W, H);
      g.restore();
      PW.HUD.banner(g, 'WARNING', 'BOSS 来袭', C.danger, U.clamp(this.phaseT, 0, 1));
    } else if (this.phase === 'cleared') {
      PW.HUD.dim(g, 0.45);
      PW.HUD.banner(g, 'STAGE CLEAR', '奖励 +' + U.fmt(this.lastBonus || 0), C.green, U.clamp(this.phaseT / 1.2, 0, 1));
    } else if (this.phase === 'dying') {
      PW.HUD.dim(g, 0.5 * (1 - this.phaseT / 1.4));
    }

    // 移动端按钮：触摸方案或触屏设备都渲染，保证手机上够得着炸弹/技能
    if (PW.Input.scheme === 'touch' || PW.Input.isTouch()) this.btns = PW.HUD.renderControls(g);
    else this.btns = [];
  };

  Scene.prototype.modText = function () {
    var s = [];
    for (var i = 0; i < this.mods.length; i++) s.push(this.mods[i].name);
    return s.join(' / ');
  };
  Scene.prototype.modDesc = function () {
    var s = [];
    for (var i = 0; i < this.mods.length; i++) s.push('· ' + this.mods[i].desc);
    return s;
  };

  /* 移动端按钮命中测试 */
  Scene.prototype.hitButton = function (x, y) {
    for (var i = 0; i < this.btns.length; i++) {
      var b = this.btns[i];
      if (U.dist2(x, y, b.x, b.y) <= 34 * 34) return b.id;
    }
    return null;
  };

  Scene.prototype.pause = function () { this.paused = true; PW.Input.clear(); };
  Scene.prototype.resume = function () { this.paused = false; PW.Input.clear(); };
  Scene.prototype.stop = function () { this.running = false; };

  PW.Scene = Scene;
})(window);
