# GYM BATTERY v2 — Промт для создания модульного приложения

> Этот документ — самодостаточная инструкция для AI-агента.
> Содержит всё необходимое: архитектуру, схемы БД, инфраструктуру, UX-требования, бизнес-логику.
> Цель: построить Gym Battery v2 с нуля как модульное web-приложение (PWA).

---

## 1. ЧТО ЭТО

Gym Battery — персональный тренировочный PWA-трекер. Пользователь запускает тренировку дня, видит подобранные упражнения (с ротацией по heat-score), выполняет подходы с таймером отдыха, ведёт лог и статистику.

**Ключевые фичи:**
- Программа на 4 основных дня (Push/Legs/Pull/Legs) + до 3 экстра-тренировок (пресс + изоляция)
- Упражнения подбираются автоматически из справочника gymref (PostgreSQL, ~1400 упражнений)
- Heat map — недавно использованные упражнения получают "штраф", чтобы обеспечить ротацию
- Тренировку можно прервать и продолжить позже
- Оффлайн-режим (PWA с Service Worker)
- Календарь с визуализацией прогресса

---

## 2. ИНФРАСТРУКТУРА

### Хостинг: Raspberry Pi (Ubuntu 24.04 ARM64)

| Параметр | Значение |
|---|---|
| IP (LAN) | 192.168.0.10 |
| SSH user | remotor |
| SSH password | rK@midoa#7 |
| Node.js | v20 (через NodeSource) |
| PM2 | 6.x (процесс-менеджер) |

### Nginx (reverse proxy)

Gym Battery будет третьим сайтом на этом Nginx (рядом с Joplin на :80 и GymRef на :8080).

**Предлагаемый порт: 8081** (или на усмотрение агента).

Конфиг (создать `/etc/nginx/sites-available/gym-battery`):
```nginx
server {
    listen 8081;
    server_name 192.168.0.10 raspberrypi1.local;

    # Статика приложения (PWA shell)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PostgreSQL 16

**Две базы данных используются:**

1. **`gymref`** — ТОЛЬКО ЧТЕНИЕ. Справочник упражнений (уже существует, ~1400 записей).
   - Подключение: `postgres://remotor:rK@midoa#7@localhost:5432/gymref`
   - Приложение читает: exercises, muscles, muscle_groups, equipment, exercise_muscles, exercise_equipment, exercise_media, exercise_variants, exercise_relations, exercise_aliases

2. **`gym_battery`** — НОВАЯ БАЗА. Пользовательские данные (прогресс, логи, настройки, heat map, программы).
   - Подключение: `postgres://remotor:rK@midoa#7@localhost:5432/gym_battery`
   - Нужно создать базу и таблицы (схема ниже)

---

## 3. СХЕМА БАЗЫ ДАННЫХ gym_battery

```sql
-- Создание базы
CREATE DATABASE gym_battery OWNER remotor;

-- ============================================================
-- Таблицы приложения Gym Battery
-- ============================================================

-- Тренировочные программы (шаблоны)
CREATE TABLE programs (
    id          serial PRIMARY KEY,
    slug        text NOT NULL UNIQUE,
    name        text NOT NULL,
    description text,
    days_count  smallint NOT NULL,          -- 4 для стандартной программы
    is_active   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Дни программы (шаблоны)
CREATE TABLE program_days (
    id          serial PRIMARY KEY,
    program_id  int NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    day_index   smallint NOT NULL,          -- 0-based: 0,1,2,3 для 4-дневной
    name        text NOT NULL,              -- "Верх: жимы"
    description text,                       -- "Грудь горизонтально + плечи + трицепс"
    UNIQUE (program_id, day_index)
);

-- Слоты дня (какие мышцы/типы нужны в каждом слоте)
CREATE TABLE program_day_slots (
    id              serial PRIMARY KEY,
    program_day_id  int NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    slot_index      smallint NOT NULL,      -- 0-5 (6 слотов)
    muscle_group    text NOT NULL,           -- slug из gymref.muscle_groups: 'chest', 'shoulders', ...
    mechanics       text NOT NULL DEFAULT 'any', -- 'compound', 'isolation', 'any'
    movement_hint   text,                   -- "горизонтальный жим", "разведение"
    UNIQUE (program_day_id, slot_index)
);

-- Настройки пользователя
CREATE TABLE user_settings (
    id              serial PRIMARY KEY,
    sets_count      smallint NOT NULL DEFAULT 3,
    rest_compound   int NOT NULL DEFAULT 90,   -- секунды
    rest_isolation  int NOT NULL DEFAULT 45,
    active_program_id int REFERENCES programs(id),
    available_equipment jsonb NOT NULL DEFAULT '[]', -- [equipment_slug, ...]
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Состояние недели
CREATE TABLE week_state (
    id          serial PRIMARY KEY,
    week_start  date NOT NULL,              -- понедельник текущей недели
    done_days   jsonb NOT NULL DEFAULT '{}', -- {"0": true, "1": true, "Э0": true}
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Прогресс текущих (незавершённых) тренировок
CREATE TABLE workout_progress (
    id          serial PRIMARY KEY,
    day_key     text NOT NULL UNIQUE,       -- "0", "1", "2", "3", "Э0", "Э1", "Э2"
    slots       jsonb NOT NULL,             -- полный массив слотов с varQueue, busy, done
    in_progress jsonb,                      -- текущий незавершённый сет
    completed_exercises jsonb DEFAULT '[]', -- выполненные упражнения этого дня
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Лог тренировок (поупражненно)
CREATE TABLE workout_log (
    id          serial PRIMARY KEY,
    date        date NOT NULL,
    day_key     text NOT NULL,              -- "0", "1", "Э0" и т.д.
    exercise_slug text NOT NULL,            -- slug из gymref.exercises
    sets        jsonb NOT NULL,             -- [{weight, reps}, ...]
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_log_date_idx ON workout_log (date DESC);

-- История тренировок (по завершённым сессиям)
CREATE TABLE workout_history (
    id              serial PRIMARY KEY,
    date            date NOT NULL,
    day_key         text NOT NULL,
    program_slug    text,
    day_name        text,
    exercises       jsonb NOT NULL,         -- [{slug, name, sets: [{weight, reps}]}]
    total_volume    int NOT NULL DEFAULT 0,
    duration_sec    int,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_history_date_idx ON workout_history (date DESC);

-- Heat map (горячесть упражнений)
CREATE TABLE exercise_heat (
    exercise_slug   text NOT NULL PRIMARY KEY,
    heat            smallint NOT NULL DEFAULT 0, -- 0..10
    last_used       timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Предпочтения: лайки и баны
CREATE TABLE exercise_preferences (
    exercise_slug   text NOT NULL PRIMARY KEY,
    liked           boolean NOT NULL DEFAULT false,
    banned          boolean NOT NULL DEFAULT false,
    updated_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. СХЕМА gymref (ТОЛЬКО ЧТЕНИЕ) — ключевые таблицы

Приложение читает из gymref следующие данные:

```
exercises:           id, slug, name_ru, name_en, description, instructions,
                     difficulty(1-5), safety_score(1-5), position, mechanics(compound/isolation),
                     force_type(push/pull/static/hinge), unilateral, rest_seconds,
                     recommended_rep_min, recommended_rep_max

muscles:             id, slug, name_ru, name_en, latin_name, muscle_group_id, region(upper/core/lower)
muscle_groups:       id, slug, name_ru, name_en, parent_id (иерархия)

equipment:           id, slug, name_ru, name_en, category, is_machine

exercise_muscles:    exercise_id, muscle_id, role(primary/secondary/stabilizer),
                     effectiveness(0-100), activation_pct(0-100)

exercise_equipment:  exercise_id, equipment_id, is_required, is_substitutable

exercise_media:      exercise_id, kind(photo/gif), local_path, thumbnail_path,
                     is_primary, mime_type

exercise_variants:   base_exercise_id, variant_exercise_id, variant_type(grip/angle/stance/equipment_swap/tempo)
exercise_relations:  from_id, to_id, relation(progression/regression/alternative/antagonist)
exercise_aliases:    exercise_id, alias, lang
```

**Медиафайлы** раздаются через Nginx GymRef на порте 8080:
- URL: `http://192.168.0.10:8080/media/{local_path}`
- Авторизация: HTTP Basic Auth (remotor / rK@midoa#7)
- Пример: `http://192.168.0.10:8080/media/photos/bench-press/thumb.jpg`

---

## 5. СТЕК ТЕХНОЛОГИЙ

| Компонент | Технология |
|---|---|
| Frontend | SvelteKit 2 + Svelte 5 |
| Стили | Tailwind CSS 4 |
| Backend | SvelteKit server routes (API) |
| DB driver | `postgres` (porsager) — как в gymref |
| Адаптер | @sveltejs/adapter-node |
| PWA | Service Worker (vite-plugin-pwa или ручной) |
| Процесс | PM2 |
| Reverse proxy | Nginx (порт 8081) |

**Почему SvelteKit**: уже используется в gymref, знакомый стек, SSR + API routes + static build.

---

## 6. ФАЙЛОВАЯ СТРУКТУРА

```
/home/remotor/gym-battery/
├── app/                            # SvelteKit проект
│   ├── src/
│   │   ├── lib/
│   │   │   ├── server/
│   │   │   │   ├── db.ts           # Подключение к gym_battery PostgreSQL
│   │   │   │   ├── gymref.ts       # Подключение к gymref PostgreSQL (read-only)
│   │   │   │   └── repositories/
│   │   │   │       ├── exerciseRepo.ts    # Чтение из gymref
│   │   │   │       ├── programRepo.ts     # CRUD программ
│   │   │   │       ├── workoutRepo.ts     # Прогресс, логи, история
│   │   │   │       ├── heatRepo.ts        # Heat map операции
│   │   │   │       ├── settingsRepo.ts    # Настройки
│   │   │   │       └── prefsRepo.ts       # Лайки/баны
│   │   │   │
│   │   │   ├── stores/                    # Svelte stores (клиентское состояние)
│   │   │   │   ├── workout.ts             # Текущая тренировка
│   │   │   │   ├── timer.ts               # Таймер отдыха
│   │   │   │   └── ui.ts                  # Тосты, модалы
│   │   │   │
│   │   │   ├── engine/                    # Бизнес-логика (shared, может работать и на сервере)
│   │   │   │   ├── scoring.ts             # Heat-score формула, varScore(), приоритеты
│   │   │   │   ├── slot-builder.ts        # Построение слотов из упражнений
│   │   │   │   └── config.ts              # Константы: MAX_HEAT, SCORE_*, SLOTS_PER_DAY и т.д.
│   │   │   │
│   │   │   ├── components/                # Переиспользуемые UI-компоненты
│   │   │   │   ├── Calendar.svelte        # Месячный календарь
│   │   │   │   ├── Battery.svelte         # Индикатор заряда
│   │   │   │   ├── ExerciseCard.svelte    # Карточка упражнения (зоны: now/check/done)
│   │   │   │   ├── MuscleCard.svelte      # Карточка мышечной группы
│   │   │   │   ├── SetButton.svelte       # Кнопка подхода
│   │   │   │   ├── RestTimer.svelte       # Таймер отдыха (SVG ring)
│   │   │   │   ├── HeatBar.svelte         # Тепловой бар на картинке
│   │   │   │   ├── Toast.svelte           # Уведомления
│   │   │   │   ├── Modal.svelte           # Модальные окна
│   │   │   │   └── DayLogPopup.svelte     # Popup лога за день
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── format.ts              # Форматирование дат, чисел
│   │   │       └── haptic.ts              # Вибрация
│   │   │
│   │   ├── routes/
│   │   │   ├── +layout.svelte             # Shell: nav bar, toast container, timer overlay
│   │   │   ├── +page.svelte               # Home: календарь + CTA
│   │   │   │
│   │   │   ├── workout/
│   │   │   │   ├── [dayKey]/
│   │   │   │   │   ├── +page.svelte       # Muscle cards (обзор дня)
│   │   │   │   │   └── [slotIdx]/
│   │   │   │   │       ├── +page.svelte   # Зоны: делай/проверь/выполнено
│   │   │   │   │       └── sets/
│   │   │   │   │           └── +page.svelte  # Подходы (weight/reps/timer)
│   │   │   │
│   │   │   ├── catalog/
│   │   │   │   ├── +page.svelte           # Каталог (группы + поиск)
│   │   │   │   └── [slug]/
│   │   │   │       └── +page.svelte       # Деталь упражнения
│   │   │   │
│   │   │   ├── stats/
│   │   │   │   └── +page.svelte           # Статистика + история
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   └── +page.svelte           # Настройки
│   │   │   │
│   │   │   └── api/                       # API endpoints (server-only)
│   │   │       ├── exercises/
│   │   │       │   └── +server.ts         # GET: список упражнений из gymref
│   │   │       ├── workout/
│   │   │       │   ├── build/+server.ts   # POST: построить слоты для дня
│   │   │       │   ├── progress/+server.ts # GET/PUT: сохранить/загрузить прогресс
│   │   │       │   ├── complete/+server.ts # POST: завершить упражнение
│   │   │       │   └── finish/+server.ts  # POST: завершить тренировку
│   │   │       ├── heat/+server.ts        # GET/PUT: heat map
│   │   │       ├── prefs/+server.ts       # GET/PUT: лайки/баны
│   │   │       ├── log/+server.ts         # GET: лог тренировок
│   │   │       ├── history/+server.ts     # GET: история
│   │   │       ├── settings/+server.ts    # GET/PUT: настройки
│   │   │       └── programs/+server.ts    # GET/PUT: программы
│   │   │
│   │   ├── app.html
│   │   └── service-worker.ts              # PWA offline cache
│   │
│   ├── static/
│   │   ├── manifest.json
│   │   ├── icons/                         # PWA иконки
│   │   └── img/
│   │       ├── ui/                        # Логотип, батарея, иконки
│   │       └── muscles/                   # Анатомические силуэты
│   │
│   ├── svelte.config.js
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── package.json
│   └── ecosystem.config.cjs              # PM2 конфиг
│
├── schema.sql                             # Схема БД gym_battery
└── README.md
```

---

## 7. МОДУЛИ И ИХ ОТВЕТСТВЕННОСТИ

### 7.1 Модуль: ExerciseRepo (server/repositories/exerciseRepo.ts)

**Источник**: gymref (read-only).

```typescript
// Основные запросы к gymref:
getAll(filters?: { muscleGroup?, mechanics?, equipment?, search? }) → Exercise[]
getBySlug(slug: string) → Exercise & { muscles, equipment, media, variants, relations }
getByMuscleGroup(groupSlug: string, role?: MuscleRole) → Exercise[]
getAlternatives(exerciseSlug: string) → Exercise[]
getMedia(exerciseSlug: string) → { jpg?: string, gif?: string, thumb?: string }
search(query: string) → Exercise[]  // через search_tsv
```

**Важно**: все картинки — URL через GymRef Nginx: `http://192.168.0.10:8080/media/{local_path}`. Клиент добавляет Basic Auth header: `Authorization: Basic ${btoa('remotor:rK@midoa#7')}`.

### 7.2 Модуль: WorkoutEngine (lib/engine/)

**Чистая логика, без side effects.** Может работать и на сервере, и на клиенте.

#### config.ts
```typescript
export const CONFIG = {
  SLOTS_PER_DAY: 6,
  MAX_HEAT: 10,
  SETS_DEFAULT: 3,
  SETS_MIN: 2,
  SETS_MAX: 6,
  REST_COMPOUND: 90,
  REST_ISOLATION: 45,
  REST_MIN: 15,
  REST_MAX: 300,
  REST_STEP: 15,
  SCORE_PRIORITY_W: 8,
  SCORE_LIKED_BONUS: 4,
  SCORE_JITTER_MAX: 6,
  MAX_HISTORY: 100,
  MAX_LOG_DAYS: 30,
  EXTRA_DAYS_MAX: 3,
  EXTRA_ABS_SLOTS: 3,    // гарантированных слотов пресса в экстра
};
```

#### scoring.ts
```typescript
// Формула ранжирования вариантов:
// score = priority × 8 + liked × 4 − heat × (1.5 − priority × 0.2) + random(0…6)
//
// priority: 5★(idx 0) → 1★(idx 6), на основе позиции варианта
// liked: +4 если пользователь лайкнул
// heat: 0–10, штраф за недавнее использование
// jitter: случайность для ротации
//
// heat decay: раз в месяц каждый heat -= 1 (min 0)

export function varScore(
  priority: number,
  liked: boolean,
  heat: number
): number { ... }

export function varPriority(variantIndex: number): number {
  return Math.max(1, 5 - variantIndex);  // idx 0→5★, idx 1→4★, ... idx 4+→1★
}
```

#### slot-builder.ts
```typescript
// Строит 6 слотов для тренировочного дня:
// 1. Берёт program_day_slots → для каждого слота определяет muscle_group + mechanics
// 2. Запрашивает упражнения из gymref по фильтрам
// 3. Фильтрует по available_equipment и banned
// 4. Сортирует варианты по varScore (heat + priority + liked + jitter)
// 5. Формирует varQueue (очередь вариантов)

export function buildSlots(
  daySlots: ProgramDaySlot[],
  exercises: Exercise[],
  heat: Map<string, number>,
  prefs: { liked: Set<string>, banned: Set<string> },
  equipment: string[]
): Slot[]

// Для экстра-тренировки:
// 3 слота пресса (muscle_group = 'core', mechanics = 'isolation') — ВСЕГДА
// 3 слота изоляции — самые "холодные" из всех muscle_groups
export function buildExtraSlots(
  exercises: Exercise[],
  heat: Map<string, number>,
  prefs: { liked: Set<string>, banned: Set<string> },
  equipment: string[]
): Slot[]
```

### 7.3 Модуль: Stores (lib/stores/)

Svelte stores для клиентского состояния:

```typescript
// workout.ts — текущая тренировка
export const currentDay = writable<string | null>(null);
export const slots = writable<Slot[]>([]);
export const currentSlotIdx = writable<number | null>(null);
export const setsCompleted = writable<number>(0);
export const setData = writable<SetEntry[]>([]);

// timer.ts — таймер отдыха
export const timerActive = writable(false);
export const timerRemaining = writable(0);
export const timerTotal = writable(0);

// ui.ts — уведомления
export const toasts = writable<Toast[]>([]);
export function showToast(msg: string, ms?: number): void;
```

### 7.4 Модуль: Components (lib/components/)

Каждый компонент — один `.svelte` файл. Принимает данные через props, эмитит события.

| Компонент | Props | События |
|---|---|---|
| Calendar | year, month, dayData[] | on:dayTap(date) |
| Battery | percent, label? | — |
| MuscleCard | slot, index | on:tap(index) |
| ExerciseCard | zone('now'/'check'), slot, variant | on:start, on:busy, on:reclaim, on:dismiss |
| SetButton | setIdx, completed, weight, reps | on:tap(setIdx) |
| RestTimer | remaining, total, radius | on:finish |
| HeatBar | heat(0-10), segments(8) | — |
| Toast | message | on:dismiss |
| Modal | title, body | on:confirm, on:cancel |
| DayLogPopup | date, entries[] | on:close |

### 7.5 Модуль: Routes (маршрутизация)

SvelteKit file-based routing. Каждый route = экран.

```
/                           → Home (календарь + CTA)
/workout/[dayKey]           → Muscle cards (обзор дня, 6 карточек)
/workout/[dayKey]/[slotIdx] → Зоны: ДЕЛАЙ СЕЙЧАС / ПРОВЕРЬ / ВЫПОЛНЕНО
/workout/[dayKey]/[slotIdx]/sets → Подходы (weight/reps/timer)
/catalog                    → Каталог упражнений
/catalog/[slug]             → Деталь упражнения
/stats                      → Статистика + история + лог
/settings                   → Настройки
```

**dayKey**: `"0"` … `"3"` для основных, `"Э0"` … `"Э2"` для экстра.

---

## 8. UX-ТРЕБОВАНИЯ

### 8.1 Тема и стиль

- **Тёмная тема**: чёрный фон (#0a0a0a), оранжевый акцент (#e8740c)
- **Шрифт**: Orbitron (заголовки), системный sans-serif (текст)
- **Aesthetic**: "терминальный" стиль — моноширинные бэйджи, `//` перед лейблами зон, `0%` формат батареи
- **Анимации**: CSS transitions 260ms для переходов между экранами, slide-in/out

### 8.2 Главный экран (/)

- Заголовок: "GYM BATTERY" + версия
- Навигационные иконки: лог ☰, статистика |||, каталог ⊞, настройки ⚙
- **Календарь**: текущий месяц, ПН-ВС. Каждая ячейка:
  - Число
  - Если есть тренировка: мини-батарейка (fill % от выполненных упражнений)
  - Лейбл дня (Д1, Д2, Э1...)
  - Подсветка сегодня: оранжевая рамка
  - Будущие дни: затемнены
- **Тап по дню**: если есть лог → popup с логом. Если сегодня и лог есть (тренировка завершена) → тоже лог. Если сегодня и лога нет → старт тренировки.
- **Блок недели**: "Неделя: 2/4 · Экстра: 1/3" + кнопка "↻ день" (сброс только текущего дня)
- **Превью**: между календарём и кнопкой — дата + описание следующей тренировки
- **CTA**: "НАЧАТЬ ТРЕНИРОВКУ N" / "ПРОДОЛЖИТЬ ТРЕНИРОВКУ N" (авто-выбор)
- **Экстра CTA**: вторичная кнопка "ЭКСТРА-ТРЕНИРОВКА N" (outline стиль)

### 8.3 Экран мышечных групп (/workout/[dayKey])

- Заголовок: "Д1 · ВЕРХ" (или "Э1 · ЭКСТРА-1")
- Кнопки: "СГЕНЕРИРОВАТЬ" (пересоздать слоты), "ВЫЙТИ" (домой)
- Батарейка: процент выполнения дня
- Подсказка: описание дня
- 6 карточек мышечных групп:
  - Анатомическая иконка (SVG силуэт)
  - Тип (ЖИМ / ТЯГА / ПРИСЕДАНИЕ / ИЗОЛЯЦИЯ / ПРЕСС)
  - Название мышцы
  - Движение
  - Стрелка →
  - Если done: зелёная галка вместо стрелки
- Когда все 6 done → баннер "БАТАРЕЯ ЗАРЯЖЕНА" + кнопка "ЗАВЕРШИТЬ"

### 8.4 Экран зон (/workout/[dayKey]/[slotIdx])

Три зоны, одна за другой:

**Зона "ДЕЛАЙ СЕЙЧАС"** (topVarIdx из varQueue):
- Карточка: тип-бэйдж, счётчик "вариант 1/7", звёзды ★★★★★
- Миниатюра упражнения (GIF из gymref) + heat bar overlay
- Название, описание, теги оборудования
- Кнопка "ЗАНЯТО" (переместить в ПРОВЕРЬ, показать следующий)
- Тап по карточке → экран подходов

**Зона "ПРОВЕРЬ"** (busy items):
- Мини-карточки отложенных вариантов
- "ОСВОБОДИЛОСЬ" → вернуть в ДЕЛАЙ
- "ПРОПУСТИТЬ" → убрать навсегда

**Зона "ВЫПОЛНЕНО"**:
- Если слот done: строка с ✓ и названием варианта

**Альтернативные варианты**: под основной карточкой — свёрнутый список остальных из varQueue

### 8.5 Экран подходов (/workout/[dayKey]/[slotIdx]/sets)

- Заголовок: название упражнения
- Большая картинка (GIF/JPG)
- Описание + инструкция
- Теги оборудования + звёзды
- Бэйджи: лайк ♡ / бан ⊘
- Кнопки подходов:
  - Серые кружки (по setsCount шт.)
  - Поля weight / reps (авто-заполнение из прошлой тренировки)
  - Тап → отмечает сет, запускает таймер отдыха
  - Все сеты выполнены → auto-complete через 750ms
- Кнопка "ЗАВЕРШИТЬ ДОСРОЧНО" (если хотя бы 1 сет сделан)

### 8.6 Таймер отдыха (глобальный overlay)

- Полноэкранный overlay поверх всего
- SVG кольцо (radius 70px) с обратным отсчётом
- Секунды крупным шрифтом в центре
- Тап → остановить досрочно
- Haptic vibration при завершении
- Длительность: compound → 90с, isolation → 45с (настраивается)

### 8.7 Каталог (/catalog)

- Поиск по тексту (full-text из gymref)
- Группировка по мышечным группам
- Фильтры: оборудование, тип (compound/isolation), сложность
- Карточки: миниатюра + название + heat bar + мышцы + оборудование

### 8.8 Статистика (/stats)

- Карточка "Текущая неделя": тренировки / упражнения / подходы / объём
- История: последние 20 тренировок (дата, день, объём)
- Лог: календарный лог за 30 дней (тап → popup детали)

### 8.9 Настройки (/settings)

- Подходы: − / N / + (2–6)
- Отдых compound: − / Ns / + (15–300, шаг 15)
- Отдых isolation: − / Ns / + (15–300, шаг 15)
- Доступное оборудование: чеклист из gymref.equipment
- Активная программа: выбор
- Список забаненных упражнений с кнопкой "Разбанить"
- Экспорт / Импорт JSON
- Очистка кеша

---

## 9. БИЗНЕС-ЛОГИКА

### 9.1 Формула ранжирования (Score)

```
score = priority × 8 + liked × 4 − heat × (1.5 − priority × 0.2) + random(0…6)
```

- **priority**: 5 (лучший) → 1 (худший), на основе позиции в списке вариантов exercis
- **liked**: +4 если пользователь лайкнул это упражнение
- **heat**: 0–10, увеличивается при каждом использовании, decay раз в месяц (-1)
- **heatCoeff**: 1.5 − priority × 0.2 → при 5★ коэффициент 0.5, при 1★ — 1.3
- **jitter**: случайный 0–6 для ротации

### 9.2 Формирование тренировки

1. Из `program_day_slots` получаем 6 слотов с указанием muscle_group + mechanics
2. Для каждого слота запрашиваем упражнения из gymref:
   ```sql
   SELECT e.* FROM exercises e
   JOIN exercise_muscles em ON em.exercise_id = e.id
   JOIN muscles m ON m.id = em.muscle_id
   JOIN muscle_groups mg ON mg.id = m.muscle_group_id
   WHERE mg.slug = $1                    -- muscle_group из слота
     AND (e.mechanics = $2 OR $2 = 'any') -- mechanics из слота
     AND em.role = 'primary'
     AND e.deleted_at IS NULL
   ```
3. Фильтруем по `available_equipment` (пересечение)
4. Исключаем `banned`
5. Сортируем по `varScore` → формируем `varQueue`
6. Возвращаем Slot[]

### 9.3 Экстра-тренировки

- 3 фиксированных слота ПРЕСС: muscle_group = 'core', mechanics = 'isolation'
- 3 слота ИЗОЛЯЦИЯ: самые "холодные" упражнения из ВСЕХ muscle_groups с mechanics = 'isolation'
- Не влияют на счётчик основных дней
- Сбрасываются вместе с неделей

### 9.4 Авто-выбор следующей тренировки

Приоритет:
1. Есть незавершённая тренировка (прогресс с слотами, день не в doneDays) → ПРОДОЛЖИТЬ
2. Следующий незавершённый день в порядке программы → НАЧАТЬ
3. Все дни выполнены → кнопка disabled "ВСЕ ТРЕНИРОВКИ ВЫПОЛНЕНЫ ⚡"

### 9.5 Недельный сброс

- При каждом `load()` проверяем: если `week_start` < понедельник текущей даты → автосброс
- Сброс: `done_days = {}`, удаляем все `workout_progress`, week_start = текущий понедельник

### 9.6 Авто-заполнение weight/reps

При открытии подходов ищем последнюю тренировку того же дня в `workout_history`:
```sql
SELECT exercises FROM workout_history
WHERE day_key = $1 ORDER BY date DESC LIMIT 1
```
Если найдено упражнение с тем же slug → копируем weight/reps.

---

## 10. СТАНДАРТНАЯ ПРОГРАММА (seed data)

```sql
-- Программа: 4-дневный сплит
INSERT INTO programs (slug, name, description, days_count, is_active)
VALUES ('split-4', '4-дневный сплит', 'Push/Legs/Pull/Legs', 4, true);

-- День 1: Верх — жимы
-- slot 0: chest compound (жим горизонтальный)
-- slot 1: chest compound (жим наклонный)
-- slot 2: shoulders compound (жим плечи)
-- slot 3: shoulders isolation (боковые дельты)
-- slot 4: triceps isolation (трицепс)
-- slot 5: chest isolation (сведение/разведение)

-- День 2: Низ — приседания
-- slot 0: quads compound (приседание)
-- slot 1: quads compound (жим ногами / гак)
-- slot 2: quads isolation (разгибание)
-- slot 3: hamstrings isolation (сгибание)
-- slot 4: glutes compound (выпады)
-- slot 5: calves isolation (икры)

-- День 3: Верх — тяги
-- slot 0: back compound (тяга вертикальная)
-- slot 1: back compound (тяга горизонтальная)
-- slot 2: back compound (тяга в наклоне)
-- slot 3: biceps isolation (бицепс)
-- slot 4: back isolation (пуловер / прямые руки)
-- slot 5: shoulders isolation (задняя дельта)

-- День 4: Низ — задняя цепь
-- slot 0: hamstrings compound (RDL / мёртвая тяга)
-- slot 1: glutes compound (hip thrust)
-- slot 2: quads compound (болгарские выпады)
-- slot 3: hamstrings isolation (сгибание лёжа)
-- slot 4: glutes isolation (отведение)
-- slot 5: calves isolation (икры сидя)
```

---

## 11. PWA / SERVICE WORKER

```typescript
// Стратегия кеширования:
// 1. App shell (HTML, CSS, JS) → Cache First
// 2. API responses (/api/*) → Network First, fallback to cache
// 3. Медиа (images from gymref) → Cache First, lazy cache on first load
// 4. Версионирование: CACHE_VERSION в sw.ts, бампить при каждом деплое
```

---

## 12. ДЕПЛОЙ

```bash
# На Raspberry Pi:
cd /home/remotor/gym-battery

# 1. Создать БД (один раз)
sudo -u postgres createdb gym_battery -O remotor
psql -U remotor -d gym_battery -f schema.sql

# 2. Создать Nginx конфиг (один раз)
sudo ln -s /etc/nginx/sites-available/gym-battery /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 3. Деплой кода
cd app
npm ci
npm run build

# 4. PM2 (первый раз)
pm2 start ecosystem.config.cjs
pm2 save

# 5. Обновления
cd /home/remotor/gym-battery && git pull && cd app && npm ci && npm run build && pm2 restart gym-battery
```

### ecosystem.config.cjs
```javascript
module.exports = {
  apps: [{
    name: 'gym-battery',
    script: 'build/index.js',
    cwd: '/home/remotor/gym-battery/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgres://remotor:rK@midoa#7@localhost:5432/gym_battery',
      GYMREF_DATABASE_URL: 'postgres://remotor:rK@midoa#7@localhost:5432/gymref',
      GYMREF_MEDIA_BASE: 'http://192.168.0.10:8080/media',
      ORIGIN: 'http://192.168.0.10:8081'
    },
    max_memory_restart: '300M'
  }]
};
```

---

## 13. ПОРЯДОК РЕАЛИЗАЦИИ

1. **Инфраструктура**: создать БД gym_battery, Nginx конфиг, PM2, SvelteKit scaffold
2. **Data layer**: db.ts, gymref.ts, все repositories
3. **Engine**: config, scoring, slot-builder
4. **Компоненты**: Battery, HeatBar, Calendar, ExerciseCard, MuscleCard, SetButton, RestTimer
5. **Home screen**: календарь + week info + CTA + extra CTA
6. **Workout flow**: muscle cards → zones → sets → complete → finish
7. **Catalog**: browse + search + detail
8. **Stats**: weekly card + history + day log popup
9. **Settings**: all controls
10. **PWA**: service worker + manifest
11. **Seed data**: стандартная программа + тестовые данные

---

## 14. КРИТИЧЕСКИЕ ПРЕДУПРЕЖДЕНИЯ

1. **gymref — ТОЛЬКО ЧТЕНИЕ**. Никогда не писать в эту БД из gym-battery.
2. **Таймер отдыха** — overlay вне route-системы (position: fixed поверх всего). CSS `transform` на parent ломает `position: fixed` — overlay должен быть прямым потомком body или layout.
3. **Медиа с gymref** защищены Basic Auth — нужен `Authorization` header или proxyить через свой backend.
4. **Оффлайн**: приложение должно работать без сети. IndexedDB для кеша упражнений, localStorage fallback для критичных данных.
5. **Heat decay**: раз в месяц, -1 к каждому heat. Проверять при load().
6. **Weekday offset**: календарь начинается с понедельника. `(date.getDay() + 6) % 7`.
7. **Не хранить пароли** в клиентском коде. Proxyить gymref media через свой API.
