# Focus Tracker Design System

An Apple-inspired productivity interface engineered for focus, high information hierarchy, and calm, sustained daily use.

---

## 1. Visual Direction & Philosophy

### Core Aesthetic: Refined, Restrained, Editorial
- **System app feel**: Modeled on macOS/iOS system utilities (Notes, Reminders, Calendar, Finder). Clean planes of quiet color, generous breathing room, and clear typographical hierarchy rather than ornamental decoration.
- **Light theme first**:
  - **Canvas (Page Background)**: `#f5f5f7` (macOS system canvas light)
  - **Surfaces (Cards / Panels)**: `#ffffff` (pure white surface with hairline border)
  - **Primary Text**: `#1d1d1f` (near-black, optical clarity)
  - **Secondary / Muted Text**: `#6e6e73` (neutral gray, high legibility)
  - **Hairline Dividers & Borders**: `#e5e5ea` (1px clean edge, no heavy box borders)
  - **Primary Action Accent**: `#0071e3` (Apple system blue — focused, deliberate, used only for key interactive triggers)
  - **Success / Completion**: `#34c759` (system green for streaks, finished sessions, checkmarks)
  - **Warning**: `#ff9500` (system orange for recovery warnings, stale timer alerts)
  - **Destructive / Error**: `#ff3b30` (system red for errors, destructive deletions, failed validation)
- **Dark Theme (Optional Automatic / Toggle)**:
  - **Canvas**: `#000000` (true deep black)
  - **Surfaces**: `#1c1c1e` (macOS dark elevated card surface)
  - **Primary Text**: `#f5f5f7`
  - **Muted Text**: `#86868b`
  - **Hairline Border**: `#2c2c2e` / `rgba(255, 255, 255, 0.08)`
  - **Primary Accent**: `#2997ff` (vibrant light blue)

### What We Avoid (Anti-Patterns)
- **No artificial AI-dashboard tropes**: No full-screen glow blobs, giant gradients, rainbow borders, bouncing numbers, or noisy particle canvases.
- **No card-for-everything syndrome**: Group related data through layout, vertical rhythm, and subtle hairline separators rather than nesting cards within cards.
- **No decorative stock illustrations**: All meaning is communicated through crisp layout, typography, real metrics, and clean Lucide outline icons (`strokeWidth: 1.75`).
- **No emojis as navigation icons**: Use system-grade SVG icons with strict 1:1 sizing.

---

## 2. Typography

### Font Stack
- **Interface / Proportional**:
  ```css
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  ```
  Native system rendering with zero layout shift, zero external network font downloads, and native subpixel antialiasing.
- **Monospace / Numerical (Timers, Durations, Codes)**:
  ```css
  font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
  ```
  Monospaced numbers prevent jitter during timer countdowns.

### Type Scale & Optical Tracking
| Token | Size | Line Height | Tracking | Weight | Usage |
|---|---|---|---|---|---|
| `text-xs` | 11px / 0.6875rem | 14px | `+0.01em` | Medium (500) | Timestamps, tags, uppercase captions |
| `text-sm` | 13px / 0.8125rem | 18px | `0` | Regular (400) / Medium (500) | Secondary body, metadata, table data |
| `text-base` | 15px / 0.9375rem | 22px | `-0.005em` | Regular (400) | Primary body copy, inputs, nav items |
| `text-lg` | 17px / 1.0625rem | 24px | `-0.01em` | SemiBold (600) | Section headers, card titles |
| `text-xl` | 20px / 1.25rem | 26px | `-0.015em` | SemiBold (600) | Page subtitles, dialog titles |
| `text-2xl` | 24px / 1.5rem | 30px | `-0.02em` | Bold (700) | Main page titles, view headers |
| `text-4xl` | 36px / 2.25rem | 40px | `-0.025em` | Bold (700) | Prominent timer displays, key metric callouts |

---

## 3. Spatial System & Layout

### 4px Base Spacing Grid
- `space-1` = 4px
- `space-2` = 8px
- `space-3` = 12px
- `space-4` = 16px
- `space-6` = 24px
- `space-8` = 32px
- `space-12` = 48px

### Desktop Application Shell
- **Left Navigation Rail**: Fixed width `240px`. Quiet, understated background (`#fbfbfd` or slightly tinted translucent surface), simple product wordmark **Focus**, three primary routes:
  1. `Dashboard` (Timer, current focus, quick task queue)
  2. `Analytics` (Historical focus time, session distribution, trends)
  3. `Leaderboard` (Checkpoints at 10:00, 18:00, 22:00 IST)
  - Bottom section contains the active user profile identity, current date context, and sign-out button.
- **Top Context Header**: Height `56px`. Shows breadcrumb or page title, local India date (`Asia/Kolkata`), and user avatar profile menu.
- **Main View Canvas**: Centered container with max width `1280px`, horizontal padding `32px` on desktop, `16px` on mobile. Generous vertical breathing room.

### Mobile Adaptations
- Sidebar collapses into a compact top bar with brand mark and accessible trigger for a slide-over mobile Sheet.
- Bottom navigation bar on mobile viewports for quick one-thumb switching between `Dashboard`, `Analytics`, and `Leaderboard`.
- Zero horizontal overflow (`overflow-x-hidden`). All timer controls, task lists, and forms scale down smoothly to 360px widths.

---

## 4. Materials, Elevation & Borders

### Corner Radii
- **Controls & Buttons**: `8px` (`rounded-lg`)
- **Cards & Data Panels**: `12px` (`rounded-xl`)
- **Modals, Dialogs & Sheets**: `16px` (`rounded-2xl`)
- **Pills & Status Badges**: `9999px` (`rounded-full`)

### Hairlines & Elevation
- **Hairline Border**: `1px solid var(--border)` (`#e5e5ea` in light, `rgba(255,255,255,0.08)` in dark).
- **Subtle Elevation**:
  ```css
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
  ```
  Elevated modals and floating timer panels use:
  ```css
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  ```

---

## 5. Motion & Physicality (Apple Guidelines)

- **Default UI Spring**: Critically damped (`damping: 1.0`, `response: 0.35s`). Sits immediately at rest without theatrical bounce.
- **Interactive Feedback**: Instant response on pointer-down:
  ```css
  .press-scale:active {
    transform: scale(0.98);
    transition: transform 80ms ease-out;
  }
  ```
- **Respect Reduced Motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
