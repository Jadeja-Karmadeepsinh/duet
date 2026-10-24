# Design System: Focus Tracker

Focus Tracker adheres to the principles of fluid Apple-style craftsmanship combined with shadcn/ui primitives.

## 1. Core Visual Foundations

### 1.1 Color Palette & Theme Tokens
- Dark-mode first aesthetics with deep neutral zinc/slate tones, subtle border contrasts, and vibrant functional accents.
- Semantic tokens:
  - `bg-background`: Deep canvas (`#09090b` / `oklch(0.14 0.005 285)`)
  - `bg-card`: Elevated floating surface with soft border (`#18181b`)
  - `text-foreground`: Clean, optical contrast (`#fafafa`)
  - `text-muted-foreground`: Subdued metadata and secondary details (`#a1a1aa`)
  - `border`: Crisp, low-contrast boundary lines (`rgba(255, 255, 255, 0.08)`)
  - `primary`: Vibrant accent for key call-to-actions, running states, and active streaks (`#38bdf8` / `#6366f1` / `#10b981`)
- No raw color utility overrides (e.g. avoid `bg-blue-500` or `text-gray-400`); always leverage semantic tokens.

### 1.2 Translucency & Depth (Apple Materials)
- Top navigation and floating timer controls use blurred translucent glass:
  ```css
  background: rgba(18, 18, 22, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  ```
- Floating cards feature layered elevation with soft ambient shadows.

### 1.3 Typography
- Body font: Clean system typography or Geist/Inter with optical sizing.
- Time counters: Monospace tabular numerals (`font-mono tabular-nums tracking-tight`) to prevent layout jitter when seconds tick.
- Dynamic tracking: Tightened tracking (`tracking-tight` / `-0.02em`) on large display figures; neutral tracking on body copy.

---

## 2. Interaction & Motion Rules

### 2.1 Latency & Press Feedback
- Buttons and interactive items respond immediately on pointer-down:
  ```css
  .press-scale:active {
    transform: scale(0.97);
    transition: transform 100ms ease-out;
  }
  ```
- No artificial delays or blocking transitions.

### 2.2 Spring Dynamics
- Critically damped springs (`damping: 1.0`, `response: 0.35s`) for dialogs, drawers, and tabs.
- Subtle momentum bounce (`damping: ~0.8`) reserved exclusively for flick and swipe gestures.
- Reduced-motion compliance (`@media (prefers-reduced-motion: reduce)`) switches transforms to subtle cross-fades.

---

## 3. Component Hierarchy & Patterns

- **Dialogs & Overlays**: Use accessible shadcn `Dialog`, `Sheet`, or `Drawer` primitives with explicit `DialogTitle` and `DialogDescription`.
- **Forms**: Structured with `FieldGroup` and `Field`, with validation indicators via `data-invalid` and `aria-invalid`.
- **Data States**:
  - **Loading**: Pulse skeletons (`Skeleton`) matching the shape of incoming content.
  - **Empty**: Contextual zero-state containers with helpful prompts to create the first task or session.
  - **Error**: Accessible alerts (`Alert`, `AlertTitle`, `AlertDescription`) with retry triggers.
  - **Success**: Inline confirmations and non-intrusive Sonner toasts.
