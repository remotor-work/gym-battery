/**
 * Скрипт для сбора GIF-анимаций с fitnessprogramer.com
 * Собирает URL по всем мышечным группам и матчит их с нашими упражнениями.
 * Запуск: node scrape_gifs.js
 */

const https = require('https');
const { URL } = require('url');

// Страницы мышечных групп для скрапинга
const MUSCLE_PAGES = [
  'https://fitnessprogramer.com/exercise-primary-muscle/chest/',
  'https://fitnessprogramer.com/exercise-primary-muscle/back/',
  'https://fitnessprogramer.com/exercise-primary-muscle/shoulders/',
  'https://fitnessprogramer.com/exercise-primary-muscle/biceps/',
  'https://fitnessprogramer.com/exercise-primary-muscle/triceps/',
  'https://fitnessprogramer.com/exercise-primary-muscle/leg/',
  'https://fitnessprogramer.com/exercise-primary-muscle/quadriceps/',
  'https://fitnessprogramer.com/exercise-primary-muscle/hamstrings/',
  'https://fitnessprogramer.com/exercise-primary-muscle/calves/',
  'https://fitnessprogramer.com/exercise-primary-muscle/glutes/',
  'https://fitnessprogramer.com/exercise-primary-muscle/traps/',
  'https://fitnessprogramer.com/exercise-primary-muscle/cardio/',
];

// Имена файлов упражнений в нашем приложении (из exerciseVariations)
const OUR_EXERCISES = {
  // Д1-1
  'chest-flat-barbell':    'Штанга горизонтальная / Flat Barbell Bench Press',
  'chest-flat-dumbbell':   'Гантели горизонтально / Dumbbell Bench Press',
  'chest-flat-smith':      'Смит горизонтально / Smith Machine Bench Press',
  'chest-flat-machine':    'Тренажёр грудь / Chest Press Machine',
  'chest-flat-cable':      'Кроссовер стоя / Cable Chest Press',
  'chest-flat-converge':   'Конвергент / Converging Chest Press',
  'chest-flat-neutral':    'Нейтральный хват / Neutral Grip Press',
  // Д1-2
  'back-pulldown-wide':    'Тяга верхнего блока / Lat Pulldown',
  'back-pullup-weighted':  'Подтягивания с весом / Weighted Pull-Up',
  'back-pulldown-machine': 'Тренажёр блочный / Lat Pulldown Machine',
  'back-pulldown-reverse': 'Обратный хват / Reverse Grip Lat Pulldown',
  'back-pulldown-close-neutral': 'Узкий нейтральный / Close Neutral Pulldown',
  'back-pullup-assisted':  'Assisted Pull-Up',
  'back-pulldown-single':  'Одна рука блок / Single-Arm Lat Pulldown',
  // Д1-3
  'chest-incline-barbell': 'Штанга наклон / Incline Barbell Bench Press',
  'chest-incline-dumbbell':'Гантели наклон / Incline Dumbbell Press',
  'chest-incline-smith':   'Смит наклон / Incline Smith Machine',
  'chest-incline-cable-low':'Кроссовер низ / Low Cable Fly',
  'chest-incline-machine': 'Тренажёр наклон / Incline Chest Machine',
  'chest-incline-cable-high':'Кроссовер снизу вверх / Low-to-High Cable Fly',
  'chest-incline-lever':   'Рычажный наклон / Hammer Strength Incline',
  // Д1-4
  'chest-fly-dumbbell-flat': 'Разводка лёжа / Dumbbell Fly',
  'chest-fly-cable-high':    'Кроссовер верх / High Cable Fly',
  'chest-fly-pecdeck':       'Бабочка / Pec Deck Fly',
  'chest-fly-dumbbell-incline': 'Разводка наклон / Incline Dumbbell Fly',
  'chest-fly-cable-mid':     'Кроссовер средний / Mid Cable Fly',
  'chest-fly-pecdeck-neutral': 'Бабочка нейтральная / Pec Deck Neutral',
  'chest-fly-lever':         'Рычажный разводка / Plate-Loaded Fly',
  // Д1-5
  'delt-lateral-dumbbell-standing': 'Подъём в стороны стоя / Lateral Raise',
  'delt-lateral-dumbbell-seated':   'Подъём в стороны сидя / Seated Lateral Raise',
  'delt-lateral-cable':     'Кабельные боковые / Cable Lateral Raise',
  'delt-lateral-machine':   'Тренажёр дельты / Lateral Raise Machine',
  'delt-lateral-forepad':   'Упоры предплечий / Forearm Pad Lateral Raise',
  'delt-lateral-cable-cross': 'Через тело кабель / Cross-Body Cable Raise',
  'delt-lateral-cable-behind': 'За спиной кабель / Behind-Back Cable Raise',
  // Д1-6
  'tri-pushdown-bar':       'Блок прямая рукоять / Tricep Bar Pushdown',
  'tri-pushdown-rope':      'Блок канат / Rope Tricep Pushdown',
  'tri-extension-barbell-lying': 'Французский жим / Lying Barbell Tricep Extension',
  'tri-extension-dumbbell-lying': 'Французский гантели / Lying DB Tricep Extension',
  'tri-extension-cable-overhead': 'Блок над головой / Overhead Cable Tricep Extension',
  'tri-extension-machine-overhead': 'Тренажёр над головой / Overhead Tricep Machine',
  'tri-extension-dumbbell-overhead': 'Гантель одна рука / Single-Arm DB Overhead Extension',
  // Д2-1
  'legs-squat-back':        'Приседание штанга / Back Squat',
  'legs-squat-front':       'Приседание фронтальное / Front Squat',
  'legs-squat-smith':       'Смит приседание / Smith Machine Squat',
  'legs-squat-goblet':      'Кубковое / Goblet Squat',
  'legs-squat-hack':        'Гакк-машина / Hack Squat',
  'legs-extension-machine': 'Разгибание ног / Leg Extension Machine',
  'legs-squat-smith-narrow': 'Смит узкий / Smith Machine Narrow Squat',
  // Д2-2
  'legs-rdl-barbell':       'РДТ штанга / Romanian Deadlift',
  'legs-rdl-dumbbell':      'РДТ гантели / Dumbbell RDL',
  'legs-rdl-smith':         'РДТ Смит / Smith Machine RDL',
  'legs-rdl-cable-pull':    'Тяга блок / Cable Pull-Through',
  'legs-back-extension':    'Гиперэкстензия / Back Extension',
  'legs-rdl-single':        'РДТ одна нога / Single-Leg RDL',
  'legs-rdl-stiff':         'Тяга прямые ноги / Stiff-Leg Deadlift',
  // Д2-3
  'legs-press-horizontal':  'Жим ног горизонт / Horizontal Leg Press',
  'legs-press-45deg':       'Жим ног 45° / 45 Degree Leg Press',
  'legs-press-narrow':      'Жим узкий / Narrow Leg Press',
  'legs-press-single':      'Жим одна нога / Single-Leg Press',
  'legs-press-sumo':        'Жим сумо / Sumo Leg Press',
  'legs-press-paused':      'Жим с паузой / Paused Leg Press',
  'legs-extension-single':  'Разгибание одна нога / Single-Leg Extension',
  // Д2-4
  'legs-curl-lying':        'Сгибание лёжа / Lying Leg Curl',
  'legs-curl-seated':       'Сгибание сидя / Seated Leg Curl',
  'legs-curl-standing':     'Сгибание стоя / Standing Leg Curl',
  'legs-curl-cable-lying':  'Кабель лёжа / Cable Lying Leg Curl',
  'legs-curl-nordic':       'Скандинавское / Nordic Hamstring Curl',
  'legs-curl-cable-standing': 'Кабель стоя / Standing Cable Leg Curl',
  'legs-curl-single':       'Одна нога / Single-Leg Curl',
  // Д2-5
  'delt-rear-fly-bent':     'Разводка наклон / Bent-Over Rear Delt Fly',
  'delt-rear-machine-reverse': 'Обратная бабочка / Reverse Pec Deck',
  'delt-rear-cable-cross':  'Кроссовер задние / Cable Rear Fly',
  'delt-rear-machine-dedicated': 'Тренажёр задние / Rear Delt Machine',
  'delt-rear-cable-low':    'Блок к уху / Low Cable Rear Fly',
  'delt-rear-machine-row':  'Face Pull тренажёр / Machine Face Pull',
  'delt-rear-cable-fly':    'Обратная кроссовер / Cable Reverse Fly',
  // Д2-6
  'legs-lunge-walking':     'Шагающие выпады / Walking Lunges',
  'legs-lunge-bulgarian':   'Болгарский сплит / Bulgarian Split Squat',
  'legs-lunge-barbell':     'Выпады штанга / Barbell Lunge',
  'legs-lunge-reverse':     'Обратный выпад / Reverse Lunge',
  'legs-stepup-dumbbell':   'Степ-ап / Dumbbell Step-Up',
  'legs-lunge-bulgarian-smith': 'Болгарский Смит / Smith Bulgarian Squat',
  'legs-lunge-reverse-smith': 'Обратный Смит / Smith Reverse Lunge',
  // Д3-1
  'back-row-cable-seated':  'Горизонтальная тяга / Seated Cable Row',
  'back-row-barbell-overhand': 'Тяга штанги наклон / Barbell Bent-Over Row',
  'back-row-dumbbell-both': 'Гантели наклон двумя / Bent-Over Dumbbell Row',
  'back-row-chest-support': 'Упор в грудь / Chest-Supported Row',
  'back-row-lever-hammer':  'Хаммер тяга / Hammer Strength Row',
  'back-row-machine-vertical': 'Тренажёр сидя / Selectorized Row',
  'back-row-cable-standing': 'Стоя кабель / Standing Cable Row',
  // Д3-2
  'shoulder-press-barbell': 'Жим штанга стоя / Standing Overhead Press',
  'shoulder-press-dumbbell': 'Жим гантели / Dumbbell Shoulder Press',
  'shoulder-press-machine': 'Тренажёр плечи / Shoulder Press Machine',
  'shoulder-press-smith':   'Смит жим вверх / Smith Machine Shoulder Press',
  'shoulder-press-arnold':  'Арнольд пресс / Arnold Press',
  'shoulder-press-lever':   'Рычажный плечи / Plate-Loaded Shoulder Press',
  'shoulder-press-alt':     'Поочерёдно гантели / Alternating DB Press',
  // Д3-3
  'back-row-barbell-underhand': 'Тяга обратный хват / Underhand Barbell Row',
  'back-row-tbar':          'Т-Бар тяга / T-Bar Row',
  'back-row-dumbbell-single': 'Гантель одна рука / One-Arm Dumbbell Row',
  'back-row-cable-bent':    'Кабель наклон / Cable Bent-Over Row',
  'back-row-tbar-machine':  'Т-Бар тренажёр / T-Bar Machine Row',
  'back-pullover-dumbbell': 'Пуловер гантель / Dumbbell Pullover',
  'back-row-cable-bilateral': 'Двойной кабель стоя / Bilateral Cable Row',
  // Д3-4
  'chest-decline-barbell':  'Штанга декляйн / Decline Barbell Press',
  'chest-decline-dumbbell': 'Гантели декляйн / Decline Dumbbell Press',
  'chest-decline-smith':    'Смит декляйн / Decline Smith Machine',
  'chest-decline-machine':  'Тренажёр декляйн / Decline Chest Machine',
  'chest-decline-pushup':   'Отжимания упор / Decline Push-Up',
  'chest-dips':             'Отжимания брусья / Chest Dips',
  'chest-decline-cable':    'Кроссовер декляйн / Decline Cable Fly',
  // Д3-5
  'bi-curl-barbell':        'Штанга бицепс / Barbell Curl',
  'bi-curl-dumbbell-alt':   'Гантели поочерёдно / Alternating Dumbbell Curl',
  'bi-curl-preacher':       'Скамья Скотта / Preacher Curl',
  'bi-curl-cable':          'Кабель бицепс / Cable Curl',
  'bi-curl-machine':        'Тренажёр бицепс / Bicep Curl Machine',
  'bi-curl-concentration':  'Концентрированный / Concentration Curl',
  'bi-curl-incline':        'Наклонная скамья / Incline Dumbbell Curl',
  // Д3-6
  'trap-face-pull-cable':   'Тяга к лицу канат / Face Pull',
  'trap-face-pull-band':    'Тяга к лицу лента / Band Face Pull',
  'trap-upright-row':       'Тяга к подбородку / Upright Row',
  'trap-face-pull-seated':  'Тяга к лицу сидя / Seated Face Pull',
  'back-pulldown-straight-arm': 'Тяга прямые руки / Straight-Arm Pulldown',
  'trap-upright-row-cable': 'Тяга подбородок кабель / Cable Upright Row',
  'trap-high-pull-rope':    'Канат к шее / Rope High Pull',
  // Д4-1
  'legs-press-45deg':       'Жим ног 45° / 45° Leg Press',
  // Д4-3
  'tri-dips-weighted':      'Брусья с весом / Weighted Dips',
  'tri-dips-assisted':      'Assisted Dips',
  'tri-press-close-grip':   'Жим узким хватом / Close-Grip Bench Press',
  'tri-dips-machine':       'Тренажёр дипс / Dip Machine',
  'tri-pushup-wide':        'Отжимания широкие / Wide Push-Up',
  'tri-pushdown-single':    'Одна рука кабель / Single-Arm Pushdown',
  'tri-kickback-cable':     'Кабель к бедру / Cable Kickback',
  // Д4-4
  'back-pulldown-behind-neck': 'Тяга за голову / Lat Pulldown Behind Neck',
  'back-pulldown-machine-behind': 'Тренажёр за голову / Machine Behind Neck',
  'back-pullover-machine':  'Тренажёр пуловер / Pullover Machine',
  'back-pulldown-neutral':  'Нейтральный блок / Neutral Grip Pulldown',
  'back-pullup-neutral':    'Подтягивания нейтр / Neutral Grip Pull-Up',
  // Д4-5
  'back-row-cable-single':  'Кабель одна рука / Single-Arm Cable Row',
  'back-row-machine-single': 'Тренажёр одна рука / Machine Single-Arm Row',
  'back-row-lever-single':  'Хаммер одна рука / Hammer Single-Arm Row',
  'back-row-cable-side':    'Кабель сбоку / Low Cable Row Standing',
  'back-row-trx-single':    'TRX одна рука / TRX Single-Arm Row',
  'back-row-kroc':          'Кроссовая тяга / Kroc Row',
  // Д4-6
  'bi-curl-reverse-barbell': 'Обратный хват штанга / Reverse Barbell Curl',
  'bi-curl-reverse-dumbbell': 'Обратный хват гантели / Reverse Dumbbell Curl',
  'bi-curl-reverse-cable':  'Обратный хват кабель / Reverse Cable Curl',
  'bi-curl-hammer':         'Молотковые / Hammer Curl',
  'bi-curl-zottman':        'Цоттман кёрл / Zottman Curl',
  'bi-curl-reverse-preacher': 'Обратный скамья Скотта / Reverse Preacher Curl',
  'bi-curl-hammer-cross':   'Крест-боди молоток / Cross-Body Hammer Curl',
  // Д2-5 already done above
  'legs-curl-nordic': 'Nordic Hamstring Curl',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractExercises(html) {
  const results = [];
  // Ищем блоки с упражнениями: <a href="..."> и img src="*.gif"
  const pattern = /href="(https:\/\/fitnessprogramer\.com\/exercise\/[^"]+)"[^>]*>[\s\S]*?src="([^"]*\.gif)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const exerciseUrl = match[1];
    const gifUrl = match[2];
    // Извлекаем имя из URL упражнения
    const name = exerciseUrl.replace('https://fitnessprogramer.com/exercise/', '').replace(/\/$/, '');
    results.push({ name, gifUrl, exerciseUrl });
  }
  return results;
}

// Расширенный поиск: img src рядом с тегами
function extractExercises2(html) {
  const results = [];
  const imgPattern = /src="(https:\/\/fitnessprogramer\.com\/wp-content\/uploads\/[^"]+\.gif)"/g;
  const titlePattern = /class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/[ha]/g;

  // Ищем все GIF URLs
  let m;
  while ((m = imgPattern.exec(html)) !== null) {
    results.push(m[1]);
  }
  return results;
}

// Нормализуем URL имя → короткое имя для матчинга
function normalize(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Функция совпадения наших имён с именами на сайте
function matchExercise(ourKey, gifUrl) {
  const gifFilename = gifUrl.split('/').pop().replace('.gif', '').toLowerCase();
  const ourNorm = normalize(ourKey);

  // Простое совпадение по части имени
  const parts = ourNorm.split('-').filter(p => p.length > 3);
  const matchCount = parts.filter(p => gifFilename.includes(p)).length;
  return matchCount;
}

async function scrapeAllPages() {
  console.log('Scraping fitnessprogramer.com...\n');

  const allGifs = []; // { gifUrl, pageName }

  for (const pageBase of MUSCLE_PAGES) {
    // Проверяем сколько страниц
    for (let page = 1; page <= 5; page++) {
      const url = page === 1 ? pageBase : `${pageBase}page/${page}/`;
      try {
        process.stdout.write(`  Fetching: ${url}... `);
        const html = await fetch(url);
        const gifs = extractExercises2(html);
        if (gifs.length === 0) {
          console.log('(empty)');
          break;
        }
        console.log(`${gifs.length} GIFs`);
        allGifs.push(...gifs.map(g => ({ gifUrl: g, page: url })));

        // Уважаем сервер: пауза 300мс
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.log(`error: ${e.message}`);
        break;
      }
    }
  }

  console.log(`\nTotal GIFs found: ${allGifs.length}`);

  // Деупликация
  const uniqueGifs = [...new Set(allGifs.map(g => g.gifUrl))];
  console.log(`Unique GIFs: ${uniqueGifs.length}`);

  // Матчим каждое упражнение к GIF URL
  console.log('\n=== MAPPING ОУР УПРАЖНЕНИЙ → GIF URLs ===\n');
  const mapping = {};
  const notFound = [];

  for (const ourKey of Object.keys(OUR_EXERCISES)) {
    const ourNorm = normalize(ourKey);

    // Ищем лучшее совпадение
    let bestScore = 0;
    let bestGif = null;

    for (const gifUrl of uniqueGifs) {
      const score = matchExercise(ourKey, gifUrl);
      if (score > bestScore) {
        bestScore = score;
        bestGif = gifUrl;
      }
    }

    if (bestScore >= 2) {
      mapping[ourKey] = bestGif;
      console.log(`✓ ${ourKey}`);
      console.log(`  → ${bestGif}\n`);
    } else {
      notFound.push(ourKey);
    }
  }

  console.log('\n=== НЕ НАЙДЕНО ===');
  for (const key of notFound) {
    console.log(`✗ ${key}: ${OUR_EXERCISES[key]}`);
  }

  // Генерируем JS код для вставки в приложение
  console.log('\n\n=== ГОТОВЫЙ КОД ДЛЯ fitnessUrlMap ===\n');
  console.log('const fitnessUrlMap = {');
  for (const [key, url] of Object.entries(mapping)) {
    console.log(`  '${key}': '${url}',`);
  }
  console.log('};');

  return mapping;
}

scrapeAllPages().catch(console.error);
