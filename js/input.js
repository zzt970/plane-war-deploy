/* 输入：键盘 / 鼠标 / 触摸 三套方案统一成一份状态 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});

  var keys = {};
  var firing = false;          // 键盘/鼠标按住射击
  var pointer = { x: 0, y: 0, active: false }; // 鼠标/触摸位置（画布逻辑坐标）
  var touchDrag = null;        // 触摸拖动状态
  var queue = { bomb: 0, skill: 0, pause: 0 }; // 按下事件队列（消费一次）
  var scheme = 'keyboard';
  var onAnyKey = null;

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'slow', ShiftRight: 'slow',
    Space: 'fire', KeyZ: 'fire', KeyJ: 'fire',
    KeyX: 'bomb', KeyK: 'bomb',
    KeyC: 'skill', KeyL: 'skill',
    Escape: 'pause', KeyP: 'pause'
  };

  function down(e) {
    var a = KEYMAP[e.code];
    if (!a) return;
    if (a === 'pause' || a === 'bomb' || a === 'skill') {
      // 屏蔽重复触发（长按不算连按）
      if (!e.repeat && !keys[a]) queue[a] = (queue[a] || 0) + 1;
      keys[a] = true;
    } else {
      keys[a] = true;
    }
    if (a === 'fire') firing = true;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (onAnyKey) onAnyKey(e.code);
  }
  function up(e) {
    var a = KEYMAP[e.code];
    if (!a) return;
    keys[a] = false;
    if (a === 'fire') firing = false;
  }

  function bind(canvas, toLogical) {
    global.addEventListener('keydown', down);
    global.addEventListener('keyup', up);
    global.addEventListener('blur', function () { keys = {}; firing = false; });

    canvas.addEventListener('mousemove', function (e) {
      var p = toLogical(e.clientX, e.clientY);
      pointer.x = p.x; pointer.y = p.y; pointer.active = true;
    });
    canvas.addEventListener('mouseleave', function () { pointer.active = false; firing = false; });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        firing = true;
        var p = toLogical(e.clientX, e.clientY);
        pointer.x = p.x; pointer.y = p.y; pointer.active = true;
      }
      if (onAnyKey) onAnyKey('mouse');
    });
    global.addEventListener('mouseup', function () { firing = false; });

    /* 触摸：拖动控制飞机（相对位移，手指不必遮住飞机） */
    canvas.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      var p = toLogical(t.clientX, t.clientY);
      touchDrag = { id: t.identifier, lx: p.x, ly: p.y, dx: 0, dy: 0 };
      pointer.x = p.x; pointer.y = p.y; pointer.active = true;
      firing = true;
      if (onAnyKey) onAnyKey('touch');
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (!touchDrag || t.identifier !== touchDrag.id) continue;
        var p = toLogical(t.clientX, t.clientY);
        touchDrag.dx += p.x - touchDrag.lx;
        touchDrag.dy += p.y - touchDrag.ly;
        touchDrag.lx = p.x; touchDrag.ly = p.y;
        pointer.x = p.x; pointer.y = p.y;
      }
      e.preventDefault();
    }, { passive: false });

    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (touchDrag && e.changedTouches[i].identifier === touchDrag.id) {
          touchDrag = null; pointer.active = false; firing = false;
        }
      }
    }
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  var Input = {
    bind: bind,
    setScheme: function (s) { scheme = s; },
    get scheme() { return scheme; },
    onAnyKey: function (fn) { onAnyKey = fn; },

    /* 键盘方向轴 */
    axis: function () {
      var x = 0, y = 0;
      if (keys.left) x -= 1;
      if (keys.right) x += 1;
      if (keys.up) y -= 1;
      if (keys.down) y += 1;
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x: x, y: y, slow: !!keys.slow };
    },

    /* 触摸拖动的位移增量（取走即清零） */
    takeDrag: function () {
      if (!touchDrag) return null;
      var d = { x: touchDrag.dx, y: touchDrag.dy };
      touchDrag.dx = 0; touchDrag.dy = 0;
      return d;
    },
    get firing() { return firing; },
    get pointer() { return pointer; },
    get slow() { return !!keys.slow; },

    /* 消费一次动作事件 */
    take: function (a) {
      if (queue[a] > 0) { queue[a]--; return true; }
      return false;
    },
    /* 触摸拖动清零（点了虚拟按钮时避免误移动） */
    clearDrag: function () { if (touchDrag) { touchDrag.dx = 0; touchDrag.dy = 0; } },
    /* 虚拟按钮触发 */
    press: function (a) { queue[a] = (queue[a] || 0) + 1; },
    clear: function () { queue.bomb = queue.skill = queue.pause = 0; firing = false; }
  };

  PW.Input = Input;
})(window);
