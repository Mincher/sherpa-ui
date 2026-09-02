# Status override reintroduction

Bring **status** back into the design system as a **terminal override** — the last thing that
recolours a component. Status touches **three things only**: surface, border, content. Everything
else (geometry, spacing, typography, look-tier, active/inactive state) is untouched.

Branch: `sherpa-reforged`. This reverses the earlier removal, but only for this branch.

---

## 1. What status is (the contract)

A **status** is one of: `info · critical · warning · urgent · success`. Applying a status
re-colours, at most:

| Aspect  | Rule |
|---------|------|
| **Surface** | Either **bold** (fully saturated hue) or **subtle** (light tint). The component chooses which. |
| **Border**  | Always **bold** (fully saturated hue). Used mostly with subtle surfaces; with a bold surface the border colour matches the surface. Some components have no border → override is inert. |
| **Content** | Always **bold** (fully saturated hue). Text + icons. Must **contrast** the surface it sits on (dark hue on a subtle surface, light hue on a bold surface). |

Two more rules from the brief:
- **Border ≈ Content.** Within one status they are the same bold hue (critical → both strong red).
- **Escape hatch.** Any single element may **ignore** the status override for surface, border, or
  content (edge cases). This is a per-element opt-out, not a global switch.

Status is **passthrough by default** — no status set = neutral, resolves to the component's normal
tokens.

---

## 2. Why status sits at the END of the chain

Override chain (reforged — **Color Sets removed** from Figma for now):

```
component  →  Status  →  Control / Container  →  Style (Sherpa)  →  Core  →  Primitives
             ▲ terminal override
```

`Core` sits between Style (Sherpa) and Primitives: it is the semantic-alias tier (the codebase's
`--core-*`), where each colour aliases a raw Primitive — and now also carries the alpha-as-mode
ladder (§3a). The status ramps pass through it: `Style(Sherpa) status/color N → Core color/<hue>/<step>
→ Primitives`.

Status is now the single override tier above Control/Container. (When Color Sets returns it slots
back in *below* Status — status still wins — but it is out of scope here.)

Status **wins over** look-tier (primary/secondary/cta/tertiary). That is correct: a critical thing
must read as critical no matter which tier the control is. So status is the **outermost** override —
exactly where the brief wants it. (It will also win over Color Sets when that returns.)

**One carve-out: `inactive` beats status.** A disabled control looks disabled even when it carries a
status. Because `inactive` is a *state mode* one tier in (Container/Control), and status only
re-values surface/border/content, an inactive surface already wins — no special handling needed, but
we assert it as a rule and verify it.

---

## 3. The colour source — status ramps (already present)

Each status has a 6–7 step ramp already in `tokens.css`, light + dark:
`--sherpa-status-<hue>-color-1 … color-6` (1 = lightest, 6 = darkest, dark mode reverses).

**Chain is already lean (checked, no tier to remove).** The ramp aliases
`Status var → Style(Sherpa) status/color N → Core color.<hue>.<step>` — **three hops**, and the
`Alias` tier is skipped entirely (0 status references in Alias). So "optimise from Style upward" is
not about deleting a redundant middle tier — there isn't one. The saving is at the **Status
collection itself**: the override uses only **4 of the 6 ramp steps** (1, 4, 5, 6). Steps 2 and 3
were the old surface *hover/down* interaction ramp; under the new model interaction states come from
the component's own hover/down, not from status, so status carries **no hover/down surface vars**.
That drops the old 8-role Status collection to **5 (+1) vars** below — a real trim.

Fixed mapping — **one rule for every status, every component**:

| Override role         | Ramp step | Meaning |
|-----------------------|-----------|---------|
| `surface` **bold**    | **color 4** | saturated fill |
| `surface` **subtle**  | **color 1** | light tint |
| `surface` **transparent** | any @ mode 0 | status hue at 0% opacity — for ghost/tertiary controls (see below) |
| `border`              | **color 5** | strong hue |
| `content on subtle`   | **color 6** | dark hue — contrasts the light tint *and* a transparent surface on a light page |
| `content on bold`     | **color 1** | light hue — contrasts the saturated fill |

Border ≈ content because both are the deep end of the ramp (5 and 6 are adjacent strong steps). The
content contrast rule is: **which surface am I on → pick color 6 or color 1**, encoded once.

### 3a. Alpha as NAMED tokens — not modes (BUILT ✅, after a reversal)

**First attempt (abandoned):** alpha-as-**mode** on Core (modes `0/20/40/60/80`). It failed because
**a Figma alias/binding can't target a specific mode** — you can only *pin* a collection mode on a
NODE, and that pin is a **blanket** override of every Core-bound colour on the node + children. So
you can't make just one var transparent by pinning a mode. Modes removed; Core back to one `value`
mode (`compact`/`comfortable` too). Figma's real limitation: it won't separate opacity from colour.

**Replacement — materialised alpha tokens, aliased normally:**

- **`Core::color/alpha/{dark,light}/{0,20,40,60,80}`** — 10 real rgba tokens (dark = neutral/1000 at
  α; light = white at α). Alias them like any colour — no mode games — so they work **everywhere**
  (scrims, ghost/tertiary fills, hover/press washes).
- Build the ramp for **another hue only when a real need appears** (per-colour, not all 110×5).
- **Old `color/basic/transparent/0…1000` deleted** (stands). Tertiary consumers now alias the named
  tokens: `surface/interactive/tertiary/{base→alpha/dark/0, hover→alpha/dark/20, down→alpha/dark/40}`,
  `border/interactive/tertiary→alpha/dark/0`. Verified invisible both modes.

**Rule going forward:** for any transparency, **alias a `color/alpha/*` token** (or detach a raw rgba
on the one var). **Never** use a collection mode to apply opacity.

### Transparent surface (tertiary / ghost controls)

A **tertiary button** has a fill, but it is a colour **at Core mode `0` (0% opacity)** — so it reads
as transparent and the page behind it (a light surface) shows through. Under a status it stays at
0% opacity (its fill takes the status hue but never becomes visible) while its **text/border/icon**
take the **visible status hue**. Because the surface behind it is light, its content uses the
**`content on subtle`** ink (color 6, dark hue) — the same ink a subtle-surface component uses. So a
transparent surface is not a special colour; it is "the status hue at 0% opacity + on-subtle content."

The status `surface/transparent` var resolves to the status hue **at Core mode `0`** (fully
invisible) — i.e. it uses the alpha-as-mode system from §3a rather than a bespoke `transparent`
literal. (A faint status wash — e.g. a hover ghost — is then just the same hue at mode `20`.)

Edge: a tertiary sitting on a *dark* surface (`tertiary-on-color`) would instead want the on-bold
(light) ink. That is a **variant choice** (§5a) — the variant picks which content ink, exactly like
cta vs default.

---

## 4. Figma side (variable collections + modes + extensions)

The old `Status` collection was **deleted** in the earlier removal (the `id 13:3368` in stale notes
is gone). **Built fresh 2026-08-17** as `Status` (id `737:332261`). Shape — the terminal override:

- **Base modes = the status axis**: `passthrough | info | critical | warning | urgent | success`.
  This is the axis that must *trickle* from a parent to descendants (one pin on a wrapper tints
  everything inside), so it is the base mode — per the proven mode/extension trickle rules.
- **Variables (6)** — the complete surface of the override. `passthrough` mode of each falls through
  to the component's neutral source (Control/Container), so a status-less component is unchanged:
  - `status-surface/bold`        → color 4 per status (passthrough → neutral surface)
  - `status-surface/subtle`      → color 1 per status (passthrough → neutral surface)
  - `status-surface/transparent` → the status hue **at Core mode `0`** (0% opacity) via the
    alpha-as-mode system (§3a), for **every** status — the fill stays invisible while the control's
    content/border still tint. (Not a bespoke literal; reuses the alpha ladder.)
  - `status-border/default`      → color 5 per status (passthrough → neutral border)
  - `status-content/on-subtle`   → color 6 per status (passthrough → neutral content)
  - `status-content/on-bold`     → color 1 per status (passthrough → neutral on-color content)
- **No hover/down surface vars.** The old Status collection carried surface hover (color 2) and down
  (color 3); dropped — interaction states come from the component's own hover/down, not status. This
  is the §3 trim (8 roles → 6).
- **No `Saturated` extension needed.** Because bold / subtle / transparent are three *variables* (not
  a mode), a component (or variant) binds whichever surface it wants and all resolve from the single
  status pin. Simpler than the old extension approach; avoids the mutually-exclusive-extension trap.
- **Aliasing**, not hard values: every mode aliases the `status/<hue>/color N` ramp tokens, so
  light/dark and any ramp retune flow through automatically. (`transparent` is the one literal.)

Consumption: an instance (or a wrapper) pins **one** Status mode. Multi-status regions nest.

---

## 5. CSS side (how it translates — the important part)

The CSS pattern **already exists** and only needs enriching. An ancestor with `[data-status]` emits
`--_status-*` custom properties that inherit through shadow DOM; each component consumes them with a
neutral fallback.

**Enriched cascade** (generated by `project-tokens.mjs` into `@layer overrides`):

```css
[data-status="critical"] {
  --_status-surface-bold:        var(--sherpa-status-critical-color-4);
  --_status-surface-subtle:      var(--sherpa-status-critical-color-1);
  --_status-surface-transparent: transparent;
  --_status-border:              var(--sherpa-status-critical-color-5);
  --_status-content-on-subtle:   var(--sherpa-status-critical-color-6);
  --_status-content-on-bold:     var(--sherpa-status-critical-color-1);
}
/* …info / warning / urgent / success identical shape */
```

**Component (or variant) picks its surface** (the decision you made). The cascade always emits all
six vars; the component's own CSS binds the pair it wants. The **variant is the seam** where that
choice is made — see §5a.

```css
/* callout: a subtle-surface component */
.box {
  background: var(--_status-surface-subtle, var(--sherpa-surface-primary-base, #fff));
  border-color: var(--_status-border,       var(--sherpa-border-primary, #d5d5d5));
  color:        var(--_status-content-on-subtle, var(--sherpa-content-primary-base, #2e2e33));
}

/* toast: a bold-surface component */
.box {
  background: var(--_status-surface-bold,   var(--sherpa-surface-primary-base, #fff));
  color:        var(--_status-content-on-bold, var(--sherpa-content-title-base, #18191a));
}
```

Every value has a **neutral fallback**, so a status-less component renders unchanged — the fallback
*is* the passthrough. No status block ever has to define "neutral"; absence of `[data-status]` does.

### 5a. Variants can pick a different surface — one indirection layer

A component's **variants may need opposite status surfaces**: a **CTA / primary** button sits on a
bold accent fill (needs `content-on-bold` = light ink), while a **default / secondary** button sits
on a light surface (needs `content-on-subtle` = dark ink). Same status, different pick — chosen by
**variant**, not component.

This falls out of the existing pattern for free, because variants are already `:host([data-variant])`
blocks that re-point private vars. Add **one indirection**: the component consumes a *chosen* pair
(`--_status-surface` / `--_status-content`), and each variant points those at bold or subtle.

```css
:host {
  /* default look — subtle surface, dark ink */
  --_status-surface: var(--_status-surface-subtle, var(--sherpa-surface-primary-base, #fff));
  --_status-content: var(--_status-content-on-subtle, var(--sherpa-content-primary-base, #2e2e33));
}
:host([data-variant="cta"]),
:host([data-variant="primary"]) {
  /* bold surface, light ink */
  --_status-surface: var(--_status-surface-bold, var(--sherpa-surface-interactive-primary-base, #3c5edd));
  --_status-content: var(--_status-content-on-bold, var(--sherpa-content-title-on-color, #fff));
}
:host([data-variant="tertiary"]) {
  /* fill at 0% opacity — reads transparent on a light page; dark status ink (on-subtle) */
  --_status-surface: var(--_status-surface-transparent, transparent);
  --_status-content: var(--_status-content-on-subtle, var(--sherpa-content-primary-base, #2e2e33));
}
:host([data-variant="tertiary-on-color"]) {
  /* transparent, but sits on a DARK surface → light status ink (on-bold) */
  --_status-surface: var(--_status-surface-transparent, transparent);
  --_status-content: var(--_status-content-on-bold, var(--sherpa-content-title-on-color, #fff));
}
.trigger {
  background: var(--_status-surface);
  border-color: var(--_status-border, var(--sherpa-border-primary, #c0c0cc));
  color: var(--_status-content);
}
```

From the **same** `data-status="critical"` pin:
- `cta / primary + critical` → solid red fill + light ink
- `default / secondary + critical` → light-red tint + dark red ink
- `tertiary + critical` → **fill at 0% opacity** + dark red ink + red border (ghost, reads critical)
- `tertiary-on-color + critical` → fill at 0% opacity + light red ink (for dark backgrounds)

The variant, not the status, decides the surface *and* which content ink; the status only supplies
the hue. Border stays bold (color 5) in every case — components with no border just don't consume
`--_status-border`. Simple components with no variant split consume
`--_status-surface-subtle`/`-bold`/`-transparent` directly and skip the indirection.

### Escape hatch (edge cases)

An element ignores the status override for one aspect by **re-declaring the private var to `revert`**
(or binding a neutral token directly) on just that element:

```css
/* this icon never takes the status colour */
.brand-mark { --_status-content-on-subtle: revert; color: var(--sherpa-content-brand); }
```

`revert` drops the inherited status value, so the element falls back to its own neutral token. Scoped
to one element, one aspect — exactly the "ignore in this edge case" requirement.

### Why this is elegant + scalable

- **One mechanism, N statuses.** Adding a status = one ramp + one generated block. Zero component
  edits.
- **One mechanism, N components.** A new component opts in by consuming `--_status-*` with fallbacks.
  It never enumerates statuses.
- **Conditional styling falls out for free.** `[data-status="…"]` *is* the conditional — no JS, no
  per-status component CSS. Bold vs subtle is a variable choice, not a branch. This is the "translates
  nicely to conditional CSS" goal, already satisfied.
- **Figma ⇄ CSS parity.** Status modes ↔ `[data-status]` blocks; status variables ↔ `--_status-*`
  props; ramp aliases ↔ `var(--sherpa-status-*)`. The projector is the compiler between them.

---

## 6. Work plan (phased, verifiable)

**Now — Figma only. CSS regeneration is on HOLD until the Figma model is signed off.**

**Phase A — alpha-as-mode on Core (✅ DONE 2026-08-17):**
- Added modes `0 / 20 / 40 / 60 / 80` to `Core`; each holds every colour as detached raw RGBA at
  that alpha (base `value` mode still aliased). 110/110 colour vars covered, verified via bound node
  (`critical/600` @ mode 60 → opacity 0.6).
- Deleted the 11 `color/basic/transparent/*` primitives; remapped their 4 tertiary consumers to
  detached neutral RGBA at the matching alpha. Zero dangling refs.

**Phase F — build the Status model in Figma (✅ DONE 2026-08-17):**
1. ✅ Built `Status` (id `737:332261`) from scratch — the old one was gone. 6 modes
   `passthrough | info | critical | warning | urgent | success`; 6 vars (surface bold/subtle/
   transparent, border/default, content on-subtle/on-bold).
2. ✅ Aliased each status mode to the ramp steps (bold=4, subtle=1, border=5, on-subtle=6,
   on-bold=1). `passthrough` → neutral `Container::container-surface/default` + `container-border/
   default` + `Control::control-content/title`. `surface/transparent` = the hue's color 1 at **α0**
   (detached raw RGBA, self-contained). **Color Sets is out** — passthrough goes straight to
   Container/Control.
3. ⏳ Re-point component consumers' bindings onto the 6 vars — **NOT yet** (deferred with the CSS work).
4. ✅ **Verified** via bound-node matrix + on-canvas swatch screenshot. All 6 statuses resolve:
   e.g. critical bold `#dd2c01`, subtle `#fff7f5`, border `#bf2c09`, on-subtle `#9b2509`, on-bold
   `#fff7f5`; passthrough neutral white/grey/dark. **Known soft spot:** `warning bold` = near-white
   ink on bright amber (`#fffbf2` on `#fcb72d`) — weak contrast, a per-status tune for later (amber
   bold likely wants dark ink). Everything else contrasts well.

**Deferred — code side (do NOT run yet):**
5. Extend `project-tokens.mjs` to emit the 6 `--_status-*` vars per mode; regenerate `tokens.css`.
6. Update each status-consuming component's CSS to the enriched var names + neutral fallbacks, with
   the variant indirection (§5a) where a component has a cta/tertiary split. Inventory: callout,
   list-item, transfer-list, container, toast, message, pagination, input-text, nav-item,
   select-group, + others from the grep.
7. Update `CLAUDE.md` "Status cascade" section to the new var names, transparent surface, variant
   indirection, and the escape-hatch pattern.
8. Verify in-browser: screenshot each status on bold / subtle / transparent components; confirm
   contrast and that a status-less component is unchanged.

**Ordering rule (project convention):** Figma is the source of truth → Phase F lands and is signed
off first; only then does the projector regenerate the code.
