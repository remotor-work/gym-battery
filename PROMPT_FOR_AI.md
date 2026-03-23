# GYM BATTERY — AI Agent Codebase Guide

> Этот файл — главная точка входа для AI-агента. Описывает как навигировать,
> модифицировать и расширять кодовую базу. Актуальная версия: 3.3, Март 2026.

---

## 1. ФАЙЛОВАЯ СТРУКТУРА

```
index.html          — Монолит: HTML + CSS + JS (~4800 строк)
sw.js               — Service Worker (Cache First, bump CACHE version on every deploy!)
manifest.json       — PWA-манифест
PROMPT_FOR_AI.md    — Этот файл
assets/
  img/
    exercises/      — GIF/PNG иллюстрации упражнений ({img-slug}.gif)
    muscles/        — PNG иллюстрации мышечных групп ({muscle}.png)
    icons/          — PWA-иконки
```

## 2. НАВИГАЦИЯ ПО КОДУ

### Быстрый поиск секций
```bash
grep -n "SECTION:" index.html
```

| Секция ID         | Что содержит                                      |
|-------------------|---------------------------------------------------|
| `SECTION:IMGLOADER`  | ImgLoader — загрузка картинок + SVG-fallback    |
| `SECTION:EXERCISES`  | exerciseVariations — 168 вариантов (24×7)       |
| `SECTION:SCHEDULE`   | workoutSchedule + dayFullNames + dayDescriptions |
| `SECTION:CONFIG`     | CONFIG, DAYS_ORDER, COMPOUND_TYPES, STORAGE_KEY  |
| `SECTION:APP`        | App — состояние, localStorage, неделя, heat, log |
| `SECTION:UI`         | UI — экраны, рендер, тосты, haptic, диалоги      |
| `SECTION:WORKOUT`    | Workout — слоты, зоны, подходы, таймер, каталог  |
| `SECTION:EVENTS`     | Делегирование событий (data-action + byId)       |
| `SECTION:INIT`       | Миграция + Bootstrap (load, render, SW)          |

### Архитектура JS
Три синглтона + утилита:

| Объект   | Ответственность |
|----------|----------------|
| `App`    | Состояние (`App.state`), персистентность (`App.persist`), localStorage, управление неделей, heat, workout log |
| `UI`     | Навигация экранов (`showScreen`), рендер Home/Stats/Settings/Log/Catalog, toast, haptic, confirm-диалог |
| `Workout`| Логика тренировки: buildSlots, render (3 зоны), openExercise, openVariation, tapSet, таймер, completeExercise, finish |
| `ImgLoader` | GIF→PNG→SVG fallback для `<img>` элементов |

### Экраны (9 штук)
```
screen-home → screen-muscles → screen-workout → screen-exercise → screen-variation
screen-home → screen-stats
screen-home → screen-log
screen-home → screen-settings
screen-home → screen-catalog → screen-catalog-detail
```
Навигация: `UI.showScreen('screen-id')`. Один `.screen.active` в любой момент.

---

## 3. CONFIG — ВСЕ КОНСТАНТЫ

Объект `CONFIG` содержит ВСЕ magic numbers приложения. Категории:

- **Данные**: MAX_HEAT, HEAT_DECAY, SLOTS_PER_DAY, VARIANTS_PER_SLOT, MAX_HISTORY, MAX_LOG_DAYS, HISTORY_SHOWN, HEAT_SEGMENTS
- **Настройки пользователя (границы)**: SETS_DEFAULT/MIN/MAX, REST_COMPOUND_DEFAULT, REST_ISOLATION_DEFAULT, REST_MIN/MAX/STEP
- **Тайминги UI (мс)**: SCREEN_EXIT_MS, TOAST_MS, AUTO_COMPLETE_MS, CACHE_RELOAD_MS, BUSY_HIGHLIGHT_MS
- **Haptic (мс)**: HAPTIC_DEFAULT, HAPTIC_SHORT, HAPTIC_MEDIUM, HAPTIC_LONG
- **Score-формула**: SCORE_PRIORITY_W, SCORE_LIKED_BONUS, SCORE_JITTER_MAX
- **SVG таймер**: TIMER_RADIUS

---

## 4. DATA-ACTION REGISTRY

Все кнопки внутри `#app` используют `data-action` атрибуты. Единый обработчик на `#app`.

| action              | handler                           | screen           |
|---------------------|-----------------------------------|------------------|
| open-muscle         | Workout.openMuscle(slot)          | screen-muscles   |
| open-exercise       | Workout.openExercise(index)       | screen-workout   |
| slot-start          | Workout.openVariation(key, idx)   | screen-workout   |
| slot-busy           | Workout.markSlotBusy(slot)        | screen-workout   |
| check-start         | Workout.reclaimBusyVariant(s, v)  | screen-workout   |
| check-dismiss       | Workout.dismissBusyVariant(s, v)  | screen-workout   |
| open-variation      | Workout.openVariation(key, idx)   | screen-exercise  |
| like-variant        | App.toggleLike(key, idx)          | screen-exercise  |
| ban-variant         | App.toggleBan(key, idx)           | screen-exercise  |
| vd-like             | App.toggleLike (in-place)         | screen-variation |
| vd-ban              | App.toggleBan (in-place)          | screen-variation |
| unban-variant       | delete bannedVariants[key]        | screen-settings  |
| open-catalog-detail | UI.openCatalogDetail(img)         | screen-catalog   |
| tap-set             | Workout.tapSet(set)               | screen-variation |
| force-complete      | Workout.forceComplete()           | screen-variation |
| sets-minus/plus     | settings.setsCount ±1             | screen-settings  |
| rest-compound-/+    | settings.restCompound ±STEP       | screen-settings  |
| rest-iso-/+         | settings.restIsolation ±STEP      | screen-settings  |

---

## 5. ДАННЫЕ И ПЕРСИСТЕНТНОСТЬ

### localStorage key: `gb_v3`

```
App.persist = {
  doneDays:        {},      // {"Д1": true, ...}
  progress:        {},      // {"Д1": {slots: [...], completedExercises: [...]}}
  history:         [],      // [{date, day, exercises, totalSets, totalVolume}] max 100
  weekStart:       null,    // ISO-дата понедельника
  settings: {
    setsCount:     3,       // 2–6
    restCompound:  90,      // сек, для базовых (Жим, Тяга, Присед, Выпад)
    restIsolation: 45,      // сек, для изоляции
  },
  workoutLog:      [],      // [{date, day, exercises}] последние 30 дней
  bannedVariants:  {},      // {"Д1-1:2": true}
  likedVariants:   {},      // {"Д1-1:0": true}
  exerciseHeat:    {},      // {"chest-flat-barbell": 7} 0–10
  lastDecayMonth:  null,    // "2026-03"
}
```

### exerciseVariations (static data)
Ключи: `"{ДЕНЬ}-{НОМЕР}"` → массив из 7 объектов:
```js
{ img: "chest-flat-barbell", name: "Штанга на горизонтальной скамье (Flat Bench Press)",
  tags: ["Гриф + блины", "Горизонтальная скамья"], muscles: "Грудь, передние дельты, трицепс",
  desc: "2–4 предложения о технике" }
```

### workoutSchedule (static data)
Ключи: `"Д1"–"Д4"` → `{ name, full, exercises: [{id, type, muscle, movement}] }`

---

## 6. КЛЮЧЕВЫЕ МЕХАНИКИ

### Score-формула ранжирования вариантов
При генерации (`buildSlots`) варианты ранжируются по score:
```
score = priority × 8 + liked × 4 − heat × (1.5 − priority × 0.2) + random(0…6)
```
- `varPriority(idx)`: 0-1→5★, 2-3→4★, 4-5→3★, 6→2★
- Heat penalty уменьшен для высокоприоритетных (5★: коэфф 0.5, 3★: коэфф 0.9)
- Random jitter создаёт ротацию между соседними тирами

### Heat (горячесть)
- `App.addHeat(imgSlug)` → +1 при завершении упражнения (max 10)
- Ежемесячный decay: `checkHeatDecay()` — все ненулевые −1
- Отображение: `App.heatImgBarHTML(imgSlug)` — 8 сегментов, HSL-градиент 240→0

### Workout Log
- Логируется при каждом `completeExercise()`, НЕ только при `finish()`
- `App.logExercise(day, exerciseData)` — find-or-create запись за сегодня+день
- Хранит последние 30 дней

### Три зоны рендера (Workout.render)
- **ДЕЛАЙ СЕЙЧАС** — `_renderZoneCard({zone:'now', ...})` + альтернативы
- **ПРОВЕРЬ** — `_renderZoneCard({zone:'check', ...})` для busy-вариантов
- **ВЫПОЛНЕНО** — done-row (минималистичная строка)

---

## 7. ТИПОВЫЕ СЦЕНАРИИ МОДИФИКАЦИИ

### Добавить новую настройку
1. Добавить в `CONFIG` границы/defaults
2. Добавить в `App.persist.settings` (+ дефолт)
3. Добавить в `UI.renderSettings()` — HTML + data-action кнопки ±
4. Добавить case в switch (SECTION:EVENTS)
5. Использовать значение где нужно

### Добавить новый экран
1. HTML: `<div class="screen" id="screen-xxx">` внутри `#app`
2. CSS: стили если нужны
3. JS: метод рендера в UI (например `UI.renderXxx()`)
4. Навигация: `UI.showScreen('screen-xxx')` из кнопки
5. Кнопка «Назад»: addEventListener по id

### Изменить рендер карточек тренировки
Единая точка: `Workout._renderZoneCard({zone, slot, slotIdx, varIdx, variant, ...})`
Зоны: 'now' (с кнопкой «Занято»), 'check' (с «Освободилось» / «Пропустить»)

### Добавить новое упражнение/вариант
1. Добавить объект в `exerciseVariations[varKey]`
2. Положить GIF в `assets/img/exercises/{img-slug}.gif`
3. Готово — buildSlots подхватит автоматически

---

## 8. КРИТИЧЕСКИЕ ПРЕДУПРЕЖДЕНИЯ

- **Rest timer overlay** — расположен ВНЕ `.screen` (перед `</script>`). CSS `transform` на `.screen` ломает `position:fixed`. НЕ ПЕРЕМЕЩАТЬ.
- **sw.js CACHE version** — ОБЯЗАТЕЛЬНО поднимать при каждом изменении index.html. Service Worker агрессивно кеширует.
- **localStorage schema** — любое изменение структуры `App.persist` требует миграции (см. `migrateOldDayKeys` как пример).
- **ImgLoader pattern** — сначала рендерить `<img src="data:,">`, затем вызывать `ImgLoader.setSrc()` после вставки в DOM. Иначе картинки не загрузятся.
- **CSS классы в JS** — `.now-card`, `.now-card-thumb img`, `.check-card`, `.done-row`, `.muscle-card-img`, `.heat-img-bar`, `.alt-variant-thumb` — используются для DOM-запросов. Переименование требует синхронизации с JS.

---

## 9. DEPLOY

- **GitHub Pages**: https://remotor-work.github.io/gym-battery/
- **Remote**: github.com:remotor-work/gym-battery.git
- **Branch**: main
- **После каждого коммита**: `git push origin main`
- **После изменения index.html**: bump CACHE version в sw.js
