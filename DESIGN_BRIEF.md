# UNaFIED — Frontend Design Brief

A self-contained brief for building or extending the UNaFIED interface. Everything here is
already implemented and verified in this repo; treat it as the specification, not a proposal.

---

## 1. The brief, in the owner's words

> "Super minimal, very straightforward. Minimal, clean, smooth. Glass morphism. The user should
> have the best experience on the app."

Every decision below is in service of those five words. When a choice is open, pick the one
that is quieter. Minimal here means *restrained*, not sparse — the interface should feel
inevitable, not empty.

---

## 2. What the product is

A real-time chat where an **ambient agent listens passively** and converts commitments made in
passing into actions. Someone types *"let's meet at 5pm"* and, without anyone addressing the
agent, it becomes a 4:45pm reminder.

This premise dictates the entire visual language. The agent is not a chatbot the user summons.
It is a **presence in the room**. So:

- The agent never competes with the humans for attention.
- The agent's voice is visually distinct — a different *kind* of thing, not just a different colour.
- Nothing may interrupt, notify, or demand attention. Everything is ambient.

The design must make a user feel *observed helpfully*, never *watched*. An agent that writes to
a calendar from a group conversation is the highest-stakes surface in the product, so anything
the agent proposes is framed as a **proposal** the user confirms — never as a completed action.

---

## 3. The one semantic rule

This is the spine of the system. Enforce it everywhere.

| | Humans | The agent |
| :--- | :--- | :--- |
| Surfaces | neutral glass — `pane-*` / `frost-*` | warm presence — `bg-presence-dim`, `border-presence-edge` |
| Text | `ink-bright` (most contrast) | `ink` (one tier down) |
| Accent | none | `presence` amber `#E0A868` |
| Form | right-aligned bubbles | left-aligned annotation, **no bubble** |

**Presence amber is reserved for exactly four things:**

1. The agent's own voice (kicker, left rule, listening indicator)
2. Actions the agent proposes
3. Confirmed states
4. Focus rings on user-initiated focus (composing, sending)

Nothing else may use it. Not navigation, not errors, not hover states, not a human send button.
When in doubt, use neutral ink. Violating this rule is the single most common way a build drifts
away from the intended feel.

---

## 4. Design tokens

All tokens live in `src/index.css` inside `@theme`. **Never hardcode a colour.** Every value
below is already defined — read the file rather than trusting this document.

### Surfaces — one hue, lightness only

```css
--color-void:  #06070B;        /* the canvas */
--color-pane-1: #0A0C12;       /* rail / list */
--color-pane-2: #0F121A;
--color-pane-3: #151926;
--color-pane-4: #1C2130;
```

Never give a sidebar a different background colour from the canvas. That fragments the space
into "sidebar world" and "content world." Separate panes with translucency and hairlines only.

### Glass fills

```css
--color-frost-1: rgba(255,255,255,0.048);
--color-frost-2: rgba(255,255,255,0.072);
--color-frost-3: rgba(255,255,255,0.105);
```

### Edges

```css
--color-edge-hairline: rgba(255,255,255,0.075);
--color-edge-soft:     rgba(255,255,255,0.115);
--color-edge-strong:   rgba(255,255,255,0.190);
```

### Ink — four tiers, all WCAG AA verified

| Token | Alpha | Contrast on void | Use |
| :--- | :--- | :--- | :--- |
| `ink-bright` | 1.00 | 17.68:1 | human message text, titles |
| `ink` | 0.74 | 8.71:1 | agent body, secondary |
| `ink-soft` | 0.58 | 6.19:1 | labels, supporting copy |
| `ink-quiet` | 0.50 | 4.82:1 | metadata, timestamps |
| `mark` | 0.28 | — | **non-text only** — dots, decorative rules |

`mark` is not for text. The two low-alpha tiers previously failed AA at 4.23:1 and 2.07:1 while
carrying every error message, empty state, and form label in the app. Do not lower them.

### Presence

```css
--color-presence:       #E0A868;   /* 9.5:1 */
--color-presence-bright: #F2C692;
--color-presence-dim:    rgba(224,168,104,0.13);
--color-presence-edge:   rgba(224,168,104,0.34);
--color-presence-glow:   rgba(224,168,104,0.22);
```

### Type

Self-hosted variable fonts via `@fontsource-variable/inter` and
`@fontsource-variable/jetbrains-mono`, imported in `src/main.tsx`.

```css
text-micro  11px   text-md   15px   text-xl    20px
text-meta   12px   text-lg   17px   text-2xl   24px
text-sm     13px
text-base   14px
```

Use these named sizes. **Never `text-[13px]`.** Arbitrary sizes are how a scale quietly stops
being a scale. Hierarchy is carried by **weight and colour** more than size — a single 14px
tier holding three levels through weight and opacity reads cleaner than three near-identical sizes.

### Radius, blur, easing

```css
radius:  xs 6 · sm 8 · md 10 · lg 14 · xl 18 · pill 999
blur:    sm 8 · md 16 · lg 28 · xl 44 · 2xl 64
easing:  ease-glass cubic-bezier(0.23, 1, 0.32, 1)    /* entering, interactive */
         ease-drift cubic-bezier(0.77, 0, 0.175, 1)  /* on-screen movement */
```

**Concentric radius:** nested rounded elements need `outerRadius = innerRadius + padding`. Equal
radius on parent and child is the most common reason a UI looks subtly wrong.

### The glass recipe

Depth strategy is **layered glass and only that.** No flat opaque cards. No drop shadows on
anything that isn't glass. One recipe, used everywhere:

```css
backdrop-filter: blur(var(--blur-2xl)) saturate(165%);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.10),      /* the specular top edge — this is what sells it */
  inset 0 -1px 0 rgba(255,255,255,0.03),
  0 18px 44px -22px rgba(0,0,0,0.85);
```

Glass is only visible if there is luminance behind it to refract. The `body` carries four large
radial gradients (cool blue upper-left, violet upper-right, warm amber lower-right, blue
centre) precisely so panes have something to blur. Do not flatten the background.

Shared classes `.glass-1`, `.glass-2`, `.glass-3`, `.hairline`, `.tnum`, `.btn` (+ variants),
`.field`, and `.presence-mark` are all in `index.css`. Use them instead of re-declaring.

---

## 5. Layout

```
┌──────────────────────────────────────────────────────────┐
│  top bar — h-14 (56px)                                   │  wordmark · agent status · account · logout
├───────────────┬──────────────────────────────────────────┤
│               │  thread header — 56px                    │  conversation title · participants
│  conversation │──────────────────────────────────────────│
│  list         │  ░ scroll fades under the header ░       │
│  w-80 (320px) │                                          │
│               │        messages — max-w-[720px],          │  centred measure
│               │        mx-auto, bottom gravity            │
│               │                                          │
│               │  ░ scroll fade above the composer ░      │
│               │  composer — max-w-[720px] mx-auto        │
└───────────────┴──────────────────────────────────────────┘
```

- **The empty vertical rail is gone.** It was a 240px column holding a wordmark and one nav item.
  A full-width top bar is quieter and gives the thread a real header plus ~200px more width.
- **Everything in the thread shares one 720px measure** — header, messages, and composer. They
  must form a single column. A 720px measure is roughly a 90-character line; longer is unreadable.
- **Bottom gravity:** short threads rest just above the composer (`min-h-full` + `mt-auto` on the
  message list) rather than stranding a void beneath them.
- **Scroll fades** top and bottom, so content dissolves under the header and into the composer
  instead of being sliced by a hard edge.
- **Responsive:** below `sm` the conversation list is full-width and hidden when a conversation is
  open, and the thread header gains a back button. Both are required — a fixed 320px list on a
  390px viewport leaves 70px of thread.

---

## 6. Component specifications

**Human message** — right-aligned neutral glass bubble, `rounded-lg` with `rounded-tr-md` so one
corner tightens toward the sender, max ~78% width, `text-base ink-bright`. Humans are what the
user came to read, so they get the most contrast.

**Agent message** — **not a bubble.** No fill, no bubble chrome. A `presence-mark` warm left
rule, an `UNaFIED` kicker at `text-micro` in presence amber, body text at `text-base ink`. It
should read as an annotation on the conversation, not a participant competing for attention.

**Rhythm** — same-sender messages sit 4px apart; a change of sender gets 20px. Monotone spacing
is the sound of nobody deciding. Drop repeated avatars and labels inside a group.

**Agent proposal card** — presence-tinted glass, `bg-presence-dim`, `border-presence-edge`, warm
left rule. Hierarchy is the whole game here:
- kicker `AGENT PROPOSAL` — `text-micro text-presence`
- the proposed action — `text-lg font-semibold ink-bright` ← **the focal element**
- the tool name — `.tnum`, mono, `text-micro ink-quiet` ← an implementation detail, demote it

Approve is `.btn.btn-primary` (40px). Dismiss is a 40px icon-only `.btn.btn-quiet` with an
`aria-label`. The destructive path must never be visually dominant.

**Composer** — a `glass-2 rounded-lg` pane inside a padded container, so it never touches the
viewport edge. Textarea grows via `field-sizing: content` with a 120px cap. The send button is
neutral glass, becoming `bg-frost-3` when armed — **not** presence, because a human sending is a
human action. Enter sends, Shift+Enter newlines.

---

## 7. Non-negotiable technical constraints

These are not style preferences. Each one caused a visible bug.

**1. Layer order — the reset and all shared classes MUST be inside `@layer`.**

```css
@layer base { *, *::before, *::after { margin: 0; padding: 0; } }
@layer components { .btn { ... } .glass-1 { ... } }
```

Unlayered CSS beats *every* `@layer` in the cascade, regardless of specificity. An unlayered
reset silently annihilates every `p-*`/`m-*` utility in the app. An unlayered `.btn` overrides
`display: grid` and `justify-content`. This is how conversation titles ended up centred and the
composer ended up jammed against the viewport edge.

**2. Tailwind v4 important modifier is TRAILING.**

```css
rounded-md!     /* v4 — correct */
!rounded-md     /* v3 — generates NOTHING, fails silently */
```

**3. Never `scrollIntoView` for a chat list.** It walks up and scrolls *every* scrollable
ancestor, and `overflow: hidden` elements are programmatically scrollable. It will scroll your
whole app shell out of view. Scroll the one element directly:

```js
scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
```

**4. Never `@import url(...)` a webfont in the Tailwind entry CSS.** The Vite plugin drops it.
Self-host with `@fontsource-variable/*` and import in `main.tsx`.

**5. Do not stack layout utilities on an element that also carries `.btn`** unless you have
verified the result in a browser.

---

## 8. Accessibility — required, not optional

- Every interactive element: `hover`, `active`, `focus-visible`, `disabled`.
- Every data surface: `loading`, `empty`, `error`. Missing states are the fastest tell of an
  unfinished interface.
- Hit targets ≥ 40px. Extend small controls with padding or a pseudo-element; never let two hit
  areas overlap.
- Real semantic elements — `<button>`, `<a>`, `<label>`, `<nav>`, `<main>`. Never a `div onClick`.
- Icon-only controls need `aria-label`. Error text needs `aria-describedby`; invalid fields need
  `aria-invalid` **and** a visual style for it.
- Timestamps revealed on hover must stay exposed to assistive tech — use opacity, never
  `display: none`, and keep them out of the tab order.
- `aria-live` on async state transitions (running → result / error).
- **Reduced motion:** the global CSS media query does **not** cover framer-motion, which animates
  via the Web Animations API. Guard every JS animation with `useReducedMotion()`.
- Animate only `transform` and `opacity`. Never `transition: all`. Durations 120–200ms
  interactive. Press feedback `active:scale-[0.97]`.

---

## 9. Verify by looking at it

**This is the part that matters most, and the part most often skipped.**

A redesign can pass `tsc`, pass `eslint`, pass `vite build`, and be unusable. Typechecking says
nothing about whether glass looks like glass. Every previous round of changes in this repo was
"verified" by the typechecker alone and shipped broken — fonts silently missing, spacing
utilities silently dead, the thread header scrolled out of existence.

So: **render it and look at it** before calling any work done.

- Playwright is installed. Screenshot at **1440×900** and **390×844**.
- Exercise real states: signed out, empty list, empty thread, populated thread, proposal card,
  loading, error. A screenshot of one happy path is not verification.
- When something looks wrong, **measure it in the browser** before theorising —
  `getBoundingClientRect()` and computed styles settle in one run what three rounds of guessing
  will not. Several "bugs" in this build turned out to be screenshot-timing artifacts, and one
  real bug looked like a layout mystery until the ancestor chain was dumped.
- A class name in your source is not evidence that it produces CSS. To check, build and grep
  `dist/assets/*.css`. Use `grep -a` (the output is long-lined) and grep the raw value
  (`400px`), not the class syntax (`max-w-\[400px\]`).

Definition of done: build green, lint at or below its pre-existing baseline, `tsc --noEmit`
silent, and **screenshots reviewed at both widths**.

---

## 10. Known open items

- The amber `Sign In` button is the loudest element on the auth screen. Defensible for a primary
  CTA; pull it back if a quieter treatment is wanted.
- There is no `Settings` view. The nav item was removed rather than shipped permanently disabled.
- The frontend talks to the backend over HTTP streaming, **not** the WebSocket. There is no
  live multi-user delivery yet — the WebSocket server exists but no client connects to it.
- `MessageThread` has a real bug: a failed detail fetch leaves `loadState` as `"error"` and the
  post-send refetch never restores `"ready"`.
- Backend `/api/v1/me` and `/api/v1/signup` serialise `User` directly, so **bcrypt password
  hashes reach the client.** Needs a `UserRead` response model.
