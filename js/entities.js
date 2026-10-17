/* 实体：子弹 / 粒子 / 玩家 / 敌机 / BOSS / 道具
 * 全部矢量绘制，无图片资源。
 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});
  var U = PW.U, C = PW.C;

  /* ============================ 粒子 ============================ */
  function Particles(limit) {
    this.list = [];
    this.limit = limit || 260;
    this.rings = [];
  }
  Particles.prototype.spark = function (x, y, color, n, spd, life) {
    n = n || 8;
    if (this.list.length > this.limit) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, s = U.rand(spd * 0.3, spd);
      this.list.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: U.rand(life * 0.5, life), max: life, color: color, size: U.rand(1.5, 3.4)
      });
    }
  };
  Particles.prototype.ring = function (x, y, color, r, life) {
    this.rings.push({ x: x, y: y, color: color, r: r * 0.2, max: r, life: life || 0.45, t: life || 0.45 });
  };
  Particles.prototype.text = function (x, y, txt, color) {
    this.list.push({ txt: txt, x: x, y: y, vx: 0, vy: -46, life: 0.85, max: 0.85, color: color, size: 13 });
  };
  Particles.prototype.update = function (dt) {
    var i, p;
    for (i = this.list.length - 1; i >= 0; i--) {
      p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      if (p.txt) p.vy *= 0.97;
    }
    for (i = this.rings.length - 1; i >= 0; i--) {
      var r = this.rings[i];
      r.t -= dt;
      if (r.t <= 0) { this.rings.splice(i, 1); continue; }
      r.r = r.max * (1 - r.t / r.life);
    }
  };
  Particles.prototype.render = function (g) {
    var i, p;
    for (i = 0; i < this.list.length; i++) {
      p = this.list[i];
      var a = Math.max(0, p.life / p.max);
      g.globalAlpha = a;
      if (p.txt) {
        g.fillStyle = p.color;
        g.font = 'bold ' + p.size + 'px "Consolas", monospace';
        g.textAlign = 'center';
        g.fillText(p.txt, p.x, p.y);
      } else {
        g.fillStyle = p.color;
        g.beginPath(); g.arc(p.x, p.y, p.size * a, 0, 6.2832); g.fill();
      }
    }
    for (i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      g.globalAlpha = Math.max(0, r.t / r.life) * 0.8;
      g.strokeStyle = r.color; g.lineWidth = 2.5;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, 6.2832); g.stroke();
    }
    g.globalAlpha = 1;
  };
  Particles.prototype.clear = function () { this.list.length = 0; this.rings.length = 0; };

  /* ============================ 子弹 ============================ */
  function Bullet(o) {
    this.x = o.x; this.y = o.y;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.r = o.r || 3;
    this.dmg = o.dmg || 1;
    this.color = o.color || C.primary;
    this.friendly = !!o.friendly;
    this.homing = o.homing || 0;      // 追踪强度
    this.pierce = o.pierce || 0;      // 穿透次数
    this.chain = o.chain || 0;        // 链式跳跃次数
    this.laser = o.laser || 0;        // 激光长度（0 为非激光）
    this.grazed = false;              // 敌弹是否已被擦过
    this.alive = true;
    this.age = 0;
    this.slow = 1;                    // 时间凝滞系数
  }
  Bullet.prototype.update = function (dt, player, enemies) {
    this.age += dt;
    if (this.homing > 0 && this.friendly) {
      // 追踪最近敌机（含 Boss）
      var t = nearestTarget(this.x, this.y, enemies);
      if (t) {
        var ang = Math.atan2(t.y - this.y, t.x - this.x);
        var cur = Math.atan2(this.vy, this.vx);
        var d = Math.atan2(Math.sin(ang - cur), Math.cos(ang - cur));
        var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        cur += U.clamp(d, -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
      }
    }
    this.x += this.vx * dt * this.slow;
    this.y += this.vy * dt * this.slow;
    if (this.x < -40 || this.x > PW.VIEW.w + 40 || this.y < -60 || this.y > PW.VIEW.h + 60) this.alive = false;
  };
  Bullet.prototype.render = function (g, quality) {
    var col = this.color;
    if (this.friendly) {
      if (quality === 'high') { g.shadowColor = col; g.shadowBlur = 10; }
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(this.x, this.y, this.r * 0.8, this.r * 2.1, 0, 0, 6.2832);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(this.x, this.y, this.r * 0.45, 0, 6.2832); g.fill();
    } else {
      if (quality === 'high') { g.shadowColor = col; g.shadowBlur = 9; }
      g.fillStyle = col;
      g.beginPath(); g.arc(this.x, this.y, this.r, 0, 6.2832); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath(); g.arc(this.x, this.y, this.r * 0.4, 0, 6.2832); g.fill();
    }
  };

  function nearestTarget(x, y, list) {
    var best = null, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.alive) continue;
      var d = U.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ============================ 玩家 ============================ */
  function Player(planeCfg, opts) {
    this.cfg = planeCfg;
    this.x = PW.VIEW.w / 2;
    this.y = PW.VIEW.h - 110;
    this.r = 9;               // 受击判定点（小判定，更公平）
    this.grazeR = 30;         // 擦弹判定
    this.bodyR = 18;          // 绘制尺寸
    this.maxHp = (opts && opts.hp) || planeCfg.maxHp;
    this.hp = this.maxHp;
    this.shield = 0;
    this.alive = true;
    this.fireT = 0;
    this.weaponLv = 1;
    this.bombs = 3;
    this.wingmen = [];
    this.invuln = 2.0;        // 出生无敌
    this.skillCd = 0;
    this.skillT = 0;
    this.overdriveT = 0;      // 擦弹满触发的过载
    this.combo = 0;
    this.comboT = 0;
    this.graze = 0;
    this.charge = 0;          // 擦弹充能 0~100
    this.scoreMulT = 0;
    this.timeScale = 1;       // 自身子弹不受凝滞影响
    this.hitFlash = 0;
    this.deadT = 0;
    this.moved = 0;
    this.tilt = 0;
    for (var i = 0; i < planeCfg.wingmen; i++) this.addWingman();
  }
  Player.prototype.addWingman = function () {
    if (this.wingmen.length >= 2) return false;
    this.wingmen.push({ side: this.wingmen.length === 0 ? -1 : 1, t: Math.random() * 6.28, fireT: 0 });
    return true;
  };
  Player.prototype.weapon = function () { return PW.WEAPONS[Math.min(PW.WEAPONS.length - 1, this.weaponLv - 1)]; };
  Player.prototype.fireRate = function () {
    var w = this.weapon();
    var m = this.cfg.fireRateMult;
    if (this.skillT > 0 && this.cfg.skill.id === 'overdrive') m *= (this.cfg.id === 'swift' ? 2.2 : 2);
    if (this.overdriveT > 0) m *= 1.5;
    return w.rate * m;
  };
  Player.prototype.damage = function () {
    var d = this.weapon().damage * this.cfg.damageMult;
    if (this.skillT > 0 && this.cfg.skill.id === 'overdrive') d *= 1.5;
    if (this.skillT > 0 && this.cfg.skill.id === 'fortress') d *= 1.5;
    if (this.overdriveT > 0) d *= 1.3;
    return d;
  };
  Player.prototype.isInvuln = function () {
    return this.invuln > 0 || (this.skillT > 0 && this.cfg.skill.id === 'fortress') ||
      (this.skillT > 0 && this.cfg.skill.id === 'phase');
  };
  Player.prototype.update = function (dt, move) {
    if (!this.alive) return;
    var sp = this.cfg.speed * (move.slow ? 0.45 : 1);
    if (this.skillT > 0 && this.cfg.skill.id === 'overdrive' && this.cfg.id === 'swift') sp *= 1.35;
    this.x += move.x * sp * dt;
    this.y += move.y * sp * dt;
    this.x = U.clamp(this.x, 14, PW.VIEW.w - 14);
    this.y = U.clamp(this.y, 40, PW.VIEW.h - 24);
    this.tilt = U.lerp(this.tilt, move.x * 0.32, Math.min(1, dt * 9));

    if (this.invuln > 0) this.invuln -= dt;
    if (this.skillCd > 0) this.skillCd -= dt;
    if (this.skillT > 0) this.skillT -= dt;
    if (this.overdriveT > 0) this.overdriveT -= dt;
    if (this.scoreMulT > 0) this.scoreMulT -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.fireT -= dt;
    for (var i = 0; i < this.wingmen.length; i++) {
      var wm = this.wingmen[i];
      wm.t += dt * 2.4; wm.fireT -= dt;
    }
  };
  Player.prototype.wingmanPos = function (wm) {
    return {
      x: this.x + wm.side * 30 + Math.cos(wm.t) * 5,
      y: this.y + 16 + Math.sin(wm.t) * 5
    };
  };
  Player.prototype.canFire = function () { return this.alive && this.fireT <= 0; };
  Player.prototype.markFired = function () {
    var rate = this.fireRate();
    this.fireT = rate > 0 ? 1 / rate : 0.2;
  };
  /* 返回 true 表示受到实质伤害 */
  Player.prototype.takeHit = function () {
    if (this.isInvuln()) return false;
    if (this.shield > 0) {
      this.shield--;
      this.invuln = 0.9;
      this.hitFlash = 0.25;
      return false;
    }
    this.hp--;
    this.combo = 0;
    this.invuln = 1.4;
    this.hitFlash = 0.35;
    if (this.weaponLv > 1) this.weaponLv--; // 受击掉一级火力
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  };
  Player.prototype.render = function (g, quality) {
    if (!this.alive) return;
    var blink = this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;
    var col = this.hitFlash > 0 ? '#FFFFFF' : this.cfg.color;

    // 僚机
    for (var i = 0; i < this.wingmen.length; i++) {
      var p = this.wingmanPos(this.wingmen[i]);
      drawShip(g, p.x, p.y, 11, this.cfg.color, quality, 0, true);
    }

    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.tilt * 0.5);
    if (blink) g.globalAlpha = 0.45;

    // 擦弹判定圈（浅色，提示擦弹范围）
    if (quality === 'high' && this.grazeR > 0) {
      g.strokeStyle = U.alpha(this.cfg.color, 0.10);
      g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, this.grazeR, 0, 6.2832); g.stroke();
    }

    drawShip(g, 0, 0, this.bodyR, col, quality, this.skillT > 0 || this.overdriveT > 0, false);

    // 护盾环
    if (this.shield > 0) {
      g.strokeStyle = U.alpha(C.primary, 0.85);
      g.lineWidth = 2;
      if (quality === 'high') { g.shadowColor = C.primary; g.shadowBlur = 12; }
      g.beginPath(); g.arc(0, 0, this.bodyR + 8, 0, 6.2832); g.stroke();
      g.shadowBlur = 0;
      if (this.shield > 1) {
        g.strokeStyle = U.alpha(C.primary, 0.45);
        g.beginPath(); g.arc(0, 0, this.bodyR + 13, 0, 6.2832); g.stroke();
      }
    }
    // 判定点
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.arc(0, 0, 2.6, 0, 6.2832); g.fill();
    g.restore();
  };

  /* 通用战机绘制：向上箭头机身 + 后掠翼 + 引擎焰 */
  function drawShip(g, x, y, r, color, quality, boost, small) {
    g.save();
    g.translate(x, y);
    if (quality === 'high') { g.shadowColor = color; g.shadowBlur = 12; }
    // 引擎焰
    var fl = boost ? U.rand(1.1, 1.9) : U.rand(0.7, 1.2);
    var fg = g.createLinearGradient(0, r * 0.6, 0, r * (0.6 + fl));
    fg.addColorStop(0, U.alpha(boost ? C.yellow : C.primary, 0.9));
    fg.addColorStop(1, U.alpha(boost ? C.orange : C.primary, 0));
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(-r * 0.30, r * 0.55); g.lineTo(0, r * (0.7 + fl)); g.lineTo(r * 0.30, r * 0.55);
    g.closePath(); g.fill();

    // 机翼
    g.fillStyle = U.alpha(color, 0.35);
    g.strokeStyle = color; g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-r * 0.95, r * 0.34); g.lineTo(-r * 0.22, -r * 0.10);
    g.lineTo(r * 0.22, -r * 0.10); g.lineTo(r * 0.95, r * 0.34);
    g.lineTo(r * 0.42, r * 0.46); g.lineTo(-r * 0.42, r * 0.46);
    g.closePath(); g.fill(); g.stroke();

    // 机身
    g.fillStyle = '#0B1224';
    g.beginPath();
    g.moveTo(0, -r);
    g.lineTo(r * 0.36, -r * 0.18);
    g.lineTo(r * 0.30, r * 0.62);
    g.lineTo(0, r * 0.44);
    g.lineTo(-r * 0.30, r * 0.62);
    g.lineTo(-r * 0.36, -r * 0.18);
    g.closePath(); g.fill(); g.stroke();

    // 座舱
    g.fillStyle = U.alpha(color, 0.95);
    g.beginPath(); g.ellipse(0, -r * 0.28, r * 0.16, r * 0.30, 0, 0, 6.2832); g.fill();
    g.shadowBlur = 0;
    g.restore();
  }
  PW.drawShip = drawShip;

  /* ============================ 敌机 ============================ */
  function Enemy(cfg, x, y, opts) {
    opts = opts || {};
    this.cfg = cfg;
    this.id = cfg.id;
    this.x = x; this.y = y;
    this.r = cfg.r;
    this.maxHp = Math.max(1, Math.round(cfg.hp * (opts.hpMul || 1)));
    this.hp = this.maxHp;
    this.shield = cfg.shield ? Math.round(cfg.shield * (opts.hpMul || 1)) : 0;
    this.maxShield = this.shield;
    this.speed = cfg.speed * (opts.speedMul || 1);
    this.alive = true;
    this.fireT = cfg.fire ? U.rand(0.4, 1.6) : 0;
    this.age = 0;
    this.t = Math.random() * 6.28;
    this.baseX = x;
    this.entering = y < 0;
    /* 悬停巡航：敌机下降到指定高度后停住横向游走，保证一架都打得掉、不会漏出场外。
     * 母舰放出的小蜂（minion）属额外目标，仍照常飞走。 */
    this.holding = false;
    this.holdY = opts.minion ? 1e9 : PW.VIEW.h * U.rand(0.30, 0.56);
    this.holdVx = (x < PW.VIEW.w * 0.5 ? 1 : -1) * U.rand(38, 78);
    this.hitFlash = 0;
    this.cloak = 0;            // 隐形剩余时间
    this.cloakT = cfg.cloaked ? U.rand(2.5, 5) : 0;
    this.summonT = cfg.carrier ? 3 : 0;
    this.summonLeft = cfg.carrier ? 4 : 0;   // 母舰最多放 4 只小蜂，避免悬停后无限刷
    this.laserT = cfg.laser ? U.rand(2.5, 5) : 0;
    this.laserWarn = 0;        // 预警时长
    this.laserFire = 0;        // 开火时长
    this.laserX = 0;
    this.color = cfg.color;
    this.isMinion = !!opts.minion;
  }
  Enemy.prototype.update = function (dt, W) {
    W = W || {};
    this.age += dt; this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    var slow = W.slow || 1;
    var d = dt * slow;

    if (this.cloakT > 0) {
      this.cloakT -= dt;
      if (this.cloakT <= 0) { this.cloak = 1.6; this.cloakT = U.rand(3.5, 6.5); }
    }
    if (this.cloak > 0) this.cloak -= dt;

    var vy = this.speed, vx = 0;
    switch (this.cfg.pattern) {
      case 'sine':
        vx = Math.sin(this.t * 2.1) * 92;
        vy = this.speed * 0.85;
        break;
      case 'side':
        vx = Math.cos(this.t * 0.85) * 130;
        vy = this.speed * 0.55;
        break;
      case 'drift':
        vx = Math.sin(this.t * 0.6) * 68;
        vy = this.speed * 0.42;
        break;
      case 'track':
        if (W.player && W.player.alive) {
          var a = Math.atan2(W.player.y - this.y, W.player.x - this.x);
          // 追踪但保持前进，速度较慢时更像"制导"
          vx = Math.cos(a) * this.speed * 0.85;
          vy = Math.max(this.speed * 0.35, Math.sin(a) * this.speed * 0.85);
        } else vy = this.speed;
        break;
      default:
        vy = this.speed;
    }
    /* 到达悬停高度后转为横向巡航：不再下压，直到被击落 */
    if (!this.holding && this.y >= this.holdY) {
      this.holding = true;
      this.y = this.holdY;
    }
    if (this.holding) {
      this.x += this.holdVx * d;
      var m = 24 + this.r;
      if (this.x < m) { this.x = m; this.holdVx = Math.abs(this.holdVx); }
      else if (this.x > PW.VIEW.w - m) { this.x = PW.VIEW.w - m; this.holdVx = -Math.abs(this.holdVx); }
      this.y = this.holdY + Math.sin(this.t * 1.6) * 10;
    } else {
      this.x += vx * d;
      this.y += vy * d;
    }

    /* 左右边界内收：任何情况下都不允许从侧面飞出，保证一架都跑不掉 */
    var lim = 24 + this.r;
    if (this.x < lim) { this.x = lim; this.holdVx = Math.abs(this.holdVx); }
    else if (this.x > PW.VIEW.w - lim) { this.x = PW.VIEW.w - lim; this.holdVx = -Math.abs(this.holdVx); }

    // 母舰放小蜂（有次数上限）
    if (this.cfg.carrier && this.summonLeft > 0) {
      this.summonT -= dt;
      if (this.summonT <= 0 && this.y > 40 && this.y < PW.VIEW.h * 0.6 && W.spawnMinion) {
        this.summonT = 3.4;
        this.summonLeft--;
        W.spawnMinion(this.x, this.y + 14);
      }
    }
    // 激光炮艇：预警 -> 开火
    if (this.cfg.laser) {
      if (this.laserWarn > 0) {
        this.laserWarn -= dt;
        if (this.laserWarn <= 0) { this.laserFire = 0.55; if (W.onLaser) W.onLaser(this); }
      } else if (this.laserFire > 0) {
        this.laserFire -= dt;
      } else {
        this.laserT -= dt;
        if (this.laserT <= 0 && this.y > 60 && this.y < PW.VIEW.h * 0.55 && W.player) {
          this.laserWarn = 0.85;
          this.laserX = W.player.x;
          this.laserT = U.rand(4, 7);
        }
      }
    }

    // 开火（悬停时火力放缓，避免站桩刷屏）
    if (this.cfg.fire > 0) {
      this.fireT -= dt * slow * (this.holding ? 0.6 : 1);
      if (this.fireT <= 0 && this.y > 20 && this.y < PW.VIEW.h - 90 && W.player && W.player.alive && W.spawnEnemyBullet) {
        this.fireT = 1 / this.cfg.fire * U.rand(0.8, 1.4);
        var ang = Math.atan2(W.player.y - this.y, W.player.x - this.x);
        if (this.id === 'E3') {
          // 散射三连
          for (var k = -1; k <= 1; k++) {
            W.spawnEnemyBullet(this.x, this.y + 10, Math.cos(ang + k * 0.34) * this.cfg.bspeed, Math.sin(ang + k * 0.34) * this.cfg.bspeed, this.color);
          }
        } else {
          W.spawnEnemyBullet(this.x, this.y + 10, Math.cos(ang) * this.cfg.bspeed, Math.sin(ang) * this.cfg.bspeed, this.color);
        }
      }
    }

    if (this.y > PW.VIEW.h + 60 || this.x < -80 || this.x > PW.VIEW.w + 80) this.alive = false;
  };
  /* 返回 'dead' | 'shield' | 'hit' */
  Enemy.prototype.hurt = function (dmg) {
    if (this.shield > 0) {
      this.shield -= dmg;
      this.hitFlash = 0.1;
      if (this.shield <= 0) { this.shield = 0; return 'shield'; }
      return 'shield';
    }
    this.hp -= dmg;
    this.hitFlash = 0.1;
    if (this.hp <= 0) { this.alive = false; return 'dead'; }
    return 'hit';
  };
  Enemy.prototype.render = function (g, quality) {
    var a = 1;
    if (this.cloak > 0) a = 0.18;
    g.save();
    g.globalAlpha = a;
    var col = this.hitFlash > 0 ? '#FFFFFF' : this.color;
    if (quality === 'high') { g.shadowColor = col; g.shadowBlur = 10; }
    drawEnemyShape(g, this.id, this.x, this.y, this.r, col);
    g.shadowBlur = 0;

    // 护盾环
    if (this.shield > 0) {
      g.strokeStyle = U.alpha(C.primary, 0.7);
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.x, this.y, this.r + 6, 0, 6.2832); g.stroke();
    }
    // 精英标记
    if (this.cfg.elite && quality === 'high') {
      g.strokeStyle = U.alpha(col, 0.55);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(this.x, this.y, this.r + 11, this.t % 6.2832, this.t % 6.2832 + 1.1);
      g.stroke();
    }
    // 激光预警线
    if (this.laserWarn > 0) {
      var k = 1 - this.laserWarn / 0.85;
      g.strokeStyle = U.alpha(C.danger, 0.35 + 0.5 * k);
      g.lineWidth = 1 + 3 * k;
      g.setLineDash([8, 6]);
      g.beginPath(); g.moveTo(this.x, this.y + 10); g.lineTo(this.laserX, PW.VIEW.h); g.stroke();
      g.setLineDash([]);
    }
    if (this.laserFire > 0) {
      // 沿预警方向画一道由粗变细的光束
      var k2 = 1 - this.laserFire / 0.55;
      var w2 = 4 + 10 * k2;
      g.strokeStyle = U.alpha(C.danger, 0.55 + 0.45 * k2);
      g.lineWidth = w2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(this.x, this.y + 8); g.lineTo(this.laserX, PW.VIEW.h); g.stroke();
      g.strokeStyle = U.alpha('#FFFFFF', 0.55 + 0.45 * k2);
      g.lineWidth = Math.max(1, w2 * 0.35);
      g.beginPath(); g.moveTo(this.x, this.y + 8); g.lineTo(this.laserX, PW.VIEW.h); g.stroke();
      g.lineCap = 'butt';
    }
    // 血条（精英 / 高血量）
    if (this.maxHp >= 6 && this.hp < this.maxHp) {
      var bw = this.r * 2;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(this.x - bw / 2, this.y - this.r - 10, bw, 3);
      g.fillStyle = this.hp / this.maxHp > 0.4 ? C.green : C.danger;
      g.fillRect(this.x - bw / 2, this.y - this.r - 10, bw * (this.hp / this.maxHp), 3);
    }
    g.restore();
  };

  function drawEnemyShape(g, id, x, y, r, col) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = col; g.lineWidth = 1.8;
    g.fillStyle = U.alpha(col, 0.22);
    g.beginPath();
    switch (id) {
      case 'E1': // 侦察机：小三角（朝下）
        g.moveTo(0, r); g.lineTo(-r * 0.85, -r * 0.7); g.lineTo(0, -r * 0.35); g.lineTo(r * 0.85, -r * 0.7);
        break;
      case 'E2': // 截击机：双翼
        g.moveTo(0, r * 0.9); g.lineTo(-r * 0.9, -r * 0.1); g.lineTo(-r * 0.35, -r * 0.5);
        g.lineTo(0, -r * 0.9); g.lineTo(r * 0.35, -r * 0.5); g.lineTo(r * 0.9, -r * 0.1);
        break;
      case 'E3': // 重装机：宽六边形
        g.moveTo(-r, -r * 0.2); g.lineTo(-r * 0.55, -r * 0.75); g.lineTo(r * 0.55, -r * 0.75);
        g.lineTo(r, -r * 0.2); g.lineTo(r * 0.6, r * 0.8); g.lineTo(-r * 0.6, r * 0.8);
        break;
      case 'E4': // 自爆机：菱形 + 内核
        g.moveTo(0, r); g.lineTo(-r * 0.8, 0); g.lineTo(0, -r); g.lineTo(r * 0.8, 0);
        break;
      case 'E5': // 护盾机：八边形
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * 6.2832 + 0.39;
          var px = Math.cos(a) * r, py = Math.sin(a) * r;
          i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        break;
      case 'E6': // 隐形机：细长箭
        g.moveTo(0, r); g.lineTo(-r * 0.5, -r * 0.1); g.lineTo(-r * 0.2, -r);
        g.lineTo(r * 0.2, -r); g.lineTo(r * 0.5, -r * 0.1);
        break;
      case 'E7': // 母舰：大六边形 + 内舱
        g.moveTo(-r, 0); g.lineTo(-r * 0.5, -r * 0.85); g.lineTo(r * 0.5, -r * 0.85);
        g.lineTo(r, 0); g.lineTo(r * 0.5, r * 0.85); g.lineTo(-r * 0.5, r * 0.85);
        break;
      case 'E8': // 炮艇：方块 + 炮管
        g.moveTo(-r * 0.8, -r * 0.5); g.lineTo(r * 0.8, -r * 0.5); g.lineTo(r * 0.7, r * 0.5);
        g.lineTo(-r * 0.7, r * 0.5);
        break;
      default: // 小蜂
        g.moveTo(0, r); g.lineTo(-r * 0.9, -r * 0.6); g.lineTo(r * 0.9, -r * 0.6);
    }
    g.closePath(); g.fill(); g.stroke();

    // 内核
    g.fillStyle = U.alpha(col, 0.9);
    g.beginPath(); g.arc(0, id === 'E4' ? 0 : r * 0.12, r * 0.22, 0, 6.2832); g.fill();
    if (id === 'E8') { // 炮管
      g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, r * 0.4); g.lineTo(0, r * 1.1); g.stroke();
    }
    g.restore();
  }

  /* ============================ BOSS ============================ */
  function Boss(theme, hpMul) {
    this.theme = theme;
    this.x = PW.VIEW.w / 2;
    this.y = -90;
    this.r = 52;
    this.maxHp = Math.round(theme.hp * (hpMul || 1));
    this.hp = this.maxHp;
    this.alive = true;
    this.entering = true;
    this.targetY = 118;
    this.age = 0;
    this.t = 0;
    this.patterns = theme.patterns;
    this.pi = 0;
    this.pTimer = 1.2;
    this.phase = 1;
    this.spiralA = 0;
    this.sweepDir = 1;
    this.sweepX = PW.VIEW.w * 0.25;
    this.hitFlash = 0;
    this.summonT = 6;
    this.laserWarn = 0;
    this.laserFire = 0;
    this.laserX = this.x;
    this._spiralT = 0;
    this.color = theme.color;
    this.name = theme.name;
    this.deadT = 0;
  }
  Boss.prototype.maxPhase = function () { return this.hp / this.maxHp > 0.55 ? 1 : (this.hp / this.maxHp > 0.22 ? 2 : 3); };
  Boss.prototype.update = function (dt, W) {
    this.age += dt; this.t += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    var slow = W.slow || 1, d = dt * slow;

    if (this.entering) {
      this.y = U.lerp(this.y, this.targetY, Math.min(1, d * 2.2));
      if (Math.abs(this.y - this.targetY) < 1.5) { this.y = this.targetY; this.entering = false; }
    } else {
      // 横向巡航
      this.x += Math.cos(this.t * 0.55) * 62 * d;
      this.x = U.clamp(this.x, 70, PW.VIEW.w - 70);
      this.y = this.targetY + Math.sin(this.t * 0.9) * 8;
    }
    this.phase = this.maxPhase();

    // 激光（独立计时）
    if (this.laserWarn > 0) {
      this.laserWarn -= dt;
      if (this.laserWarn <= 0) { this.laserFire = 0.8; if (W.onLaser) W.onLaser(this); }
    } else if (this.laserFire > 0) this.laserFire -= dt;

    if (this.entering) return;

    // 弹幕套路轮转
    this.pTimer -= dt * slow;
    if (this.pTimer <= 0) {
      var p = this.patterns[this.pi % this.patterns.length];
      this.pi++;
      this.firePattern(p, W);
      this.pTimer = (p === 'laser' ? 2.2 : (p === 'summon' ? 3.4 : 1.5)) / (0.85 + this.phase * 0.22);
    }
    // 持续型套路（螺旋）单独推进
    if (this._spiralT > 0) {
      this._spiralT -= dt * slow;
      this.spiralA += dt * slow * 2.6;
      if (W.spawnEnemyBullet) {
        var n = 2 + this.phase;
        for (var s = 0; s < n; s++) {
          var a = this.spiralA + s / n * 6.2832;
          W.spawnEnemyBullet(this.x, this.y + 18, Math.sin(a) * 165, Math.cos(a) * 165, this.color);
        }
      }
    }
    // 召唤
    if (this.patterns.indexOf('summon') >= 0) {
      this.summonT -= dt * slow;
      if (this.summonT <= 0 && W.spawnMinion) {
        this.summonT = 7 - this.phase;
        W.spawnMinion(this.x - 40, this.y + 20, true);
        W.spawnMinion(this.x + 40, this.y + 20, true);
      }
    }
  };
  Boss.prototype.firePattern = function (p, W) {
    if (!W.spawnEnemyBullet) return;
    var sp = 175 + this.phase * 22;
    var i, a;
    switch (p) {
      case 'spread':
        var cnt = 7 + this.phase * 3;
        if (W.player) {
          var base = Math.atan2(W.player.y - this.y, W.player.x - this.x);
          for (i = 0; i < cnt; i++) {
            a = base + (i - (cnt - 1) / 2) * 0.19;
            W.spawnEnemyBullet(this.x, this.y + 16, Math.cos(a) * sp, Math.sin(a) * sp, this.color);
          }
        }
        break;
      case 'ring':
        var rn = 12 + this.phase * 4;
        for (i = 0; i < rn; i++) {
          a = i / rn * 6.2832 + this.t * 0.3;
          W.spawnEnemyBullet(this.x, this.y, Math.cos(a) * sp * 0.85, Math.sin(a) * sp * 0.85, this.color);
        }
        break;
      case 'sweep':
        var sn = 5 + this.phase;
        for (i = 0; i < sn; i++) {
          a = (0.62 + i * 0.10) * this.sweepDir;
          W.spawnEnemyBullet(this.x, this.y + 16, Math.sin(a) * sp, Math.cos(a) * sp, this.color, 4.5);
        }
        this.sweepDir *= -1;
        break;
      case 'tracking':
        if (W.player) {
          var tn = 3 + this.phase;
          for (i = 0; i < tn; i++) {
            a = Math.atan2(W.player.y - this.y, W.player.x - this.x) + (i - (tn - 1) / 2) * 0.3;
            W.spawnEnemyBullet(this.x, this.y + 16, Math.cos(a) * sp * 0.8, Math.sin(a) * sp * 0.8, C.accent, 3.6, 1.9);
          }
        }
        break;
      case 'spiral':
        this._spiralT = 2.4;
        break;
      case 'laser':
        this.laserWarn = 0.9;
        this.laserX = this.x;
        if (W.sfx) W.sfx('warn');
        break;
      case 'summon':
        if (W.spawnMinion) {
          W.spawnMinion(this.x - 40, this.y + 20, true);
          W.spawnMinion(this.x + 40, this.y + 20, true);
        }
        break;
    }
  };
  Boss.prototype.hurt = function (dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; return 'dead'; }
    return 'hit';
  };
  Boss.prototype.render = function (g, quality) {
    var col = this.hitFlash > 0 ? '#FFFFFF' : this.color;
    g.save();
    if (quality === 'high') { g.shadowColor = col; g.shadowBlur = 18; }
    g.translate(this.x, this.y);
    var r = this.r;
    g.strokeStyle = col; g.lineWidth = 2.4;
    g.fillStyle = U.alpha(col, 0.18);

    // 主体：对称多面体
    g.beginPath();
    g.moveTo(0, r * 0.95);
    g.lineTo(-r * 0.55, r * 0.35);
    g.lineTo(-r, -r * 0.15);
    g.lineTo(-r * 0.62, -r * 0.62);
    g.lineTo(0, -r * 0.85);
    g.lineTo(r * 0.62, -r * 0.62);
    g.lineTo(r, -r * 0.15);
    g.lineTo(r * 0.55, r * 0.35);
    g.closePath(); g.fill(); g.stroke();

    // 侧翼炮
    g.fillStyle = U.alpha(col, 0.35);
    g.beginPath(); g.rect(-r * 1.15, -r * 0.28, r * 0.35, r * 0.75); g.fill(); g.stroke();
    g.beginPath(); g.rect(r * 0.80, -r * 0.28, r * 0.35, r * 0.75); g.fill(); g.stroke();

    // 核心（阶段越高越亮）
    var pulse = 0.6 + 0.4 * Math.sin(this.t * (3 + this.phase * 2));
    g.fillStyle = U.alpha(this.phase >= 3 ? C.danger : col, 0.55 + 0.45 * pulse);
    g.beginPath(); g.arc(0, 0, r * 0.30 * (0.85 + 0.2 * pulse), 0, 6.2832); g.fill();
    g.shadowBlur = 0;

    // 阶段指示环
    g.strokeStyle = U.alpha(col, 0.35);
    g.lineWidth = 1.4;
    for (var ph = 0; ph < this.phase; ph++) {
      g.beginPath(); g.arc(0, 0, r + 10 + ph * 7, this.t + ph, this.t + ph + 1.9); g.stroke();
    }
    g.restore();

    // 激光预警 / 开火
    if (this.laserWarn > 0) {
      var k = 1 - this.laserWarn / 0.9;
      g.strokeStyle = U.alpha(C.danger, 0.3 + 0.55 * k);
      g.lineWidth = 2 + 5 * k;
      g.setLineDash([10, 7]);
      g.beginPath(); g.moveTo(this.x, this.y + 20); g.lineTo(this.x, PW.VIEW.h); g.stroke();
      g.setLineDash([]);
    }
    if (this.laserFire > 0) {
      var w = 5 + 16 * (1 - this.laserFire / 0.8);
      var lg = g.createLinearGradient(this.x - w, 0, this.x + w, 0);
      lg.addColorStop(0, U.alpha(C.danger, 0));
      lg.addColorStop(0.5, '#FFFFFF');
      lg.addColorStop(1, U.alpha(C.danger, 0));
      g.fillStyle = lg;
      g.fillRect(this.x - w, this.y, w * 2, PW.VIEW.h - this.y);
    }
  };

  /* ============================ 道具 ============================ */
  function PowerUp(type, x, y) {
    this.type = type;
    this.x = x; this.y = y;
    this.r = 13;
    this.vy = 78;
    this.age = 0;
    this.alive = true;
    var p = PW.POWERUPS[type];
    this.color = p.color; this.letter = p.letter;
  }
  PowerUp.prototype.update = function (dt, player) {
    this.age += dt;
    this.y += this.vy * dt;
    // 靠近玩家时轻微吸附，减少"差一点没吃到"的挫败
    if (player && player.alive) {
      var d = U.dist(this.x, this.y, player.x, player.y);
      if (d < 90) {
        var k = (90 - d) / 90 * 120;
        var a = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(a) * k * dt;
        this.y += Math.sin(a) * k * dt;
      }
    }
    if (this.y > PW.VIEW.h + 30) this.alive = false;
  };
  PowerUp.prototype.render = function (g, quality) {
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.age * 1.6);
    if (quality === 'high') { g.shadowColor = this.color; g.shadowBlur = 16; }
    g.strokeStyle = this.color; g.lineWidth = 2;
    g.fillStyle = 'rgba(8,16,36,0.9)';
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * 6.2832;
      var px = Math.cos(a) * this.r, py = Math.sin(a) * this.r;
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath(); g.fill(); g.stroke();
    g.rotate(-this.age * 1.6);
    g.fillStyle = this.color;
    g.font = 'bold 15px "Consolas", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(this.letter, 0, 1);
    g.shadowBlur = 0;
    g.restore();
  };

  PW.Ent = {
    Particles: Particles,
    Bullet: Bullet,
    Player: Player,
    Enemy: Enemy,
    Boss: Boss,
    PowerUp: PowerUp,
    nearestTarget: nearestTarget
  };
})(window);
