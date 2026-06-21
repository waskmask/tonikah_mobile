# UI conventions (React-Native-APP)

Design polish only — no navigation or business-logic changes in this doc.

## Styling

| Use | When |
|-----|------|
| **NativeWind `className`** | Layout, spacing, simple surfaces, auth/onboarding screens |
| **`StyleSheet` + tokens** | Reanimated UI, explore deck/action bar, chat, precise pixel control |
| **`useColors()`** | Any theme-dependent color — prefer over inline hex |
| **`uiTokens`** | `space()`, `radius()`, `BadgeSize`, `HeaderTokens` |

Do not start new big-bang migrations. Adopt tokens when touching a file.

## Headers

| Pattern | Component | Screens |
|---------|-----------|---------|
| Immersive | Custom overlay | Explore, Messages |
| Root tab | `TabTitleBar` | Saved, Activities, Profile |
| Brand + menu | `AppTopBar` | (optional; hidden stack routes may use back bar) |
| Stack / form | `AppBackTitleBar` | Settings, edit profile, hidden tab routes |

## Buttons

Keep `Button` and `GradientButton` separate until a dedicated refactor. Use `GradientButton` for primary CTAs; `Button` for secondary actions.

## Typography

iOS uses SF Pro (system). Android uses bundled Inter/Manrope. Arabic uses Noto Sans Arabic. **Intentional** — do not bundle heading fonts on iOS without a product decision.

## Motion & haptics

- `useReducedMotion()` — skip or shorten Reanimated springs when enabled.
- `useHaptics().lightImpact()` — tab switches and primary taps (not every `Pressable`).

## Profile setup

Always **10 steps**. Polish `ProgressBar`, `ProfileSetupHeader`, and spacing only — never merge steps or change `getIncompleteStep` routing.
