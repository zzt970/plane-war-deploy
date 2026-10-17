/* HUD：Canvas 内绘制，随画布等比缩放，保证各分辨率下版式一致 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});
  var U = PW.U, C = PW.C;
  var W = PW.VIEW.w, H = PW.VIEW.h;

  function bar(g, x, y, w, h, pct, color, bg) {
    g.fillStyle = bg || 'rgba(255,255,255,0.12)';
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    g.fillRect(x, y, w * U.clamp(pct, 0, 1), h);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function label(g, txt, x, y, color, size, align) {
    g.fillStyle = color;
    g.font = (size || 11) + 'px "Consolas", monospace';
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(txt, x, y);
  }

  var HUD = {
    /* 主 HUD */
    render: function (g, S) {
      var th = PW.BG.theme;
      var ui = th.ui;
      g.save();

      /* ---- 顶部底衬 ---- */
      var tg = g.createLinearGradient(0, 0, 0, 74);
      tg.addColorStop(0, 'rgba(0,0,0,0.62)');
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = tg;
      g.fillRect(0, 0, W, 74);

      /* ---- 分数 ---- */
      label(g, 'SCORE', 12, 20, U.alpha('#FFFFFF', 0.55), 10);
      g.fillStyle = '#FFFFFF';
      g.font = 'bold 24px "Consolas", monospace';
      g.textAlign = 'left';
      g.fillText(U.fmt(S.displayScore), 12, 44);
      if (S.player && S.player.scoreMulT > 0) {
        g.fillStyle = C.yellow;
        g.font = 'bold 11px "Consolas", monospace';
        g.fillText('x2', 12 + g.measureText(U.fmt(S.displayScore)).width + 42, 44);
      }

      /* ---- 最高分 ---- */
      label(g, 'HI ' + U.fmt(S.hi || 0), W - 12, 20, U.alpha(ui, 0.9), 11, 'right');

      /* ---- 关卡 / 模式 ---- */
      var modeTxt = S.endless ? 'ENDLESS  ' + U.time(S.levelTime)
        : (S.daily ? 'DAILY  ' + U.time(S.levelTime) : 'LV.' + S.levelId + '  ' + U.time(S.levelTime));
      label(g, modeTxt, W - 12, 44, U.alpha('#FFFFFF', 0.75), 11, 'right');

      /* ---- 剩余敌机数（打光即召唤 BOSS） ---- */
      if (!S.endless && !S.boss) {
        var rem = S.remaining();
        var total = S.quota || 1;
        label(g, '剩余 ' + rem + ' / ' + total, W - 12, 60, rem > 0 ? U.alpha(ui, 0.95) : C.green, 11, 'right');
      }

      /* ---- 关卡进度条 / BOSS 血条 ---- */
      if (S.boss) {
        var bw = W - 24;
        label(g, S.boss.name + '  PHASE ' + S.boss.phase, 12, 62, U.alpha(S.boss.color, 0.95), 11);
        bar(g, 12, 66, bw, 6, S.boss.hp / S.boss.maxHp, S.boss.color);
      } else if (!S.endless) {
        var done = 1 - S.remaining() / (S.quota || 1);
        bar(g, 12, 66, W - 24, 4, done, U.alpha(ui, 0.85));
      } else {
        bar(g, 12, 66, W - 24, 4, U.clamp(S.levelTime / 300, 0, 1), U.alpha(C.accent, 0.85));
      }

      /* ---- 左下：装甲 + 护盾 ---- */
      var p = S.player;
      if (p) {
        var hx = 12, hy = H - 26;
        for (var i = 0; i < p.maxHp; i++) {
          var on = i < p.hp;
          g.fillStyle = on ? C.green : 'rgba(255,255,255,0.15)';
          g.strokeStyle = on ? U.alpha('#FFFFFF', 0.6) : 'rgba(255,255,255,0.25)';
          g.lineWidth = 1;
          g.beginPath();
          var bx = hx + i * 15;
          g.moveTo(bx, hy); g.lineTo(bx + 6, hy - 7); g.lineTo(bx + 12, hy); g.lineTo(bx + 6, hy + 6);
          g.closePath(); g.fill(); g.stroke();
        }
        if (p.shield > 0) {
          g.strokeStyle = C.primary; g.lineWidth = 1.6;
          for (var s = 0; s < p.shield; s++) {
            g.beginPath(); g.arc(hx + 6 + s * 15, hy - 1, 8, 0, 6.2832); g.stroke();
          }
        }
        /* 火力等级 */
        label(g, 'PWR', 12, H - 40, U.alpha('#FFFFFF', 0.5), 9);
        for (var wI = 0; wI < 5; wI++) {
          g.fillStyle = wI < p.weaponLv ? C.accent : 'rgba(255,255,255,0.15)';
          g.fillRect(38 + wI * 8, H - 47, 6, 6);
        }
        /* 擦弹充能 */
        label(g, 'GRAZE', 96, H - 40, U.alpha('#FFFFFF', 0.5), 9);
        bar(g, 138, H - 47, 74, 6, p.charge / 100, p.charge >= 100 ? C.yellow : U.alpha(C.yellow, 0.6));
      }

      /* ---- 右下：炸弹 / 技能 ---- */
      if (p) {
        var rx = W - 12;
        // 炸弹
        label(g, 'BOMB', rx, H - 40, U.alpha('#FFFFFF', 0.5), 9, 'right');
        for (var b = 0; b < 5; b++) {
          var bx2 = rx - 8 - b * 14;
          g.fillStyle = b < p.bombs ? C.purple : 'rgba(255,255,255,0.13)';
          g.beginPath(); g.arc(bx2, H - 26, 5.5, 0, 6.2832); g.fill();
        }
        // 技能冷却环
        var sx = W - 96, sy = H - 26;
        var cd = p.cfg.skill;
        var ready = p.skillCd <= 0;
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 3;
        g.beginPath(); g.arc(sx, sy, 15, 0, 6.2832); g.stroke();
        g.strokeStyle = ready ? ui : U.alpha(ui, 0.4);
        g.lineWidth = 3;
        if (p.skillT > 0) {
          g.strokeStyle = C.yellow;
          g.beginPath(); g.arc(sx, sy, 15, -1.5708, -1.5708 + 6.2832 * (p.skillT / cd.dur)); g.stroke();
        } else if (!ready) {
          g.beginPath();
          g.arc(sx, sy, 15, -1.5708, -1.5708 + 6.2832 * (1 - p.skillCd / cd.cd));
          g.stroke();
        } else {
          g.beginPath(); g.arc(sx, sy, 15, 0, 6.2832); g.stroke();
        }
        g.fillStyle = ready ? ui : 'rgba(255,255,255,0.35)';
        g.font = 'bold 11px "Consolas", monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ready ? 'C' : Math.ceil(p.skillCd), sx, sy + 1);
        g.textBaseline = 'alphabetic';
      }

      /* ---- 连击 ---- */
      if (p && p.combo >= 3) {
        var cy = 96;
        var k = U.clamp(p.comboT / 2.4, 0, 1);
        g.save();
        g.globalAlpha = 0.35 + 0.65 * k;
        g.textAlign = 'center';
        g.fillStyle = p.combo >= 50 ? C.accent : (p.combo >= 20 ? C.yellow : '#FFFFFF');
        g.font = 'bold ' + (18 + Math.min(14, p.combo / 6)) + 'px "Consolas", monospace';
        g.fillText(p.combo + ' COMBO', W / 2, cy);
        g.restore();
      }

      /* ---- 浮动提示 ---- */
      for (var t = 0; t < S.toasts.length; t++) {
        var to = S.toasts[t];
        var a = U.clamp(to.life / 0.9, 0, 1);
        g.save();
        g.globalAlpha = a;
        g.textAlign = 'center';
        g.fillStyle = to.color;
        g.font = 'bold 13px "Consolas", monospace';
        g.fillText(to.text, W / 2, H * 0.42 - (1 - a) * 30 - t * 20);
        g.restore();
      }

      g.restore();
    },

    /* 移动端虚拟按钮 */
    renderControls: function (g) {
      var r = 30, y = H - 74;
      var btns = [
        { id: 'bomb', x: W - 46, y: y, label: 'BOMB', color: C.purple },
        { id: 'skill', x: W - 46, y: y - 74, label: 'SKILL', color: C.primary },
        { id: 'pause', x: 40, y: 46, label: 'II', color: '#FFFFFF' }
      ];
      g.save();
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        g.globalAlpha = 0.30;
        g.fillStyle = '#0A1428';
        g.beginPath(); g.arc(b.x, b.y, r, 0, 6.2832); g.fill();
        g.globalAlpha = 0.75;
        g.strokeStyle = b.color; g.lineWidth = 2;
        g.beginPath(); g.arc(b.x, b.y, r, 0, 6.2832); g.stroke();
        g.fillStyle = b.color;
        g.font = 'bold 11px "Consolas", monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(b.label, b.x, b.y + 1);
      }
      g.restore();
      return btns;
    },

    /* 大标题文字（关卡开场 / 警告 / 结算） */
    banner: function (g, title, sub, color, alpha) {
      g.save();
      g.globalAlpha = alpha === undefined ? 1 : alpha;
      g.textAlign = 'center';
      g.fillStyle = color;
      g.font = 'bold 34px "Consolas", monospace';
      g.fillText(title, W / 2, H * 0.42);
      if (sub) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.font = '14px "Consolas", monospace';
        g.fillText(sub, W / 2, H * 0.42 + 28);
      }
      g.restore();
    },

    /* 半透明遮罩 */
    dim: function (g, a) {
      g.fillStyle = 'rgba(2,5,14,' + a + ')';
      g.fillRect(0, 0, W, H);
    }
  };

  PW.HUD = HUD;
})(window);
