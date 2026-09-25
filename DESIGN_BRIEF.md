# UNaFIED — Frontend Design Brief ("Warm dusk")

The specification for the UNaFIED interface. Everything here is implemented in `frontend/src`.
Read the code before trusting this document; where they disagree, the code wins and this file
is out of date.

The previous interface (cool blue glass, amber accent) is preserved in commit `7968749`.

---

## 1. The brief

> Glassmorphism, minimalism, a dark gradient background. Super smooth, very smooth animations.
> Soothing and easy to use.

It is drawn from two references:

- **Buena Dev** (buena.com/dev): a terminal as a website. It uses warm stone neutrals and lets
  type do all the work, with small uppercase mono labels and key chips like `[⌃+L] CLEAR`. Each
  character fades in with a staggered delay on an expo-out curve, and a block cursor waits at
  the prompt. The feeling is quiet competence.
- **Crush** (crush.enterprises): a studio with one bold condensed display face, three colors,
  and its process drawn as a receipt with dashed tear lines. The feeling is friendly, human and
  confident.

What they share, and what this system keeps: **very few colors, warm neutrals, type carrying
the personality, and motion that is opacity-first and never bouncy.** Neither site uses glass,
gradients or rounded corners. Those come from our brief. The job is adding them without losing
the restraint.

## 2. The product premise

UNaFIED is a chat where an AI agent sits in the conversation. It answers, it remembers across
conversations (RAG), and for anything it can't undo it **proposes** an action and waits for a
yes. The long-term direction (`PLAN.md`) is a passive listener that turns commitments into
reminders.

So the agent is a *presence in the room*, not a participant competing for attention. That
premise drives every rule below.

## 3. The one rule

**Blush belongs to the agent.** It is used for exactly these things:

1. The agent's cursor (its mark, logo and "thinking" signal)
2. The agent's name line (`UNaFIED`)
3. Proposals (tickets) and their confirmations ("Approved", "Done")
4. The ink-drying moment when agent text arrives

Human actions are **parchment**: the send button, "Sign in", "Approve" (approving is something
the person does). Errors are neutral ink with an icon, never blush and never red.

| | Humans | The agent |
| :--- | :--- | :--- |
| Surface | `.veil` glass bubble, right-aligned | no bubble, left-aligned |
| Type | Instrument Sans, `text-body`, full `ink` | DM Mono, `text-base`, `ink-2` |
| Mark | none | blush block cursor + `UNaFIED` |

## 4. Tokens (`src/index.css`, `@theme`)

### Palette

| Token | Value | Role |
| :--- | :--- | :--- |
| `dusk` | `#0C0A09` | canvas |
| `plum` | `#2B1522` | upper-left glow |
| `umber` | `#2A1A0F` | lower-right glow |
| `blush` | `#F2C3BC` | the agent (see §3) |
| `parchment` | `#F5F1EC` | ink and human primary actions |

### Ink (parchment at four strengths)

| Token | Alpha | Use |
| :--- | :--- | :--- |
| `ink` | 1.00 | human messages, titles |
| `ink-2` | 0.80 | agent text, secondary |
| `ink-3` | 0.68 | supporting copy |
| `ink-4` | 0.61 | timestamps, labels, placeholders |
| `mark` | 0.22 | **non-text only** |

Every tier passes WCAG AA (≥ 4.5:1) on the brightest surface it can land on, which is glass over
the plum glow (`ink-4` measures 4.9:1 there). **Do not lower these alphas.** At 0.50, `ink-4`
failed at 3.8:1.

### Surfaces

- `.glass`: real backdrop blur (32px, saturate 160%). Use it only for a few large surfaces:
  the rail, the composer, the auth card.
- `.veil`: the same look without the blur, for small repeated surfaces (bubbles, avatar).
  Blur on dozens of bubbles above an animated background is a GPU cost with no visible payoff.
- Warm-tinted fills `veil-1..3` and edges `line-1..3`. Never flat opaque cards.

### Type

| Role | Face | Where |
| :--- | :--- | :--- |
| Display | Sofia Sans Extra Condensed 800, uppercase | **only** the sign-in headline and empty states |
| Body / UI | Instrument Sans (variable) | people, interface |
| Voice / utility | DM Mono 400/500 | the agent, `.eyebrow` labels, `.kbd` chips, times |

Fonts are self-hosted via `@fontsource*` and imported in `main.tsx`. The named scale is
`micro 11 · meta 12 · sm 13 · base 14 · body 15 · lg 17 · xl 22`. Use the names, not `text-[13px]`.

### Motion

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for everything entering (the same curve Buena uses).
- `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for breathing and drifting.
- Interactive transitions take 160–300ms. Entrances take 450–900ms. Nothing springs or bounces.

## 5. Signature moments

**The cursor.** A blush block from a terminal prompt. It is the logo, it breathes after
"SAY IT ONCE." on sign-in, it sits before the agent's name, and it pulses at the end of the
agent's line while it thinks. At large sizes use `mode="glow"`: the block stays solid and a halo
behind it breathes. Fading the pale block itself turns it grey.

**Ink drying** (`Materialize`, `.ink-in`). Agent replies arrive word by word, each surfacing
in blush, holding for a beat, then cooling to `ink-2`. Measured timeline: a word surfaces by
~250ms, starts cooling at ~750ms and settles by ~1.5s. A whole reply settles in about 2s,
because the per-word delay compresses so long replies stay under a second of stagger.
History never replays this. Only rows that arrive during the visit animate.

**The ticket** (`Ticket.tsx`). A proposal is a glass ticket with notches punched at a dashed
tear line. Above the line is what will happen (label, parameters in mono). The stub is where
the person decides: "Not now" or "Approve".

**The dusk** (`Backdrop.tsx`). Three soft glows drift on 52s, 64s and 78s cycles, so the room
never visibly loops. There is also a vignette and a grain layer, which stops dark gradients from
banding.

## 6. Layout

```
┌───────────────────────────────────────────────────────────────┐
│ ╭────────────╮     Weekend in Lisbon            ▮ LISTENING   │
│ │ ▮ UNaFIED  │     5 messages                                 │  header: no surface,
│ │ + New  ⌘K  │                     ╭──────────────────────╮   │  content fades under it
│ │ CONVERS…   │                     │ human glass bubble   │   │
│ │ ▓ Lisbon   │                     ╰──────────────────────╯   │
│ │   Numbers  │     ▮ UNaFIED 8:42 PM                          │
│ │            │     agent text in mono, no bubble              │  one 680px column
│ │            │     ┌ ticket ─────────────┐                    │  (header, thread,
│ │ ○ me@…  ⇥  │     ╭──────────────────────────────────╮       │   composer share it)
│ ╰────────────╯     │ Write a message…              ↑  │       │  composer floats; text
│                    ╰──────────────────────────────────╯       │  scrolls under the glass
└───────────────────────────────────────────────────────────────┘
```

- The rail is a floating glass panel (296px, radius 28). The thread sits directly on the dusk.
- **Bottom gravity:** short threads rest just above the composer.
- The scroller extends under the header and composer. Its edges fade with a **CSS mask**
  (`.thread-fade`), never an overlay gradient: an overlay needs a solid color to fade into, and
  the background is a moving gradient.
- Below `md`, the list is full-screen. Opening a conversation hides it, and the header gains a
  back button.

## 7. Behaviour

- **⌘K / Ctrl+K** starts a conversation from anywhere in the chat. **/** focuses the composer.
  **Enter** sends, **Shift+Enter** adds a new line (IME composition is respected).
- A **new conversation opens instantly**: it is known to be empty (`freshConversations`), so
  the thread doesn't wait on a fetch.
- **Delete asks twice.** The first click turns the icon into "Delete" and the confirmation
  expires after 3s. A failed delete leaves the row and says so.
- **Failed sends are honest.** After a stream error the thread asks the server what it kept.
  If the message wasn't saved, it goes back into the composer ("…it's back in the box"). If it
  was saved but got no reply, the thread says so.
- **Stream text**: the agent is prompted to answer in JSON, and the stream forwards that raw
  text. `lib/reply.ts` extracts the readable `chat_message` from a partial document so users
  never see braces. Remove it once the backend streams plain text.
- **Timestamps**: the API sends zone-less UTC. `lib/time.ts` parses them as UTC.

## 8. Non-negotiable technical constraints

Each of these caused a visible bug in this repo.

1. **Shared CSS lives in `@layer`.** Unlayered CSS beats every layer regardless of specificity.
   (The reduced-motion overrides are deliberately unlayered, so they win.)
2. **No background on `body`.** With a background on `html`, the body's own background paints
   *above* the fixed `-z-10` backdrop and hides the whole gradient.
3. **Tailwind v4's important modifier is trailing**: `rounded-md!`, not `!rounded-md`.
4. **Never `scrollIntoView` in the thread.** It scrolls every scrollable ancestor. Scroll the
   scroller element directly.
5. **Keys in the thread are positional** so the streaming row and its settled copy are the same
   element. Changing to id keys makes every reply replay its entrance after the refetch.
6. **Auto-scroll follows `messages`, not `rows.length`.** The refetch can attach a proposal
   without adding a row. Keying on the length left new tickets hidden under the composer
   (verified: ticket bottom at 1000px vs composer top at 790px).
7. **Framer Motion ignores the CSS reduced-motion query.** `MotionConfig reducedMotion="user"` in
   `App.tsx` covers it globally. CSS animations are covered in `index.css`.
8. **Vite's dev watcher can lose a file** that an editor saves via atomic rename. If an edit
   doesn't show up, check the served module (`curl localhost:5173/src/…`) before debugging the
   code, then restart the dev server.

## 9. Accessibility

- Every control has hover, active, focus-visible and disabled states. Focus rings are 2px
  parchment at 70%.
- Hit targets are ≥ 40px. Icon-only buttons have `aria-label`.
- The thread is `role="log"`. Status changes (thinking, tool running or done) are announced via
  `role="status"`.
- Hover-only timestamps stay in the DOM (opacity, never `display: none`). On touch devices the
  delete control is always visible and the hover time is hidden (`pointer-coarse:`).
- Reduced motion: text appears immediately, cursors hold still and the background stops drifting.

## 10. Verify by looking

Typechecking says nothing about whether glass looks like glass. Before calling UI work done:

- Screenshot at **1440×900** and **390×844** with Playwright.
- Cover these states: signed out, sign-in error, lobby, empty thread, populated thread, thinking,
  proposal, proposal approved, list error, thread error, failed delete.
- When something looks wrong, measure it (`getBoundingClientRect`, `getComputedStyle`) before
  theorising. Screenshot timestamps are unreliable for animation: headless Chromium renders the
  32px blur in software and lags up to a second. Sample computed styles in-page instead.
- Confirm tokens reach the build by grepping `dist/assets/*.css` for the raw value. The minifier
  rewrites `rgb(… / 0.61)` as `#f5f1ec9c`.

## 11. Known backend issues (found during this build)

- **Every `DELETE /chats/{id}` returns 500**, including for conversations with no messages. The
  models declare no cascade on participant, message or embedding foreign keys. That is the likely
  cause, not yet confirmed against the server log.
- **The agent emits tool calls as text**, e.g. `{"name": "calculator", "arguments": 2450 * 0.18}`.
  The prompt promises four tools, but `chat_agent.py` registers none and uses `output_type=str`.
  The server stores the malformed text verbatim.
- **The stream forwards raw JSON** (see §7). The frontend compensates; the backend should stream
  plain text.
- `/signup` still returns `hashed_password` to the client.
