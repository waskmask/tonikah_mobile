# toNikah onboarding — assets & dark-mode spec

## Vector assets (all SVG)

| File | What it is | How to use |
|---|---|---|
| `tonikah-arch-medallion.svg` | Moorish arch + 8-point star emblem (the background motif). | Uses `currentColor` — set the parent's `color` (or swap for a hex) to tint. Place bottom-centre, ~66% of screen height, `opacity` 0.6 (light) / 0.7 (dark). |
| `tonikah-lattice-tile.svg` | 8-point-star lattice, tiles on a 64×64 grid. | Also `currentColor`. Use as a repeating background or full-bleed watermark at low opacity (see below). |
| `tonikah-heart-logo.svg` | The heart logomark (coral gradient + white swirl). | Fixed colours. Splash screen hero + app icon. |

These are true vectors (SVG paths), not raster — they stay crisp at any size and recolour for light/dark. The background in the mockups is exactly these two files layered: lattice tile (very faint) behind the arch medallion.

## Colour tokens

**Coral gradient (CTA + active dot + heart) — same in both modes**
`linear-gradient(105deg, #FF9C74 0%, #F76A82 58%, #EF5A86 100%)`

| Token | Light | Dark |
|---|---|---|
| Background | `#FBF6F0` | `#141210` |
| Warm glow (radial, top) | `rgba(255,150,120,.16)` | `rgba(255,120,110,.18)` |
| Headline text | `#141826` | `#F4EEE6` |
| Body text | `rgba(32,28,40,.64)` | `rgba(244,238,230,.64)` |
| Eyebrow label | `#A2968B` | `#B7A99A` |
| Arch stroke | `rgba(96,64,52,.32)` | `rgba(255,220,200,.24)` |
| Lattice stroke | `rgba(120,80,60,.09)` | `rgba(255,220,200,.07)` |
| Dot (inactive) | `rgba(20,18,30,.16)` | `rgba(255,245,235,.20)` |
| Gear circle / icon | `rgba(20,18,30,.06)` / `.45` | `rgba(255,245,235,.08)` / `.58` |
| Home indicator | `rgba(20,18,30,.30)` | `rgba(255,245,235,.38)` |

## Dark-mode instructions

1. **Swap the background** from cream `#FBF6F0` to warm charcoal `#141210` (a *warm* near-black — avoid pure `#000`, it kills the warmth).
2. **Invert the vector tint**: the arch + lattice go from brown `rgba(96,64,52,…)` to ivory `rgba(255,220,200,…)`; nudge the arch opacity up slightly (0.6 → 0.7) so it stays visible on the dark ground.
3. **Keep the coral gradient exactly the same** — CTA, active dot and the heart logo don't change. That single warm accent is what ties the two modes together.
4. **Text**: headline → `#F4EEE6`, body → 64% of that. Never full white.
5. **Warm glow** stays a soft radial at the top; it reads as a subtle dawn light in both modes.

Typography: headline **Plus Jakarta Sans 800** (−0.02em tracking), eyebrow **Plus Jakarta Sans 600** uppercase +0.28em, body **Plus Jakarta Sans 400**.
