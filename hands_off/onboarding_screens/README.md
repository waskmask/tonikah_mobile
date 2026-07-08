# Handoff: toNikah Onboarding Flow

## Overview
A 3-screen onboarding/splash flow for **toNikah**, a halal Muslim-marriage app. The photographic couple illustration from the original build is replaced with a **scalable vector system** (a Moorish arch + 8-point-star emblem and a faint geometric lattice). The flow supports **light + dark mode**, is **responsive from phone to tablet**, and has subtle entrance motion.

Screens, in order:
1. **Splash** — heart logo + "toNikah" wordmark + tagline, "Start" button.
2. **Only for Marriage** — eyebrow "A PLATFORM", headline, two paragraphs, "Next" button.
3. **Before I Begin** — eyebrow "MY INTENTION", headline, intention copy + Terms of Use link, "Bismillah" button.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behaviour, **not production code to copy directly**. The task is to **recreate these designs in the target codebase's environment** (e.g. React Native / Flutter / SwiftUI / Jetpack Compose for a mobile app) using its established components, navigation and theming patterns. If no environment exists yet, pick the framework best suited to the product (this is a native-feeling mobile onboarding) and implement there.

The `.dc.html` files use a small runtime (`support.js`, included) to render. Open `toNikah Splash.dc.html` in a browser to see the interactive flow; open `toNikah Onboarding Concepts.dc.html` to see the four explored art directions plus the light/dark Plus-Jakarta variant.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, vectors and interactions are specified below and should be reproduced closely. Recreate the UI faithfully using the codebase's own primitives.

## Screens / Views

### Shared layout (all screens)
- **Frame**: full-screen. Safe-area top ~6% for the status bar, content padded `~9% top / 8.5% sides / 3.6% bottom`.
- **Background stack** (bottom → top):
  1. Base fill (see tokens).
  2. Radial warm glow: `radial-gradient(120% 80% at 50% 34%, <glow>, transparent 62%)`.
  3. **Lattice** watermark — `tonikah-lattice-tile.svg`, tiled, very low opacity.
  4. **Arch medallion** — `tonikah-arch-medallion.svg`, bottom-centre, ~66% of screen height, opacity 0.5 (splash) / 0.85 (content screens), gentle float animation (translateY ±14px over 7.5s).
- **Content column**: centred text. On the splash it's vertically centred; on content screens it's top-aligned with ~4% extra top padding.
- **Bottom region**: full-width CTA pill, then a 3-dot page indicator (active dot = 26px wide coral-gradient pill; inactive = 8px circle at low opacity).
- **Home indicator**: 34%-wide, 5px rounded bar, centred at the very bottom.
- **No settings gear** — the gear in early screenshots was the Android emulator's chrome, not part of the app. Do not add one.

### Screen 1 — Splash
- **Purpose**: brand moment + entry.
- **Components**:
  - Heart logo (`tonikah-heart-logo.svg`), ~22% of screen height, entrance: scale 0.55→1 + fade (`~0.75s`, ease-out-back).
  - Wordmark "toNikah" — Plus Jakarta Sans 800, ~9.4% of screen height, letter-spacing −0.02em, colour = wordmark token. Entrance: fade-up.
  - Tagline "Halal · Sincere · For Marriage" — Plus Jakarta Sans 600, uppercase, letter-spacing 0.34em, eyebrow colour.
  - CTA "Start" (see CTA spec). Page dots: dot 1 active.

### Screen 2 — Only for Marriage
- **Purpose**: state the app's single intent.
- **Components**:
  - Eyebrow "A PLATFORM" — Plus Jakarta Sans 600, uppercase, letter-spacing 0.3em, eyebrow colour.
  - Headline "Only for Marriage" — Plus Jakarta Sans 800, ~30–31px @ phone, line-height 1.05, letter-spacing −0.02em, headline colour.
  - Paragraph 1: "We created toNikah for one reason — to help sincere Muslims find their life partner through a halal and meaningful path."
  - Paragraph 2: "No casual swiping. No non-serious connections. Every feature is designed to respect your intention, your family, and your deen."
  - Body — Plus Jakarta Sans 400, ~13.5px phone, line-height 1.5, body colour.
  - CTA "Next". Page dots: dot 2 active.

### Screen 3 — Before I Begin
- **Purpose**: intention pledge + terms consent.
- **Components**:
  - Eyebrow "MY INTENTION".
  - Headline "Before I Begin".
  - Paragraph 1: "I am here to find my life partner for the sake of Allah, through a path that is halal and meaningful."
  - Paragraph 2: "I commit to treating every person on toNikah with honesty, dignity, and respect."
  - Consent line: "By continuing, I agree to the **Terms of Use**" — "Terms of Use" is a link (headline colour, underlined, weight 600), opens the terms.
  - CTA "Bismillah" (advances into the app). Page dots: dot 3 active.

### CTA pill (all screens)
- Full width, height ~8% of screen (min 52px), radius 999px.
- Fill: `linear-gradient(105deg, #FF9C74 0%, #F76A82 58%, #EF5A86 100%)`.
- Label: Plus Jakarta Sans 700, white, centred; chevron-right icon pinned ~7% from the right edge.
- Shadow: `0 14px 30px -10px rgba(240,90,110,.6)`, plus `inset 0 1px 0 rgba(255,255,255,.25)`.

## Interactions & Behavior
- **Advance**: tapping the CTA goes to the next screen; from screen 3 it enters the app (here it loops to splash for demo). Tapping a page-dot jumps to that screen.
- **Entrance motion**: content fades/rises in (~0.55s, cubic-bezier(.2,.7,.2,1)) on load; splash logo pops in. Keep motion subtle. **Do not gate content visibility on an animation that can pause off-screen** — content must default to visible (a bug we hit and fixed: content should never get stuck hidden).
- **Arch medallion**: continuous slow float.
- **Responsive**: text and spacing scale with the viewport (the prototype uses container-relative units). Phone aspect ≈ 384:832; tablet ≈ 3:4 with wider side margins. Nothing should clip; the CTA + dots always sit inside the safe area.

## State Management
- `currentScreen` (0–2) — drives content, active dot, CTA label, and target of "next".
- `theme` ('light' | 'dark') — from OS setting / user toggle.
- `device` — layout adapts to width; no explicit state needed if using responsive units.
- Consent: record acceptance when "Bismillah" is tapped on screen 3.

## Design Tokens

**Coral gradient (CTA, active dot, heart) — identical in both modes**
`linear-gradient(105deg, #FF9C74 0%, #F76A82 58%, #EF5A86 100%)`

| Token | Light | Dark |
|---|---|---|
| Background | `#FBF6F0` | `#141210` |
| Warm glow | `rgba(255,150,120,.16)` | `rgba(255,120,110,.18)` |
| Headline text | `#141826` | `#F4EEE6` |
| Body text | `rgba(32,28,40,.64)` | `rgba(244,238,230,.64)` |
| Eyebrow | `#A2968B` | `#B7A99A` |
| Wordmark | `#111C3A` | `#FDF6EE` |
| Arch stroke | `rgba(96,64,52,.32)` | `rgba(255,220,200,.24)` |
| Lattice stroke | `rgba(120,80,60,.09)` | `rgba(255,220,200,.07)` |
| Dot (inactive) | `rgba(20,18,30,.16)` | `rgba(255,245,235,.20)` |
| Home indicator | `rgba(20,18,30,.30)` | `rgba(255,245,235,.38)` |

**Type**: Plus Jakarta Sans — 800 headline (−0.02em), 600 eyebrow (uppercase, +0.28–0.34em), 700 CTA, 400 body.
**Radius**: pills 999px; lattice star tiles rounded 8px. **CTA shadow**: `0 14px 30px -10px rgba(240,90,110,.6)`.

Dark mode, in one line: swap cream→warm-charcoal (`#141210`, keep it *warm*, never `#000`), retint vectors brown→ivory and nudge arch opacity up, set text to `#F4EEE6`/64%, and **keep the coral gradient unchanged** — that shared accent unifies the modes.

## Assets
All in `assets/` (SVG — true vectors, recolourable):
- `tonikah-arch-medallion.svg` — arch + 8-point star emblem. Uses `currentColor`; tint per mode.
- `tonikah-lattice-tile.svg` — 64×64 tileable lattice. `currentColor`, low opacity.
- `tonikah-heart-logo.svg` — heart logomark (fixed coral gradient + white swirl). Splash hero / app icon.
- `assets/README.md` — asset notes + dark-mode spec (duplicated above).

## Files
- `toNikah Splash.dc.html` — interactive 3-screen flow (light/dark + phone/tablet). Primary reference.
- `toNikah Onboarding Concepts.dc.html` — four art directions (Arch, Crescent, Kufic, Petals) + the chosen Arch in Plus Jakarta Sans, light & dark.
- `support.js` — runtime needed to open the `.dc.html` files in a browser.
- `assets/` — the SVG assets above.
- `screenshots/` — reference renders: `01–03-light.png` (Splash, Only for Marriage, Before I Begin) and `01–03-dark.png` (same three in dark mode).
