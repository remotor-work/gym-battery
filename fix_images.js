/**
 * fix_images.js — Скачивает правильные GIF для всех упражнений
 * Запуск: node fix_images.js
 *
 * v2 — обновлённые URL по результатам WebFetch-аудита
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, 'assets', 'img', 'exercises');

// ═══════════════════════════════════════════════════════════════════
//  ПРАВИЛЬНЫЕ URL — вручную проверены / скорректированы
//  Источник: fitnessprogramer.com
// ═══════════════════════════════════════════════════════════════════
const CORRECT_URLS = {

  // ── ГРУДЬ: горизонтальный жим ──
  'chest-flat-barbell':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bench-Press.gif',
  'chest-flat-dumbbell':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Bench-Press.gif',
  'chest-flat-smith':      'https://fitnessprogramer.com/wp-content/uploads/2021/06/Smith-Machine-Bench-Press.gif',
  'chest-flat-machine':    'https://fitnessprogramer.com/wp-content/uploads/2021/08/Lying-Chest-Press-Machine.gif',
  'chest-flat-cable':      'https://fitnessprogramer.com/wp-content/uploads/2021/09/Cable-Chest-Press.gif',
  'chest-flat-converge':   'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Incline-Chest-Press.gif',
  'chest-flat-neutral':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Bench-Press.gif',

  // ── СПИНА: тяга верхнего блока / подтягивания ──
  'back-pulldown-wide':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif',
  'back-pullup-weighted':        'https://fitnessprogramer.com/wp-content/uploads/2021/04/Weighted-Pull-up.gif',
  'back-pulldown-machine':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif',
  'back-pulldown-reverse':       'https://fitnessprogramer.com/wp-content/uploads/2021/04/Reverse-Lat-Pulldown.gif',
  'back-pulldown-close-neutral': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Close-Grip-Lat-Pulldown.gif',
  'back-pullup-assisted':        'https://fitnessprogramer.com/wp-content/uploads/2021/04/Assisted-Pull-up.gif',
  'back-pulldown-single':        'https://fitnessprogramer.com/wp-content/uploads/2021/07/Single-Arm-Lat-Pulldown.gif',
  'back-pulldown-behind-neck':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lat-Pulldown-Behind-Neck.gif',
  'back-pulldown-machine-behind':'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lat-Pulldown-Behind-Neck.gif',
  'back-pulldown-neutral':       'https://fitnessprogramer.com/wp-content/uploads/2021/06/V-bar-Lat-Pulldown.gif',
  'back-pullup-neutral':         'https://fitnessprogramer.com/wp-content/uploads/2022/08/neutral-grip-pull-up.gif',
  'back-pulldown-straight-arm':  'https://fitnessprogramer.com/wp-content/uploads/2021/05/Cable-Straight-Arm-Pulldown.gif',
  'back-pullover-machine':       'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lying-Extension-Pullover.gif',
  'back-pullover-dumbbell':      'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Pullover.gif',

  // ── ГРУДЬ: наклонный жим ──
  'chest-incline-barbell':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Barbell-Bench-Press.gif',
  'chest-incline-dumbbell':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Dumbbell-Press.gif',
  'chest-incline-smith':      'https://fitnessprogramer.com/wp-content/uploads/2021/06/Smith-Machine-Incline-Bench-Press.gif',
  'chest-incline-cable-low':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Low-Cable-Crossover.gif',
  'chest-incline-machine':    'https://fitnessprogramer.com/wp-content/uploads/2023/06/Incline-Chest-Fly-Machine.gif',
  'chest-incline-cable-high': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/High-Cable-Crossover.gif',
  'chest-incline-lever':      'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Incline-Chest-Press.gif',

  // ── ГРУДЬ: изоляция / разводка ──
  'chest-fly-dumbbell-flat':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Fly.gif',
  'chest-fly-cable-high':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/High-Cable-Crossover.gif',
  'chest-fly-pecdeck':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pec-Deck-Fly.gif',
  'chest-fly-dumbbell-incline': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-dumbbell-Fly.gif',
  'chest-fly-cable-mid':        'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Crossover.gif',
  'chest-fly-pecdeck-neutral':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pec-Deck-Fly.gif',
  'chest-fly-lever':            'https://fitnessprogramer.com/wp-content/uploads/2021/05/10301301-Lever-Pec-Deck-Fly_Chest_720.gif',

  // ── ГРУДЬ: декляйн ──
  'chest-decline-barbell':  'https://fitnessprogramer.com/wp-content/uploads/2021/03/Decline-Barbell-Bench-Press.gif',
  'chest-decline-dumbbell': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Decline-Dumbbell-Press.gif',
  'chest-decline-smith':    'https://fitnessprogramer.com/wp-content/uploads/2021/08/Decline-Chest-Press-Machine.gif',
  'chest-decline-machine':  'https://fitnessprogramer.com/wp-content/uploads/2021/08/Decline-Chest-Press-Machine.gif',
  'chest-decline-pushup':   'https://fitnessprogramer.com/wp-content/uploads/2015/07/Decline-Push-Up.gif',
  'chest-dips':             'https://fitnessprogramer.com/wp-content/uploads/2021/06/Chest-Dips.gif',
  'chest-decline-cable':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Crossover.gif',

  // ── ПЛЕЧИ: подъёмы в стороны ──
  'delt-lateral-dumbbell-standing': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Lateral-Raise.gif',
  'delt-lateral-dumbbell-seated':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Seated-Dumbbell-Lateral-Raise.gif',
  'delt-lateral-cable':             'https://fitnessprogramer.com/wp-content/uploads/2021/07/one-arm-Cable-Lateral-Raise.gif',
  'delt-lateral-machine':           'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lateral-Raise-Machine.gif',
  'delt-lateral-forepad':           'https://fitnessprogramer.com/wp-content/uploads/2022/01/Forearm-Pad-Lateral-Raise.gif',
  'delt-lateral-cable-cross':       'https://fitnessprogramer.com/wp-content/uploads/2021/07/one-arm-Cable-Lateral-Raise.gif',
  'delt-lateral-cable-behind':      'https://fitnessprogramer.com/wp-content/uploads/2021/07/one-arm-Cable-Lateral-Raise.gif',

  // ── ЗАДНИЕ ДЕЛЬТЫ ──
  'delt-rear-fly-bent':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Bent-Over-Lateral-Raise.gif',
  'delt-rear-machine-reverse':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Rear-Delt-Machine-Flys.gif',
  'delt-rear-cable-cross':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-rear-delt-fly.gif',
  'delt-rear-machine-dedicated': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Rear-Delt-Machine-Flys.gif',
  'delt-rear-cable-low':         'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-rear-delt-fly.gif',
  'delt-rear-machine-row':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'delt-rear-cable-fly':         'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-rear-delt-fly.gif',

  // ── ЖИМ ПЛЕЧАМИ ──
  'shoulder-press-barbell': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Shoulder-Press.gif',
  'shoulder-press-dumbbell':'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Shoulder-Press.gif',
  'shoulder-press-machine': 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Machine-Shoulder-Press.gif',
  'shoulder-press-smith':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Smith-Machine-Shoulder-Press.gif',
  'shoulder-press-arnold':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Arnold-Press.gif',
  'shoulder-press-lever':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lever-Shoulder-Press.gif',
  'shoulder-press-alt':     'https://fitnessprogramer.com/wp-content/uploads/2021/04/Alternating-Dumbbell-Shoulder-Press.gif',

  // ── ТРАПЕЦИИ / FACE PULL ──
  'trap-face-pull-cable':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'trap-face-pull-band':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'trap-upright-row':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Upright-Row.gif',
  'trap-face-pull-seated':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif',
  'trap-upright-row-cable': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Upright-Row.gif',
  'trap-high-pull-rope':    'https://fitnessprogramer.com/wp-content/uploads/2021/09/Kneeling-High-Pulley-Row.gif',

  // ── ТРИЦЕПС: жимы / отжимания ──
  'tri-press-close-grip':'https://fitnessprogramer.com/wp-content/uploads/2021/02/Close-Grip-Bench-Press.gif',
  'tri-pushup-wide':     'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif',
  'tri-kickback-cable':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Tricep-Kickback.gif',

  // ── ТРИЦЕПС: брусья ──
  'tri-dips-weighted': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Weighted-Dips.gif',
  'tri-dips-assisted': 'https://fitnessprogramer.com/wp-content/uploads/2022/11/Asisted-Triceps-Dips.gif',
  'tri-dips-machine':  'https://fitnessprogramer.com/wp-content/uploads/2021/09/Triceps-Dip-Machine.gif',

  // ── ТРИЦЕПС: блок / пушдаун ──
  'tri-pushdown-bar':    'https://fitnessprogramer.com/wp-content/uploads/2021/06/Reverse-Grip-Pushdown.gif',
  'tri-pushdown-rope':   'https://fitnessprogramer.com/wp-content/uploads/2021/06/Rope-Pushdown.gif',
  'tri-pushdown-single': 'https://fitnessprogramer.com/wp-content/uploads/2022/11/One-arm-triceps-pushdown.gif',

  // ── ТРИЦЕПС: разгибания ──
  'tri-extension-barbell-lying':    'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lying-Tricep-Extension.gif',
  'tri-extension-dumbbell-lying':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lying-Dumbbell-Tricep-Extension.gif',
  'tri-extension-cable-overhead':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Cable-Rope-Overhead-Triceps-Extension.gif',
  'tri-extension-machine-overhead': 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Cable-Rope-Overhead-Triceps-Extension.gif',
  'tri-extension-dumbbell-overhead':'https://fitnessprogramer.com/wp-content/uploads/2021/07/Dumbbell-Tricep-Overhead-Extension.gif',

  // ── БИЦЕПС: сгибания ──
  'bi-curl-barbell':        'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Curl.gif',
  'bi-curl-dumbbell-alt':   'https://fitnessprogramer.com/wp-content/uploads/2022/04/Double-Arm-Dumbbell-Curl.gif',
  'bi-curl-preacher':       'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Preacher-Curl.gif',
  'bi-curl-cable':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/cable-curl.gif',
  'bi-curl-machine':        'https://fitnessprogramer.com/wp-content/uploads/2021/09/Bicep-Curl-Machine.gif',
  'bi-curl-concentration':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Concentration-Curl.gif',
  'bi-curl-incline':        'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Incline-Dumbbell-Curl.gif',
  'bi-curl-hammer':         'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hammer-Curl.gif',
  'bi-curl-zottman':        'https://fitnessprogramer.com/wp-content/uploads/2023/10/Seated-Zottman-Curl.gif',

  // ── БИЦЕПС: обратные сгибания ──
  'bi-curl-reverse-barbell':  'https://fitnessprogramer.com/wp-content/uploads/2021/04/dumbbell-reverse-curl.gif',
  'bi-curl-reverse-dumbbell': 'https://fitnessprogramer.com/wp-content/uploads/2021/04/dumbbell-reverse-curl.gif',
  'bi-curl-reverse-cable':    'https://fitnessprogramer.com/wp-content/uploads/2022/02/Cable-Reverse-Grip-EZ-bar-Biceps-Curl.gif',
  'bi-curl-reverse-preacher': 'https://fitnessprogramer.com/wp-content/uploads/2021/07/Reverse-Preacher-Curl.gif',
  'bi-curl-hammer-cross':     'https://fitnessprogramer.com/wp-content/uploads/2021/07/Cross-Body-Hammer-Curl.gif',

  // ── ПРИСЕДАНИЯ ──
  'legs-squat-back':         'https://fitnessprogramer.com/wp-content/uploads/2021/02/BARBELL-SQUAT.gif',
  'legs-squat-front':        'https://fitnessprogramer.com/wp-content/uploads/2021/06/front-squat.gif',
  'legs-squat-smith':        'https://fitnessprogramer.com/wp-content/uploads/2024/10/smith-machine-squat.gif',
  'legs-squat-goblet':       'https://fitnessprogramer.com/wp-content/uploads/2025/07/Heel-Elevated-Goblet-Squat.gif',
  'legs-squat-hack':         'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Hack-Squat.gif',
  'legs-squat-smith-narrow': 'https://fitnessprogramer.com/wp-content/uploads/2024/10/smith-machine-squat.gif',

  // ── РАЗГИБАНИЯ НОГ ──
  'legs-extension-machine': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/LEG-EXTENSION.gif',
  'legs-extension-single':  'https://fitnessprogramer.com/wp-content/uploads/2022/07/Single-Leg-Extension.gif',

  // ── РДТ / СТАНОВАЯ ──
  'legs-rdl-barbell':    'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Romanian-Deadlift.gif',
  'legs-rdl-dumbbell':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Romanian-Deadlift.gif',
  'legs-rdl-smith':      'https://fitnessprogramer.com/wp-content/uploads/2021/07/Smith-Machine-Romanian-Deadlift.gif',
  'legs-rdl-cable-pull': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Cable-Pull-Through.gif',
  'legs-back-extension': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/hyperextension.gif',
  'legs-rdl-single':     'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Romanian-Deadlift.gif',
  'legs-rdl-stiff':      'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Romanian-Deadlift.gif',

  // ── ЖИМ НОГАМИ ──
  'legs-press-horizontal': 'https://fitnessprogramer.com/wp-content/uploads/2021/08/Lever-Horizontal-Leg-Press.gif',
  'legs-press-45deg':      'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif',
  'legs-press-narrow':     'https://fitnessprogramer.com/wp-content/uploads/2021/06/Close-Feet-Leg-Press.gif',
  'legs-press-single':     'https://fitnessprogramer.com/wp-content/uploads/2022/04/Single-Leg-Press.gif',
  'legs-press-sumo':       'https://fitnessprogramer.com/wp-content/uploads/2021/06/Sumo-Leg-Press.gif',
  'legs-press-paused':     'https://fitnessprogramer.com/wp-content/uploads/2015/11/Leg-Press.gif',

  // ── СГИБАНИЕ НОГ ──
  'legs-curl-lying':          'https://fitnessprogramer.com/wp-content/uploads/2021/02/Leg-Curl.gif',
  'legs-curl-seated':         'https://fitnessprogramer.com/wp-content/uploads/2021/08/Seated-Leg-Curl.gif',
  'legs-curl-standing':       'https://fitnessprogramer.com/wp-content/uploads/2022/05/Standing-leg-curl.gif',
  'legs-curl-cable-lying':    'https://fitnessprogramer.com/wp-content/uploads/2021/07/Cable-Lying-Leg-Curl.gif',
  'legs-curl-nordic':         'https://fitnessprogramer.com/wp-content/uploads/2021/06/Nordic-Hamstring-Curl.gif',
  'legs-curl-cable-standing': 'https://fitnessprogramer.com/wp-content/uploads/2021/09/Standing-Cable-Leg-Curl.gif',
  'legs-curl-single':         'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Curl.gif',

  // ── ВЫПАДЫ ──
  'legs-lunge-walking':        'https://fitnessprogramer.com/wp-content/uploads/2021/04/Walking-Lunges.gif',
  'legs-lunge-bulgarian':      'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dumbbell-Bulgarian-Split-Squat.gif',
  'legs-lunge-barbell':        'https://fitnessprogramer.com/wp-content/uploads/2021/05/Barbell-Lunge.gif',
  'legs-lunge-reverse':        'https://fitnessprogramer.com/wp-content/uploads/2022/08/bodyweight-reverse-lunge.gif',
  'legs-stepup-dumbbell':      'https://fitnessprogramer.com/wp-content/uploads/2021/12/Dumbeel-Step-Up.gif',
  'legs-lunge-bulgarian-smith':'https://fitnessprogramer.com/wp-content/uploads/2021/07/Smith-Machine-Bulgarian-Split-Squat.gif',
  'legs-lunge-reverse-smith':  'https://fitnessprogramer.com/wp-content/uploads/2021/07/Smith-Machine-Reverse-Lunge.gif',

  // ── ИКРЫ ──
  'legs-calf-standing':   'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Calf-Raise.gif',
  'legs-calf-seated':     'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Seated-Calf-Raise.gif',
  'legs-calf-legpress':   'https://fitnessprogramer.com/wp-content/uploads/2022/02/Single-Calf-Raise-on-Leg-Press-Machine.gif',
  'legs-calf-single':     'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Calf-Raises.gif',
  'legs-calf-smith':      'https://fitnessprogramer.com/wp-content/uploads/2021/06/Smith-Machine-Calf-Raise.gif',
  'legs-calf-donkey':     'https://fitnessprogramer.com/wp-content/uploads/2021/09/Lever-Donkey-Calf-Raise.gif',
  'legs-calf-bodyweight': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Calf-Raise.gif',

  // ── ГОРИЗОНТАЛЬНАЯ ТЯГА: штанга ──
  'back-row-cable-seated':      'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Cable-Row.gif',
  'back-row-barbell-overhand':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bent-Over-Row.gif',
  'back-row-barbell-underhand': 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Reverse-Grip-Barbell-Row.gif',
  'back-row-tbar':              'https://fitnessprogramer.com/wp-content/uploads/2021/04/t-bar-rows.gif',
  'back-row-tbar-machine':      'https://fitnessprogramer.com/wp-content/uploads/2021/04/t-bar-rows.gif',

  // ── ГОРИЗОНТАЛЬНАЯ ТЯГА: гантели ──
  'back-row-dumbbell-both':   'https://fitnessprogramer.com/wp-content/uploads/2021/02/Bent-Over-Dumbbell-Row.gif',
  'back-row-dumbbell-single': 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Row.gif',
  'back-row-chest-support':   'https://fitnessprogramer.com/wp-content/uploads/2021/06/Chest-Supported-Dumbbell-Row.gif',
  'back-row-kroc':            'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Row.gif',

  // ── ГОРИЗОНТАЛЬНАЯ ТЯГА: машина / блок ──
  'back-row-lever-hammer':     'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lever-Seated-Row.gif',
  'back-row-machine-vertical': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Machine-High-Row.gif',
  'back-row-cable-standing':   'https://fitnessprogramer.com/wp-content/uploads/2021/09/Cable-Bent-Over-Row.gif',
  'back-row-cable-bent':       'https://fitnessprogramer.com/wp-content/uploads/2021/09/Cable-Bent-Over-Row.gif',
  'back-row-cable-bilateral':  'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Cable-Row.gif',

  // ── ГОРИЗОНТАЛЬНАЯ ТЯГА: односторонняя ──
  'back-row-cable-single':   'https://fitnessprogramer.com/wp-content/uploads/2021/07/Single-Arm-Cable-Row.gif',
  'back-row-machine-single': 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Machine-High-Row.gif',
  'back-row-lever-single':   'https://fitnessprogramer.com/wp-content/uploads/2021/04/Lever-Seated-Row.gif',
  'back-row-cable-side':     'https://fitnessprogramer.com/wp-content/uploads/2021/07/Single-Arm-Cable-Row.gif',
  'back-row-trx-single':     'https://fitnessprogramer.com/wp-content/uploads/2021/06/Chest-Supported-Dumbbell-Row.gif',
};

// ═══════════════════════════════════════════════════════════════════
//  УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fitnessprogramer.com/',
      },
      timeout: 15000,
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadGif(key, url, attempt) {
  const outPath = path.join(OUT_DIR, key + '.gif');
  try {
    process.stdout.write(`  [${attempt}] ${key} ← ${url.split('/').slice(-1)[0]} ... `);
    const buf = await fetchUrl(url);

    // Проверяем что это GIF (magic bytes: 47 49 46)
    if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) {
      console.log(`✗ (not a GIF, got ${buf.slice(0,4).toString('hex')})`);
      return false;
    }

    fs.writeFileSync(outPath, buf);
    console.log(`✓ (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.log(`✗ (${e.message})`);
    return false;
  }
}

// Задержка между запросами
const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════
//  ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const keys = Object.keys(CORRECT_URLS);
  console.log(`\nDownloading ${keys.length} exercise GIFs...\n`);

  const results = { ok: [], fail: [] };

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = CORRECT_URLS[key];

    const ok = await downloadGif(key, url, `${i+1}/${keys.length}`);
    if (ok) {
      results.ok.push(key);
    } else {
      results.fail.push({ key, url });
    }

    await delay(200);
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✓ Success: ${results.ok.length}`);
  console.log(`✗ Failed:  ${results.fail.length}`);

  if (results.fail.length > 0) {
    console.log('\nFailed (check URLs):');
    results.fail.forEach(({ key, url }) => {
      console.log(`  ${key}: ${url}`);
    });
  }

  const report = {
    timestamp: new Date().toISOString(),
    downloaded: results.ok,
    failed: results.fail.map(f => f.key),
    failedDetails: results.fail,
  };
  fs.writeFileSync(
    path.join(__dirname, 'image_audit_report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('\nReport saved to image_audit_report.json');
}

main().catch(console.error);
