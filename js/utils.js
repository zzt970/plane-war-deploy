/* 通用工具：数学、随机、颜色、简单缓动 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});

  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.dist2 = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  U.dist = function (ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); };

  /* 圆形碰撞 */
  U.hit = function (ax, ay, ar, bx, by, br) {
    var r = ar + br;
    return U.dist2(ax, ay, bx, by) <= r * r;
  };

  /* 按权重随机挑选 */
  U.weighted = function (list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) return list[i].item;
    }
    return list[list.length - 1].item;
  };

  /* 每日种子：保证同一天同一关卡的随机序列一致 */
  U.daySeed = function () {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };
  U.dayKey = function () {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  };

  /* 可复现随机数（mulberry32） */
  U.seeded = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 数字千分位 */
  U.fmt = function (n) {
    n = Math.floor(n);
    var s = String(n), out = '', c = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      if (++c % 3 === 0 && i > 0) out = ',' + out;
    }
    return out;
  };

  /* 秒 -> mm:ss */
  U.time = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  };

  /* 十六进制颜色调亮/变暗，t>0 变亮 */
  U.shade = function (hex, t) {
    var c = U.hex2rgb(hex);
    var f = t > 0 ? 255 : 0, k = Math.abs(t);
    return 'rgb(' + Math.round(U.lerp(c[0], f, k)) + ',' +
      Math.round(U.lerp(c[1], f, k)) + ',' + Math.round(U.lerp(c[2], f, k)) + ')';
  };
  U.hex2rgb = function (hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  /* 带透明度的 rgba 字符串 */
  U.alpha = function (hex, a) {
    var c = U.hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  PW.U = U;
})(window);
