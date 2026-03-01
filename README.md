# GYM BATTERY

**A smart workout tracker built for real gyms — where nothing ever goes as planned.**

🔗 **[Live App →](https://remotor-work.github.io/gym-battery/)**

---

## The Problem

Anyone who trains in a busy urban gym knows the situation: your program says "barbell bench press," but every bench is taken. So you wait. And wait. Five, ten, fifteen minutes — burning your rest window, losing momentum, getting frustrated.

Most workout apps treat your training plan as a rigid script. They don't care that the squat rack is occupied or the cable machine has a queue. You're expected to follow the plan exactly, or the whole session falls apart.

## The Solution

GYM BATTERY is built around one core idea: **every exercise has alternatives**.

Instead of locking you into a single movement, each slot in your program offers a curated set of variations — different equipment, different mechanics, same muscle target. If the flat barbell bench is taken, you pick the dumbbell version, the Smith machine, the cable crossover, or the chest press machine. Same workout, zero waiting.

You choose what's available *right now*. The app remembers what you did and keeps your progress on track.

## Key Features

- **Exercise variability** — 4–7 alternatives per movement, grouped by muscle group and equipment
- **PPL split structure** — 4 training days (Push A / Pull A / Legs / Push B+Pull B)
- **Flexible scheduling** — training days are not tied to specific weekdays; train on your own rhythm
- **Set tracking** — log weight and reps for each set, with auto-filled suggestions from last session
- **Rest timer** — configurable countdown between sets
- **Progress persistence** — all data stored locally, no account required, no server
- **Offline-ready PWA** — install to your home screen, works without internet
- **Exercise catalog** — browse the full library organized by muscle group

## Tech

Pure frontend. No framework, no backend, no build step.

- Vanilla HTML / CSS / JavaScript — single `index.html` file
- localStorage for data persistence
- Service Worker for offline caching
- Web App Manifest for PWA installation

## Install on Android

1. Open [remotor-work.github.io/gym-battery](https://remotor-work.github.io/gym-battery/) in Chrome
2. Tap the menu (⋮) → **"Add to Home screen"**
3. Done — the app opens in its own window, no browser UI

---

*Currently in active development. Exercise library and UI are being expanded.*
