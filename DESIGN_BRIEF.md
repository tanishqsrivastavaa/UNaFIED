# UNaFIED — Frontend Design Brief ("Night field")

The specification for the UNaFIED interface. Everything here is implemented in `frontend/src`.
Read the code before trusting this document; where they disagree, the code wins and this file
is out of date.

The previous interface ("Warm dusk": blush agent, parchment, magenta-to-amber gradient,
condensed display type, DM Mono, glass veils) is preserved in commit `f908358`. The one before
that (cool blue glass, amber accent) is in `7968749`.

---

## 1. The brief

> The current UI is too loud. Smooth, minimal, no distractions, one simple flow.

It is drawn from a reference board of dark brand pieces (void, aura, Soan, area.lab, MindShift,
a green light crest, a halftone field). What they share, and what this system keeps:

- **Near-black grounds** with off-white type. Charcoal, never pure grey.
- **One soft, desaturated light per piece** (a muted green, a violet haze, a navy silk). Never a
  saturated gradient, never two glows competing.
- **Texture instead of decoration:** fine grain, or a halftone dot screen that shows only
  where the light is.
- **Clean neo-grotesk wordmarks** with tight tracking and nothing around them.
- **Big negative space, very little on screen at once.** Small secondary text sits in corners.

The feeling is calm, cinematic and premium. Every rule below serves that: if something on
screen isn't helping the person read or reply right now, it is quieter, smaller or hidden
until asked for.

## 2. The product premise

UNaFIED is a chat where an AI assistant sits in the conversation. Two people can talk in real
time. The assistant replies in solo chats, and in shared chats only when someone writes
`@unafied`. For anything it can't undo it **proposes** an action and waits for a yes.

So the assistant is a *presence in the room*, not a participant competing for attention. That
premise drives the one rule.

## 3. The one rule

**Sage belongs to the assistant.** It is used for exactly these things:

1. The presence dot (its mark, the logo, and its "thinking" signal)
2. The assistant's name line (`UNaFIED`)
3. Proposals and their confirmations ("Needs your approval", "Approved", "Done")

Nothing a person does is sage. Human actions are **bone** (off-white): the send button,
"Sign in", "Approve" (approving is something the person does). Other people's presence is a
bone dot, never sage. Errors are neutral ink with an icon, never sage and never red.

| | People | The assistant |
| :--- | :--- | :--- |
| Surface | flat fill; yours `fill-3` on the right, theirs `fill-1` + hairline on the left | none, left-aligned |
| Type | Instrument Sans, `text-body`, full `ink` | Instrument Sans, `text-body`, `ink-2`, 1.7 leading |
| Mark | their name above a run (others only) | sage dot + `UNaFIED` in sage |

## 4. Tokens (`src/index.css`, `@theme`)

### Palette

| Token | Value | Role |
| :--- | :--- | :--- |
| `void` | `#0B0B0C` | canvas |
| `coal` | `#161618` | the only opaque raised surface: popovers (the invite panel) |
| `bone` | `#ECEBE7` | ink and human primary actions |
| `sage` | `#B3C0A5` | the assistant (see §3); 10.3:1 on `void` |

The backdrop light is sage darkened to `rgb(124 140 106)` at ≤ 0.34 alpha. At its brightest
point on screen it renders about `#23251F`.

### Ink (bone at four strengths)

| Token | Alpha | Use |
| :--- | :--- | :--- |
| `ink` | 1.00 | people's messages, titles, the wordmark |
| `ink-2` | 0.80 | assistant text, active controls |
| `ink-3` | 0.66 | list titles at rest, names, labels, supporting copy |
| `ink-4` | 0.60 | timestamps, placeholders, the account email, hints |

Every tier passes WCAG AA (≥ 4.5:1) on the brightest surface it can land on. That surface is
the mobile composer over the backdrop light **at the far end of its drift**, where `ink-4`
measures 5.0:1. **Do not lower these alphas.** At 0.56, `ink-4` measured 4.37:1 there and failed.
For the same reason the composer's focus state changes only its border, never its fill.

### Fills and lines

`fill-1..3` are white at 3 / 5 / 8% and `line-1..3` are white at 6 / 10 / 18%. Surfaces are
flat: no gradients, no inner highlights, no backdrop blur. Borders are hairlines and appear
only where an edge carries meaning (an input, someone else's bubble, a proposal).

`sage-wash` (6%), `sage-line` (20%) and `sage-glow` (40%) exist only for proposals and the
presence dot's halo.

### Type

**One face: Instrument Sans (variable), self-hosted via `@fontsource-variable`.** No display
face and no mono. Weights are 400 for reading, 500 for titles, names and buttons, and 600 for
the wordmark only. Never uppercase, never letter-spaced labels.

The named scale is `micro 11 · meta 12 · sm 13 · base 14 · body 15 · lg 17 · xl 22`. Use the
names, not `text-[13px]`. `lib/cn.ts` teaches tailwind-merge the custom names (see §8.9).

### Motion

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` for everything entering.
- `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for breathing and drifting.
- Interactive transitions take 150–300ms. Entrances take 250–500ms and move at most 8px.
  Opacity first. Nothing springs, bounces or scales in.

## 5. Signature moments (all quiet)

**The presence dot** (`Presence.tsx`). A 6px sage point with a soft halo. It is the logo, it
sits before the assistant's name, and it pulses at the end of the assistant's line while it
thinks or writes (and on the splash and "Opening conversation…" while something loads). At
rest it is still. It breathes slowly in two places only: the empty thread and the lobby, where
it is the only thing on screen.

**Words surfacing** (`Materialize`, `.word-in`). Assistant replies arrive word by word, each
fading in over 420ms in its resting colour. The stagger compresses (≤ ~0.7s in total), so long
replies never lag the stream. History never replays this. Only rows that arrive during the
visit animate.

**The proposal** (`Ticket.tsx`). A sage-edged card. Above the hairline is what will happen
(label, then parameters as a quiet two-column list). Below it the person decides: "Not now"
or "Approve".

**The room** (`Backdrop.tsx`). `void`, one sage light rising from the lower left, a 5px
halftone dot screen masked to the light, and grain over everything to stop banding. The light
drifts on a 90s cycle, too slowly to notice while reading. It sits under the rail's empty lower
half and the auth tagline, so text columns stay on the dark.

## 6. Layout

```
┌───────────────────────────────────────────────────────────────┐
│ • UNaFIED        Weekend in Lisbon                    [+👤]   │  header: no surface;
│                  with theo •                                  │  status text only when
│ + New conversation                                            │  offline/connecting
│ ▓ Lisbon                          ╭────────────────────╮      │
│   Reading list                    │ your message       │      │
│   Dinner friday    theo           ╰────────────────────╯      │
│                    ╭───────────────╮                          │  one 680px column
│                    │ their message │                          │  (header, thread and
│                    ╰───────────────╯                          │   composer share it)
│                    • UNaFIED                                  │
│  ░░ light ░░       assistant text, no surface                 │
│ ░░░░░░░░░░░        theo is typing…                            │
│ maya@…     ⇥       ╭──────────────────────────────╮           │
│ ░░░░░░░░░░░░░░░    │ Write a message…          ↑  │           │
└───────────────────────────────────────────────────────────────┘
```

- **One flow:** list, thread, composer. The rail is not a card: it sits directly on the room,
  272px wide, with no border.
- **The rail** shows the wordmark, "New conversation", titles and the account. No heading
  label, no count. A row's time and its delete control appear on hover or keyboard focus. The
  `Ctrl K` chip appears only while "New conversation" is hovered or focused.
- **The header** shows the title and, in shared chats, "with" and the other people's names.
  Someone who has the conversation open gets a bone dot. Invite is a quiet icon button. The
  connection status is announced always but shown only when it is not fine.
- **Secondary information waits:** message times appear on hover. There is no message count
  and no keyboard legend at rest. A faint `/` chip sits in the composer only while it is empty
  and unfocused.
- **Bottom gravity:** short threads rest just above the composer. Empty, loading and error
  states sit in the vertical centre.
- The scroller extends under the header and composer. Its edges dissolve with a **CSS mask**
  (`.thread-fade`), never an overlay: fully clear under the header, and at the bottom text
  dissolves just above the composer (the mask reads `--composer-h`, which `Thread` publishes).
  That is why the composer needs no blur.
- Below `md`, the list is full-screen. Opening a conversation hides it, and the header gains a
  back button.

### What was removed, and stays removed

The giant display headlines ("Say it once.", "Say something.", "Where were we?" are now
one-line `text-lg` titles), uppercase mono eyebrows ("LISTENING", "CONVERSATIONS"),
the conversation count, the message count, the keyboard legend under the composer, the moving
magenta and amber glows, glass blur and inner highlights, blush, DM Mono and the condensed
display face. If a new feature needs a label, it is sentence case in `ink-3`, or it isn't shown.

## 7. Behaviour

- **⌘K / Ctrl+K** starts a conversation from anywhere in the chat. **/** focuses the composer.
  **Enter** sends, **Shift+Enter** adds a new line (IME composition is respected). The composer
  describes these to screen readers through `aria-describedby`.
- A **new conversation opens instantly**: it is known to be empty (`freshConversations`), so
  the thread doesn't wait on a fetch.
- **Delete asks twice.** The first click turns the icon into "Delete" and the confirmation
  expires after 3s. A failed delete leaves the row and says so at the foot of the rail.
- **Failed sends are honest.** After a stream error the thread asks the server what it kept.
  If the message wasn't saved, it goes back into the composer ("…it's back in the box"). If it
  was saved but got no reply, the thread says so.
- **Presence and typing:** who has the conversation open is shown in the header next to their
  name. Typing is the one line under the thread ("theo is typing…"). That line is always
  mounted, so it doesn't move the thread when it appears. Typing entries expire after 6s,
  because the server never clears them.
- **While the assistant is replying,** the composer accepts typing but not sending. The line
  under it says "You can send once UNaFIED has replied."
- **Stream text**: the agent is prompted to answer in JSON, and the stream forwards that raw
  text. `lib/reply.ts` extracts the readable `chat_message` from a partial document so users
  never see braces. Remove it once the backend streams plain text.
- **Timestamps**: the API sends zone-less UTC. `lib/time.ts` parses them as UTC.

## 8. Non-negotiable technical constraints

Each of these caused a visible bug in this repo.

1. **Shared CSS lives in `@layer`.** Unlayered CSS beats every layer regardless of specificity.
   (The reduced-motion overrides are deliberately unlayered, so they win.)
2. **No background on `body`.** With a background on `html`, the body's own background paints
   *above* the fixed `-z-10` backdrop and hides it.
3. **Tailwind v4's important modifier is trailing**: `rounded-md!`, not `!rounded-md`.
4. **Never `scrollIntoView` in the thread.** It scrolls every scrollable ancestor. Scroll the
   scroller element directly.
5. **Keys in the thread are positional** so the streaming row and its settled copy are the same
   element. Changing to id keys makes every reply replay its entrance after the refetch.
6. **Auto-scroll follows `messages`, not `rows.length`.** The refetch can attach a proposal
   without adding a row. Keying on the length left new proposals hidden under the composer.
7. **Framer Motion ignores the CSS reduced-motion query.** `MotionConfig reducedMotion="user"` in
   `App.tsx` covers it globally. CSS animations are covered in `index.css`.
8. **Vite's dev watcher can lose a file** that an editor saves via atomic rename. If an edit
   doesn't show up, check the served module (`curl localhost:5173/src/…`) before debugging the
   code, then restart the dev server.
9. **`cn()` must know the custom text sizes.** Stock tailwind-merge reads `text-body`,
   `text-meta` and `text-micro` as colours, so `cn("text-body text-ink")` silently dropped the
   size (every human bubble rendered at 14px instead of 15px). `lib/cn.ts` extends it. Add any
   new `--text-*` name there too.
10. **The thread's bottom mask is what hides text behind the composer.** The composer has no
    blur. If you change the composer's height logic or the mask, scroll a long thread up and
    look at the composer before shipping.

## 9. Accessibility

- Every control has hover, active, focus-visible and disabled states. Focus rings are 2px bone
  at 70%, offset 2px. Inputs show focus by brightening their border. The composer is the one
  exception to a ring, because it is focused most of the time and a permanent ring would be
  the loudest thing on screen.
- Hit targets are ≥ 40px. Icon-only buttons have `aria-label` (and a `title` where a tooltip helps).
- The thread is `role="log"`. Status changes (connection, thinking, typing, proposal running
  or done) are announced via `role="status"`. The connection status stays in the DOM as
  `sr-only` while it is fine.
- Hover-only information stays in the DOM (opacity, never `display: none`), so screen readers
  still get message times. A rail row's time and delete control are also revealed when the row
  has keyboard focus (`group-focus-within`). On touch devices the delete control is always
  visible, in `ink-4` at full opacity (at 60% opacity it fell under 3:1), and hover times are
  hidden (`pointer-coarse:`).
- Reduced motion: words appear immediately, dots hold still and the light stops drifting.

## 10. Verify by looking

Typechecking says nothing about whether the room is calm. Before calling UI work done:

- Screenshot at **1440×900** and **390×844** with Playwright against a **fully mocked backend**:
  `page.route` for `http://localhost:8000/api/v1/**` and `page.routeWebSocket` for the chat
  socket (Playwright ≥ 1.48). Never let a request through: the real backend shares a remote
  database. Set `access_token`/`refresh_token` in `localStorage` before navigation.
- Cover these states: signed out, sign-up error, lobby, empty thread, populated shared thread
  (yours, theirs with a name, the assistant), thinking, streaming, typing, invite with an
  error, proposal, proposal approved, list error, thread error, failed delete, mobile list,
  mobile thread.
- **Measure contrast from pixels, not from tokens:** composite each text element's computed
  colour over the median pixel under its box in the screenshot. Do it once more with the
  backdrop pinned at the end of its drift (`transform: translate3d(6vw,-4vh,0) scale(1.08)`),
  which is the worst case.
- When something looks wrong, measure it (`getBoundingClientRect`, `getComputedStyle`) before
  theorising.
- Confirm tokens reach the build by grepping `dist/assets/*.css` for the raw value. The minifier
  rewrites `rgb(… / 0.6)` as `#ecebe799`.
- In a git worktree with `node_modules` symlinked from the main checkout, Vite answers 403 for
  the font files (they resolve outside the worktree) and screenshots silently fall back to
  system fonts. Serve with `server.fs.allow` including the real `node_modules` path.

## 11. Known backend issues

- **The tools router is not mounted.** `backend/main.py` comments out
  `app.include_router(tools.router, …)`, so "Approve" on a proposal gets a 404 and the card
  says "That didn't go through." (found during the "Night field" restyle).
- The following were found during the "Warm dusk" build and were not re-checked in this restyle:
  - **Every `DELETE /chats/{id}` returned 500**, including for conversations with no messages.
    The models declare no cascade on participant, message or embedding foreign keys.
  - **The stream forwards raw JSON** (see §7). The frontend compensates; the backend should
    stream plain text.
  - `/signup` returned `hashed_password` to the client.
