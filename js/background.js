/* 背景：6 套可切换主题，均为程序化绘制，无图片资源。
 * 统一接口 setTheme(id) / render(ctx, time, w, h, quality)
 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});
  var U = PW.U;

  var W = 0, H = 0;
  var theme = PW.THEMES[0];
  var starTile = null;   // 星空缓存 tile
  var cityTile = null;   // 城市剪影缓存 tile
  var clouds = [], nebulas = [], rains = [], auroras = [];
  var quality = 'high';

  function makeTile(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    draw(g, w, h);
    return c;
  }

  /* ---------------- 星空 tile ---------------- */
  function buildStars() {
    var h = H;
    starTile = makeTile(W, h, function (g, w) {
      var n = quality === 'high' ? 150 : 70;
      for (var i = 0; i < n; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        var r = Math.random() < 0.85 ? U.rand(0.5, 1.2) : U.rand(1.3, 2.2);
        var a = U.rand(0.25, 0.95);
        g.fillStyle = U.alpha(theme.star, a);
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        if (r > 1.3 && quality === 'high') {
          g.fillStyle = U.alpha(theme.star, a * 0.18);
          g.beginPath(); g.arc(x, y, r * 3.2, 0, 6.2832); g.fill();
        }
      }
    });
  }

  /* ---------------- 城市剪影 tile ---------------- */
  function buildCity() {
    cityTile = makeTile(W, H, function (g, w, h) {
      var base = h * 0.62;
      // 远景楼群
      drawSkyline(g, w, h, base, 0.55, U.alpha(theme.ui, 0.10), 26, 40, 90);
      // 近景楼群
      drawSkyline(g, w, h, h * 0.86, 0.9, U.alpha('#000000', 0.55), 18, 26, 120);
    });
  }
  function drawSkyline(g, w, h, base, alphaMul, color, minW, maxW, maxTall) {
    var x = -20;
    g.fillStyle = color;
    while (x < w + 20) {
      var bw = U.rand(minW, maxW);
      var bh = U.rand(maxTall * 0.35, maxTall);
      g.fillRect(x, base - bh, bw, bh + 10);
      // 楼顶霓虹点
      if (quality === 'high' && Math.random() < 0.5) {
        g.fillStyle = U.alpha(Math.random() < 0.5 ? theme.ui : theme.accent, 0.5);
        g.fillRect(x + bw * 0.3, base - bh - 3, bw * 0.4, 2);
        g.fillStyle = color;
      }
      // 窗户
      if (quality === 'high') {
        g.fillStyle = U.alpha(theme.ui, 0.16);
        for (var wy = base - bh + 6; wy < base - 4; wy += 9) {
          for (var wx = x + 4; wx < x + bw - 4; wx += 8) {
            if (Math.random() < 0.35) g.fillRect(wx, wy, 3, 4);
          }
        }
        g.fillStyle = color;
      }
      x += bw + U.rand(2, 8);
    }
  }

  function buildClouds() {
    clouds = [];
    var n = quality === 'high' ? 12 : 6;
    for (var i = 0; i < n; i++) {
      clouds.push({
        x: U.rand(-60, W + 60), y: U.rand(H * 0.15, H * 0.9),
        w: U.rand(90, 260), h: U.rand(14, 38),
        sp: U.rand(6, 22), a: U.rand(0.06, 0.20)
      });
    }
  }
  function buildNebula() {
    nebulas = [];
    var n = quality === 'high' ? 7 : 4;
    for (var i = 0; i < n; i++) {
      nebulas.push({
        x: U.rand(0, W), y: U.rand(0, H), r: U.rand(120, 300),
        c: [theme.ui, theme.accent, '#FFFFFF'][i % 3],
        a: U.rand(0.05, 0.13), sp: U.rand(0.02, 0.09), ph: U.rand(0, 6.28)
      });
    }
  }
  function buildRain() {
    rains = [];
    var cols = quality === 'high' ? 26 : 14;
    var chars = '01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ<>[]{}/\\|=+*#$%&';
    for (var i = 0; i < cols; i++) {
      var len = U.randInt(6, 18), arr = [];
      for (var j = 0; j < len; j++) arr.push(chars[Math.floor(Math.random() * chars.length)]);
      rains.push({ x: (i + 0.5) * (W / cols), y: U.rand(-H, 0), sp: U.rand(60, 190), arr: arr, a: U.rand(0.15, 0.5) });
    }
  }
  function buildAurora() {
    auroras = [];
    var n = quality === 'high' ? 4 : 2;
    for (var i = 0; i < n; i++) {
      auroras.push({
        y: U.rand(H * 0.12, H * 0.7), amp: U.rand(20, 60),
        len: U.rand(180, 420), sp: U.rand(0.12, 0.35), ph: U.rand(0, 6.28),
        c: [theme.ui, theme.accent, '#FFFFFF'][i % 3], a: U.rand(0.10, 0.22)
      });
    }
  }

  function build() {
    buildStars();
    if (theme.decor === 'city') buildCity();
    else cityTile = null;
    if (theme.decor === 'cloud') buildClouds();
    if (theme.decor === 'nebula') buildNebula();
    if (theme.decor === 'matrix') buildRain();
    if (theme.decor === 'aurora') buildAurora();
  }

  /* ---------------- 绘制 ---------------- */
  function drawBase(g) {
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, theme.bg[0]);
    grd.addColorStop(0.55, theme.bg[1]);
    grd.addColorStop(1, theme.bg[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }

  function drawStars(g, t) {
    if (!starTile) return;
    // 两层不同速度形成视差
    var s1 = (t * 26) % H, s2 = (t * 62) % H;
    g.globalAlpha = 0.85;
    g.drawImage(starTile, 0, s1); g.drawImage(starTile, 0, s1 - H);
    g.globalAlpha = 0.45;
    g.drawImage(starTile, 0, s2); g.drawImage(starTile, 0, s2 - H);
    g.globalAlpha = 1;
  }

  function drawGrid(g, t) {
    var step = 48;
    var off = (t * 34) % step;
    g.strokeStyle = theme.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (var y = -step + off; y < H + step; y += step) {
      g.moveTo(0, y); g.lineTo(W, y);
    }
    // 放射线（透视感）
    var cx = W / 2;
    for (var i = -3; i <= 3; i++) {
      g.moveTo(cx + i * 60, 0); g.lineTo(cx + i * 190, H);
    }
    g.stroke();
    // 地平线辉光
    if (quality === 'high') {
      var grd = g.createLinearGradient(0, H - 90, 0, H);
      grd.addColorStop(0, U.alpha(theme.ui, 0));
      grd.addColorStop(1, U.alpha(theme.ui, 0.13));
      g.fillStyle = grd; g.fillRect(0, H - 90, W, 90);
    }
  }

  function drawCity(g, t) {
    if (!cityTile) return;
    var s = (t * 20) % H;
    g.globalAlpha = 0.9;
    g.drawImage(cityTile, 0, s); g.drawImage(cityTile, 0, s - H);
    g.globalAlpha = 1;
    // 扫描线
    if (quality === 'high') {
      var sy = (t * 90) % (H + 120) - 60;
      var grd = g.createLinearGradient(0, sy - 30, 0, sy + 30);
      grd.addColorStop(0, U.alpha(theme.ui, 0));
      grd.addColorStop(0.5, U.alpha(theme.ui, 0.10));
      grd.addColorStop(1, U.alpha(theme.ui, 0));
      g.fillStyle = grd; g.fillRect(0, sy - 30, W, 60);
    }
  }

  function drawNebula(g, t) {
    for (var i = 0; i < nebulas.length; i++) {
      var n = nebulas[i];
      var x = n.x + Math.sin(t * n.sp + n.ph) * 60;
      var y = (n.y + t * n.sp * 8) % (H + 400) - 200;
      var r = n.r * (1 + 0.12 * Math.sin(t * 0.3 + n.ph));
      var grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, U.alpha(n.c, n.a));
      grd.addColorStop(1, U.alpha(n.c, 0));
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
  }

  function drawClouds(g, t, dt) {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += c.sp * dt;
      if (c.x - c.w > W) { c.x = -c.w - U.rand(0, 80); c.y = U.rand(H * 0.15, H * 0.9); }
      var grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w * 0.6);
      grd.addColorStop(0, U.alpha('#FFFFFF', c.a));
      grd.addColorStop(1, U.alpha('#FFFFFF', 0));
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(c.x, c.y, c.w * 0.6, c.h, 0, 0, 6.2832); g.fill();
    }
    // 太阳
    var grd2 = g.createRadialGradient(W * 0.5, H * 0.78, 0, W * 0.5, H * 0.78, 200);
    grd2.addColorStop(0, U.alpha('#FFE600', 0.35));
    grd2.addColorStop(1, U.alpha('#FF8A3D', 0));
    g.fillStyle = grd2;
    g.beginPath(); g.arc(W * 0.5, H * 0.78, 200, 0, 6.2832); g.fill();
  }

  function drawRain(g, t, dt) {
    g.font = '13px "Consolas", monospace';
    g.textAlign = 'center';
    for (var i = 0; i < rains.length; i++) {
      var r = rains[i];
      r.y += r.sp * dt;
      if (r.y - r.arr.length * 16 > H) { r.y = U.rand(-260, -40); r.sp = U.rand(60, 190); }
      for (var j = 0; j < r.arr.length; j++) {
        var y = r.y - j * 16;
        if (y < -16 || y > H + 16) continue;
        var a = r.a * (1 - j / r.arr.length);
        g.fillStyle = j === 0 ? U.alpha('#FFFFFF', Math.min(1, a * 2.2)) : U.alpha(theme.ui, a);
        g.fillText(r.arr[j], r.x, y);
      }
    }
  }

  function drawAurora(g, t) {
    for (var i = 0; i < auroras.length; i++) {
      var a = auroras[i];
      var y = a.y + Math.sin(t * a.sp + a.ph) * 26;
      g.save();
      g.globalCompositeOperation = 'lighter';
      var grd = g.createLinearGradient(0, y - 60, 0, y + 60);
      grd.addColorStop(0, U.alpha(a.c, 0));
      grd.addColorStop(0.5, U.alpha(a.c, a.a));
      grd.addColorStop(1, U.alpha(a.c, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-20, y);
      for (var x = -20; x <= W + 20; x += 20) {
        g.lineTo(x, y + Math.sin(x / 90 + t * a.sp * 3 + a.ph) * a.amp);
      }
      g.lineTo(W + 20, y + 120); g.lineTo(-20, y + 120);
      g.closePath(); g.fill();
      g.restore();
    }
  }

  var lastT = 0;
  var BG = {
    setTheme: function (id) {
      theme = PW.getTheme(id);
      if (W && H) build();
    },
    get theme() { return theme; },
    resize: function (w, h) { W = w; H = h; build(); },
    setQuality: function (q) { if (q !== quality) { quality = q; if (W && H) build(); } },

    /* dt 用于依赖帧间隔的动画（云/雨），t 为累计时间 */
    render: function (g, t, dt) {
      if (!W || !H) return;
      drawBase(g);
      switch (theme.decor) {
        case 'nebula': drawNebula(g, t); drawStars(g, t); break;
        case 'city': drawStars(g, t * 0.4); drawCity(g, t); break;
        case 'cloud': drawStars(g, t * 0.3); drawClouds(g, t, dt); break;
        case 'matrix': drawRain(g, t, dt); break;
        case 'aurora': drawStars(g, t); drawAurora(g, t); break;
        default: drawStars(g, t); drawGrid(g, t); break;
      }
      lastT = t;
    }
  };

  PW.BG = BG;
})(window);
