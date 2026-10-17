/* 全局配置：主题 / 战机 / 敌机 / 关卡 / BOSS / 道具 / 成就
 * 说明：所有数值集中在此，方便调平衡。缩写沿用射击游戏惯例。
 */
(function (global) {
  'use strict';
  var PW = global.PW || (global.PW = {});

  /* ============================ 画布 ============================ */
  PW.VIEW = { w: 480, h: 720 }; // 逻辑分辨率，实际按容器等比缩放

  /* ============================ 配色 ============================ */
  var C = {
    bg: '#05070F',
    primary: '#00F0FF',
    green: '#00FF88',
    yellow: '#FFE600',
    purple: '#B026FF',
    accent: '#FF2E88',
    danger: '#FF3030',
    orange: '#FF6600',
    white: '#FFFFFF'
  };
  PW.C = C;

  /* ==================== 背景主题（可切换，共 6 套） ====================
   * decor 决定装饰层画法：grid 网格 / city 城市剪影 / nebula 星云 /
   * cloud 云层 / matrix 代码雨 / aurora 极光
   */
  PW.THEMES = [
    {
      id: 'neon', name: '深空霓虹', desc: '经典黑蓝底 + 霓虹网格，视野最清晰',
      ui: '#00F0FF', accent: '#FF2E88',
      bg: ['#05070F', '#071026', '#0a1838'],
      star: '#BFEFFF', decor: 'grid', grid: 'rgba(0,240,255,0.10)', hue: 190
    },
    {
      id: 'cyber', name: '赛博都市', desc: '紫粉夜空 + 远景城市剪影与扫描线',
      ui: '#FF2E88', accent: '#00F0FF',
      bg: ['#0B0416', '#1C0733', '#3A0B4A'],
      star: '#FFC7EC', decor: 'city', grid: 'rgba(255,46,136,0.10)', hue: 310
    },
    {
      id: 'nebula', name: '星云漩涡', desc: '深紫星云缓慢翻涌，氛围感最强',
      ui: '#B026FF', accent: '#00FFC8',
      bg: ['#04010F', '#160A34', '#2A1155'],
      star: '#E6D0FF', decor: 'nebula', grid: 'rgba(176,38,255,0.10)', hue: 275
    },
    {
      id: 'sunset', name: '落日余晖', desc: '橙紫渐变天空与流云，暖色调',
      ui: '#FF9A3D', accent: '#FFE600',
      bg: ['#1A0B2E', '#6E2551', '#D9663A'],
      star: '#FFE0B8', decor: 'cloud', grid: 'rgba(255,154,61,0.10)', hue: 25
    },
    {
      id: 'matrix', name: '矩阵代码', desc: '黑绿终端风，数字雨下落',
      ui: '#39FF14', accent: '#00FFC8',
      bg: ['#000804', '#02160A', '#052A12'],
      star: '#9CFFB4', decor: 'matrix', grid: 'rgba(57,255,20,0.09)', hue: 120
    },
    {
      id: 'aurora', name: '极光冰原', desc: '冷青极光带流动，对比柔和护眼',
      ui: '#5FFBF1', accent: '#A6FFCB',
      bg: ['#010A12', '#052437', '#0A3C4E'],
      star: '#DFFFFA', decor: 'aurora', grid: 'rgba(95,251,241,0.10)', hue: 175
    }
  ];
  PW.getTheme = function (id) {
    for (var i = 0; i < PW.THEMES.length; i++) if (PW.THEMES[i].id === id) return PW.THEMES[i];
    return PW.THEMES[0];
  };

  /* ============================ 难度档 ============================ */
  PW.DIFFS = [
    { id: 'casual', name: '休闲', desc: '敌机更弱、弹速更慢，可续关 2 次', hp: 0.7, bullet: 0.75, spawn: 1.25, score: 0.8, revives: 2 },
    { id: 'normal', name: '标准', desc: '设计基准难度，可续关 1 次', hp: 1, bullet: 1, spawn: 1, score: 1, revives: 1 },
    { id: 'hard', name: '硬核', desc: '弹幕更凶、得分 ×1.5，不可续关', hp: 1.35, bullet: 1.3, spawn: 0.8, score: 1.5, revives: 0 }
  ];
  PW.getDiff = function (id) {
    for (var i = 0; i < PW.DIFFS.length; i++) if (PW.DIFFS[i].id === id) return PW.DIFFS[i];
    return PW.DIFFS[1];
  };

  /* ============================ 战机 ============================
   * speed 移动速度 px/s；fireRateMult 射速倍率；damageMult 伤害倍率
   * extraSpread 额外弹道数；homingBonus 额外追踪弹；wingmen 初始僚机数
   * grazeBonus 擦弹收益倍率
   */
  PW.PLANES = [
    {
      id: 'falcon', name: '猎鹰', desc: '均衡型战机，各项性能可靠，新手首选',
      color: '#00F0FF', speed: 360, maxHp: 3, fireRateMult: 1, damageMult: 1,
      extraSpread: 0, homingBonus: 0, wingmen: 0, grazeBonus: 1, unlock: 0,
      skill: { id: 'overdrive', name: '火力超载', desc: '4 秒内射速 ×2、伤害 ×1.5', cd: 24, dur: 4 }
    },
    {
      id: 'swift', name: '疾风', desc: '高机动 + 双僚机伴飞，弹幕如暴雨倾泻',
      color: '#00FF88', speed: 470, maxHp: 3, fireRateMult: 1.6, damageMult: 0.65,
      extraSpread: 0, homingBonus: 0, wingmen: 2, grazeBonus: 1.2, unlock: 6000,
      skill: { id: 'overdrive', name: '极限超载', desc: '4 秒内射速 ×2.2、移速 ×1.35', cd: 18, dur: 4 }
    },
    {
      id: 'fortress', name: '堡垒', desc: '重甲 + 散射弹幕覆盖全屏，容错最高',
      color: '#FFE600', speed: 260, maxHp: 6, fireRateMult: 0.8, damageMult: 1.3,
      extraSpread: 3, homingBonus: 0, wingmen: 0, grazeBonus: 1, unlock: 16000,
      skill: { id: 'fortress', name: '要塞模式', desc: '4 秒无敌且伤害 ×1.5', cd: 22, dur: 4 }
    },
    {
      id: 'phantom', name: '幻影', desc: '追踪弹特化，相位闪避可瞬间摆脱死局',
      color: '#FF2E88', speed: 380, maxHp: 2, fireRateMult: 1, damageMult: 0.8,
      extraSpread: 0, homingBonus: 3, wingmen: 0, grazeBonus: 1.5, unlock: 36000,
      skill: { id: 'phase', name: '相位闪避', desc: '清空全屏敌弹并获 1.5 秒无敌', cd: 16, dur: 1.5 }
    },
    {
      id: 'thunder', name: '雷霆', desc: '链式闪电武器，可同时打击多架敌机',
      color: '#B026FF', speed: 340, maxHp: 4, fireRateMult: 0.95, damageMult: 0.9,
      extraSpread: 0, homingBonus: 0, wingmen: 0, grazeBonus: 1, unlock: 70000,
      chain: 3, // 链式弹：命中后跳跃到附近敌人
      skill: { id: 'thunder', name: '雷霆链狱', desc: '5 秒内子弹必定连锁 4 次', cd: 26, dur: 5 }
    },
    {
      id: 'peregrine', name: '游隼', desc: '擦弹流专精：贴弹飞行收益 ×3，可凝滞时间',
      color: '#FF6600', speed: 420, maxHp: 2, fireRateMult: 1.15, damageMult: 0.85,
      extraSpread: 0, homingBonus: 1, wingmen: 0, grazeBonus: 3, unlock: 120000,
      skill: { id: 'freeze', name: '时间凝滞', desc: '3 秒内敌机与敌弹减速至 35%', cd: 20, dur: 3 }
    }
  ];
  PW.getPlane = function (id) {
    for (var i = 0; i < PW.PLANES.length; i++) if (PW.PLANES[i].id === id) return PW.PLANES[i];
    return PW.PLANES[0];
  };

  /* ============================ 敌机 ============================
   * pattern: line 直飞 / sine 正弦 / side 横移 / track 追踪 / drift 漂移
   * elite 为精英（掉落道具概率更高）；shielded 需先破盾；cloaked 会隐形
   * carrier 会周期性放出小型僚机；laser 会蓄力发射贯穿激光
   */
  PW.ENEMIES = {
    E1: { id: 'E1', name: '侦察机', hp: 1, speed: 165, score: 100, r: 15, color: '#00F0FF', fire: 0, bspeed: 0, minLv: 1, pattern: 'line', tip: '只会直飞，用来热身与攒连击' },
    E2: { id: 'E2', name: '截击机', hp: 3, speed: 135, score: 200, r: 17, color: '#00FF88', fire: 0.65, bspeed: 265, minLv: 1, pattern: 'sine', tip: '正弦摆动并点射，预瞄它的落点' },
    E3: { id: 'E3', name: '重装机', hp: 9, speed: 90, score: 500, r: 24, color: '#FFE600', fire: 0.85, bspeed: 240, minLv: 2, pattern: 'side', elite: true, tip: '横向巡航的高血量目标，散射火力好用' },
    E4: { id: 'E4', name: '自爆机', hp: 2, speed: 215, score: 300, r: 15, color: '#FF3030', fire: 0, bspeed: 0, minLv: 3, pattern: 'track', suicide: true, tip: '死亡时炸出一圈弹，保持距离再击杀' },
    E5: { id: 'E5', name: '护盾机', hp: 6, shield: 4, speed: 100, score: 600, r: 22, color: '#B026FF', fire: 0.5, bspeed: 220, minLv: 4, pattern: 'line', elite: true, shielded: true, tip: '护盾先破才能伤血，高射速比高伤害有效' },
    E6: { id: 'E6', name: '隐形机', hp: 4, speed: 155, score: 800, r: 17, color: '#FF2E88', fire: 0.7, bspeed: 300, minLv: 5, pattern: 'sine', cloaked: true, tip: '会周期性隐形，靠记忆弹道或追踪弹应对' },
    E7: { id: 'E7', name: '蜂群母舰', hp: 14, speed: 70, score: 900, r: 28, color: '#7A00B8', fire: 0.4, bspeed: 200, minLv: 6, pattern: 'drift', elite: true, carrier: true, tip: '会不断放出小蜂，优先击沉可断绝后续压力' },
    E8: { id: 'E8', name: '激光炮艇', hp: 10, speed: 110, score: 1000, r: 22, color: '#FF6600', fire: 0.35, bspeed: 0, minLv: 7, pattern: 'side', elite: true, laser: true, tip: '开火前会有红色预警线，看到就横向躲开' }
  };
  PW.ENEMY_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'];

  /* 小蜂（母舰放出），不进图鉴 */
  PW.MINION = { id: 'M0', name: '小蜂', hp: 1, speed: 190, score: 50, r: 10, color: '#C77DFF', fire: 0, bspeed: 0, minLv: 99, pattern: 'track' };

  /* ====================== 玩家武器等级（1~5） ====================== */
  PW.WEAPONS = [
    { bullets: 1, spread: 0, damage: 1, rate: 6.0, homing: 0 },
    { bullets: 2, spread: 6, damage: 1, rate: 6.0, homing: 0 },
    { bullets: 3, spread: 18, damage: 1, rate: 7.0, homing: 0 },
    { bullets: 3, spread: 18, damage: 1, rate: 7.0, homing: 2 },
    { bullets: 5, spread: 28, damage: 1, rate: 8.0, homing: 2 }
  ];

  /* ============================ 道具 ============================ */
  PW.POWERUPS = {
    weapon: { color: '#FF2E88', letter: 'P', name: '武器升级', desc: '火力等级 +1（最高 5 级）' },
    shield: { color: '#00F0FF', letter: 'S', name: '护盾', desc: '获得 1 层可抵挡伤害的护盾' },
    score: { color: '#FFE600', letter: 'M', name: '得分加倍', desc: '10 秒内所有得分 ×2' },
    bomb: { color: '#B026FF', letter: 'B', name: '炸弹', desc: '炸弹库存 +1（最多 5 个）' },
    heal: { color: '#00FF88', letter: 'H', name: '修复', desc: '恢复 1 点装甲' },
    wipe: { color: '#FFFFFF', letter: 'W', name: '清屏', desc: '立即清空全屏敌机与敌弹' },
    wing: { color: '#FF6600', letter: 'F', name: '僚机', desc: '召唤 1 架僚机助战（最多 2 架）' }
  };
  PW.PU_DROP = [
    { item: 'weapon', weight: 28 },
    { item: 'shield', weight: 14 },
    { item: 'score', weight: 18 },
    { item: 'bomb', weight: 10 },
    { item: 'heal', weight: 14 },
    { item: 'wipe', weight: 8 },
    { item: 'wing', weight: 8 }
  ];

  /* ============================ 关卡 ============================ */
  /* total：本关敌机总配额（全部击落后方才召唤 BOSS，保证一架不漏）
   * cap  ：同屏敌机上限，防止一次性堆屏
   * spawn：补位间隔（同屏不满时才投放新编队）
   */
  PW.LEVELS = [
    { id: 1, name: '第一关 · 突袭前哨', dur: 45, diff: 1.0, pool: ['E1', 'E2'], spawn: 1.40, total: 20, cap: 5, boss: 1 },
    { id: 2, name: '第二关 · 弹幕初体验', dur: 55, diff: 1.3, pool: ['E1', 'E2', 'E3'], spawn: 1.20, total: 26, cap: 6, boss: 2 },
    { id: 3, name: '第三关 · 追踪锁定', dur: 60, diff: 1.6, pool: ['E2', 'E3', 'E4'], spawn: 1.10, total: 28, cap: 6, boss: 3 },
    { id: 4, name: '第四关 · 编队压制', dur: 65, diff: 2.0, pool: ['E2', 'E3', 'E4', 'E5'], spawn: 1.00, total: 32, cap: 7, boss: 4 },
    { id: 5, name: '第五关 · 幻影突袭', dur: 70, diff: 2.5, pool: ['E3', 'E4', 'E5', 'E6'], spawn: 0.90, total: 36, cap: 7, boss: 5 },
    { id: 6, name: '第六关 · 蜂群回廊', dur: 80, diff: 3.0, pool: ['E2', 'E3', 'E5', 'E7'], spawn: 0.80, total: 40, cap: 8, boss: 6 },
    { id: 7, name: '第七关 · 深空堡垒', dur: 85, diff: 3.5, pool: ['E3', 'E4', 'E6', 'E8'], spawn: 0.75, total: 44, cap: 8, boss: 7 },
    { id: 8, name: '第八关 · 终焉降临', dur: 90, diff: 4.0, pool: ['E4', 'E5', 'E6', 'E7', 'E8'], spawn: 0.70, total: 50, cap: 9, boss: 8 }
  ];
  PW.MAX_LEVEL = PW.LEVELS.length;
  PW.getLevel = function (id) {
    var i = Math.max(0, Math.min(PW.LEVELS.length - 1, (id | 0) - 1));
    return PW.LEVELS[i];
  };

  /* ============================ BOSS ============================
   * patterns 为该 Boss 循环使用的弹幕套路
   */
  PW.BOSSES = [
    { id: 1, name: '「铁壁」要塞', color: '#00F0FF', hp: 120, patterns: ['spread', 'ring'] },
    { id: 2, name: '「散射」蜂巢', color: '#FFE600', hp: 165, patterns: ['spread', 'spiral'] },
    { id: 3, name: '「追踪」猎手', color: '#00FF88', hp: 210, patterns: ['tracking', 'spread'] },
    { id: 4, name: '「编队」指挥', color: '#B026FF', hp: 250, patterns: ['summon', 'sweep'] },
    { id: 5, name: '「幻影」幽灵', color: '#FF2E88', hp: 290, patterns: ['spiral', 'tracking', 'sweep'] },
    { id: 6, name: '「终焉」核心', color: '#FF3030', hp: 400, patterns: ['ring', 'laser', 'spread'] },
    { id: 7, name: '「深渊」巨兽', color: '#7A00B8', hp: 480, patterns: ['sweep', 'summon', 'spiral'] },
    { id: 8, name: '「虚空」主宰', color: '#FF6600', hp: 640, patterns: ['spiral', 'laser', 'ring', 'tracking', 'summon'] }
  ];
  PW.getBoss = function (id) {
    var i = Math.max(0, Math.min(PW.BOSSES.length - 1, (id | 0) - 1));
    return PW.BOSSES[i];
  };

  /* ================== 每日挑战词条（随机抽取组合） ================== */
  PW.MODIFIERS = [
    { id: 'swift_foe', name: '敌速 +35%', desc: '所有敌机移动速度提升 35%', enemySpeed: 1.35 },
    { id: 'iron_hide', name: '装甲强化', desc: '敌机生命值提升 40%', enemyHp: 1.4 },
    { id: 'dense', name: '敌潮密集', desc: '敌机生成间隔缩短 30%', spawn: 0.7 },
    { id: 'rich', name: '补给充沛', desc: '道具掉落率翻倍', drop: 2 },
    { id: 'fragile', name: '薄皮', desc: '敌机生命值降低 30%', enemyHp: 0.7 },
    { id: 'graze_fever', name: '擦弹狂热', desc: '擦弹收益 ×3', graze: 3 },
    { id: 'no_heal', name: '禁疗', desc: '不会出现修复道具', banHeal: true },
    { id: 'one_hit', name: '一击必杀', desc: '你的子弹伤害 ×2，但你只有 1 点装甲', dmg: 2, hp: 1 }
  ];

  /* ============================ 成就 ============================ */
  /* reward：解锁成就时一次性奖励的积分，直接计入累计总分（参与战机解锁）
   * 总量控制在 3 万左右，约为「全程通关」得分的 1/10，属锦上添花而非主要来源
   */
  PW.ACHIEVEMENTS = [
    { id: 'ACH_FIRST_BLOOD', name: '初战告捷', desc: '击落第 1 架敌机', cond: 'kill>=1', reward: 500 },
    { id: 'ACH_COMBO_100', name: '连击大师', desc: '单局连击达到 100', cond: 'combo>=100', reward: 2000 },
    { id: 'ACH_NO_DAMAGE', name: '完美主义', desc: '无伤通关任意关卡', cond: 'noDamageClear', reward: 3000 },
    { id: 'ACH_BOSS_SLAYER', name: '屠龙者', desc: '击败任意 BOSS', cond: 'bossKill>=1', reward: 1000 },
    { id: 'ACH_ALL_LEVELS', name: '通关大师', desc: '通关全部 8 关', cond: 'clearAll', reward: 5000 },
    { id: 'ACH_SCORE_100K', name: '十万王牌', desc: '单局得分达到 100000', cond: 'score>=100000', reward: 4000 },
    { id: 'ACH_BOMB_SAVE', name: '绝地反击', desc: '残血时用炸弹后仍通关该关', cond: 'bombSaveClear', reward: 2500 },
    { id: 'ACH_ENDLESS_5M', name: '无尽漫游', desc: '无尽模式生存满 5 分钟', cond: 'endless5min', reward: 3500 },
    { id: 'ACH_GRAZE_500', name: '擦弹大师', desc: '单局擦弹次数达到 500', cond: 'graze>=500', reward: 2500 },
    { id: 'ACH_DEX_ALL', name: '图鉴收藏家', desc: '解锁全部 8 种敌机图鉴', cond: 'dexAll', reward: 2000 },
    { id: 'ACH_HARD_CLEAR', name: '硬核勋章', desc: '在硬核难度通关任意关卡', cond: 'hardClear', reward: 4000 },
    { id: 'ACH_DAILY', name: '每日例行', desc: '完成一次每日挑战', cond: 'daily', reward: 1000 }
  ];

  /* ============================ 默认设置 ============================ */
  PW.DEFAULT_SETTINGS = {
    theme: 'neon',          // 背景主题
    diff: 'normal',         // 难度档
    sfx: 0.7,               // 音效音量
    bgm: 0.45,              // 音乐音量
    bgmOn: true,
    quality: 'high',        // high / low（低画质关闭辉光与大量粒子）
    control: 'auto',        // auto（按设备自动选）/ keyboard / mouse / touch
    autoFire: true,         // 自动开火
    shake: true,            // 屏幕震动
    autoTheme: false        // 每关随机背景
  };

})(window);
