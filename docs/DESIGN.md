# Focus Duo Design System & Implementation Reference

> **Status**: Production Implemented (Phase UI-9 Final Pass)  
> **Aesthetic Foundation**: Apple Human Interface Guidelines, macOS/iOS System Utilities, OKLCH Color Geometry  
> **Typography**: Poppins (Google Fonts via Next.js Font Optimization) + SF Mono / Tabular Numeral Foundations  

---

## 1. Visual Direction & Philosophy

### Core Aesthetic: Calm, Refined, Monochromatic Depth
Focus Duo is built around the ethos of focused, quiet productivity. Rather than aggressive artificial AI tropes (such as noisy gradients, glowing canvas blobs, or rainbow borders), the interface utilizes subtle tonal layering, refined typography, and precise hairline boundaries:

- **Light Mode Architecture**:
  - **Canvas Background**: `oklch(0.97 0.003 260)` (~`#f5f5f7`) — macOS system utility canvas.
  - **Elevated Surfaces**: `oklch(1 0 0)` (`#ffffff`) — Pure white cards with `1px` subtle hairline border (`oklch(0.90 0.004 260)`).
  - **Primary Foreground**: `oklch(0.18 0.005 260)` — Near-black optical clarity.
  - **Muted Text**: `oklch(0.52 0.008 260)` — Neutral slate gray with high contrast legibility.
  - **Primary Action Accent**: `oklch(0.55 0.22 255)` — Apple system blue, reserved strictly for primary interactive triggers.
  - **Success / Completion**: `oklch(0.62 0.17 145)` — Natural emerald green for active streaks and completed sessions.
  - **Warning**: `oklch(0.72 0.16 70)` — Amber for paused timer states and delayed checkpoints.
  - **Destructive**: `oklch(0.60 0.22 25)` — Apple system red for archive/deletion and errors.

- **Dark Mode Architecture**:
  - **Canvas Background**: `oklch(0.12 0.005 260)` (~`#0d0d0e`) — Deep near-black background.
  - **Elevated Surfaces**: `oklch(0.18 0.006 260)` (~`#1c1c1e`) — Elevated charcoal card surfaces.
  - **Primary Foreground**: `oklch(0.97 0.003 260)` — Crisp white with specular depth.
  - **Muted Text**: `oklch(0.65 0.008 260)` — Slate gray maintaining WCAG AA contrast.
  - **Primary Action Accent**: `oklch(0.68 0.20 255)` (`#2997ff`) — Vibrant light blue with increased luminance for dark canvas.
  - **Hairline Border**: `oklch(1 0 0 / 10%)` — Subtle specular rim highlight.

- **Restrained Glassmorphism**:
  - Translucency is strictly restricted to navigation rails and justified contextual overlays (sticky top header, mobile bottom nav, tooltip cards).
  - Uses `backdrop-filter: blur(20px) saturate(180%)` with `-webkit-backdrop-filter` fallback.
  - Main cards and data surfaces always remain completely opaque for maximum legibility and distraction-free readability.

---

## 2. Typography & Numeral Geometry

### Font Family
- **Interface / Headings**: Poppins loaded via `next/font/google` (`latin` subset, weights 400, 500, 600, 700, CSS variable `--font-poppins`).
- **Monospace & Numerical**: `"SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` via `--font-mono`.

### Numeral Stability (`tabular-nums`)
All dynamic numerical counters—including timer minutes/seconds, session durations, streak counts, rank badges, and checkpoint delta tallies—strictly enforce `font-variant-numeric: tabular-nums;`. This completely eliminates horizontal width jitter as digits cycle.

### Hierarchy & Scale
| Level | Font Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| Display / Timer | `text-4xl` to `text-6xl` | `1.0` | Bold (700) | Central countdown and stopwatch display |
| Page Title | `text-xl` sm:`text-2xl` | `1.2` | Bold (700) | Page titles, major section headings |
| Card Title | `text-base` sm:`text-lg` | `1.3` | SemiBold (600) | Card headings, dialog headers |
| Body Text | `text-sm` (14px) | `1.5` | Regular (400) / Medium (500) | Task titles, descriptions, form labels |
| Micro Meta | `text-xs` (12px) | `1.4` | Medium (500) | Badges, tooltips, timestamps, captions |
| Super Caption | `text-[10px]` to `text-[11px]` | `1.2` | SemiBold (600) | Uppercase category pills, status labels |

---

## 3. Spatial System, Radii & Layout Tokens

### Unified Radius Scale
- **Pills & Badges**: `rounded-full` (`9999px`)
- **Inputs & Button Controls**: `rounded-xl` (`12px`)
- **Data Cards & Panels**: `rounded-3xl` (`24px`) — uniformly applied across Timer, Tasks, Streak, Heatmap, Analytics, and Standings containers.
- **Dialogs & Modals**: `rounded-2xl` to `rounded-3xl` with `max-h-[85vh]` internal scroll regions.

### Padding Standards
- Primary cards: `p-5 sm:p-6` (Timer card uses `p-5 sm:p-8` for extra breathing room on desktop).
- Main view container: Max width `1280px` centered with `p-4 md:p-8`.

---

## 4. Layout Architecture & App Shell

```
┌────────────────────────────────────────────────────────────────────────┐
│ Desktop Viewport (h-dvh)                                               │
├───────────────┬────────────────────────────────────────────────────────┤
│ Fixed Sidebar │ Sticky Glass Header (z-20)                             │
│ (w-60/w-64)   │ Title • India Date (IST) • Theme Toggle • Profile Menu │
│               ├────────────────────────────────────────────────────────┤
│ • Brand Mark  │ Independent Scroll Canvas (md:overflow-y-auto)         │
│ • Scrollable  │                                                        │
│   Nav List    │   Main Page Content (max-w-[1280px])                   │
│ • Pinned      │                                                        │
│   Profile &   │                                                        │
│   Theme Toggle│                                                        │
└───────────────┴────────────────────────────────────────────────────────┘
```

- **Desktop Navigation**: Stationary `h-dvh` rail. Profile identity is pinned at the bottom (`mt-auto shrink-0`), ensuring adding tasks or scrolling long pages never shifts the profile or navigation out of view.
- **Mobile Navigation**: Sticky top header + fixed bottom glass navigation bar (`z-30`). The bottom navigation observes device safe-area insets (`env(safe-area-inset-bottom)`), while the main container applies `pb-[calc(4.5rem+env(safe-area-inset-bottom))]` so bottom actions are never obscured.

---

## 5. Page Implementations

### Dashboard (`/dashboard`)
Strictly restricted to 4 core daily modules:
1. **Focus Timer**: SVG progress ring for countdown mode; ambient ring for stopwatch; action cluster (`Start`, `Pause`, `Complete`, `End`); auto-expiry decision flow.
2. **Focus Tasks**: Truncated titles with accessible tooltips; category tag; planned duration; select task trigger; edit & archive dropdown.
3. **Activity & Focus (Contribution Graph)**: 26-week heatmap with OKLCH green tiers; **today's total focus time positioned in the top-left header** of the same container; click-to-inspect date modal.
4. **Streak Card**: Current streak with amber flame badge; status message; best historical record.

### Analytics (`/analytics`)
Dedicated data analysis route:
- Segmented range control: `7D`, `30D`, `90D`, `1Y`, `Lifetime` (query parameter `?range=`).
- 4-column summary metric cards (Total Focus, Completed Tasks, Daily Average, Active Days).
- Dominant full-width focus duration bar chart with dynamic label intervals.
- Side-by-side completions bar chart and ranked category distribution bars.
- Personal highlights (longest streak, longest session) and chronological completed session log.

### Leaderboard (`/leaderboard`)
Two-person team accountability view:
- Segmented timeframe control: `Today` and `Last 7 days`.
- Scheduled checkpoint status banner (10:00 AM, 6:00 PM, 10:00 PM IST) with live IST clock and delay indicator.
- Standings list with proportional progress bar and current user badge (`You`).
- Through-the-Day Progression table tracking cumulative focus and checkpoint deltas.

### Authentication (`/login`)
- Clean centered monochrome card (`max-w-[390px]`).
- Segmented mode toggle (`Sign In` / `Create Profile`).
- Team invite code field with fluid accordion expansion.
- Top-right accessible theme toggle.

---

## 6. Motion & Accessibility System

- **Active Segment Springs**: `activePillSpring` (`stiffness: 400`, `damping: 34`, `mass: 0.8`) provides critically damped, zero-overshoot sliding indicators.
- **State Micro-Transitions**: Status pills and alert banners use `180ms` ease-out transitions (`statusPillVariants`).
- **Task List Orchestration**: Tasks enter and exit with `AnimatePresence` and height collapse (`taskRowVariants`).
- **Reduced Motion**: Full compliance enforced via CSS media query:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
  Motion for React hooks automatically observe `(prefers-reduced-motion: reduce)` to disable spring displacement.
