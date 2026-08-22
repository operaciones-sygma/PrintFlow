---
target: el formulario de orden nueva de PrintFlow
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-07-08T00-21-31Z
slug: src-app-jsx-orderform-formulario-orden-nueva
---
# Critique — OrderForm (formulario de orden nueva, PrintFlow)

Target: `src/App.jsx` :: `OrderForm` (L8691-9207). Register: **product** (internal print-shop production tool). Deterministic detector: 0 findings (clean). Browser overlay: unavailable this session (no browser automation) — review is source + domain-knowledge based.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good loading/inline states; no position/progress in a very long form |
| 2 | Match System / Real World | 4 | Excellent domain language (Razón social, Placa CTP, Blocks, Sin empaque SYGMA) |
| 3 | User Control and Freedom | 3 | Cancel/toggle/remove OK; no draft/autosave, sidebar-nav loses everything |
| 4 | Consistency and Standards | 2 | ~16 font sizes vs a defined 5-step scale; 3-4 header treatments; orange means two things |
| 5 | Error Prevention | 3 | Strong: required summary, contact warnings, auto folio, dup-client modal |
| 6 | Recognition Rather Than Recall | 3 | Typeahead, autocomplete, replicar, suggest-date; some mode/abbrev recall |
| 7 | Flexibility and Efficiency | 3 | Ctrl+Enter, replicar, capture modes; primary shortcut hidden at the bottom |
| 8 | Aesthetic and Minimalist Design | 2 | Rainbow of tinted callouts + 0.5px-apart sizes + all-expanded reads busy |
| 9 | Error Recovery | 3 | Scroll-to-top + list + faint borders; no jump-to-field |
| 10 | Help and Documentation | 3 | Inline hints, per-role guide banners, tooltips, realistic placeholders |
| **Total** | | **29/40** | **Good (solid and domain-perfect; missing a system pass)** |

## Anti-Patterns Verdict

**Does it look AI-generated? No.** This is the opposite failure. The detector found zero slop patterns (no gradient text, no glassmorphism, no identical card grids, no hero-metric, no side-stripe borders). It reads as a hand-built internal tool that has accreted ~100 versions of real features. The "slop" in the product sense (would a Linear/Stripe-fluent user pause at subtly-off components?) is real but it comes from **organic growth without a typography/color system pass**, not from templated generation. The type-size jungle and the per-feature rainbow are the two tells.

## Overall Impression

Functionally this is a strong, deeply domain-fit form: the language is the shop's own, the states are covered (loading, warning, disabled, inline validation), and the hard problems are solved (automatic folio kills a whole error class; the duplicate-client modal catches the highest-risk moment). What holds it back is **calm**. It is one ~2500px single column of ~20 sections, each roughly equal in visual weight, each feature-area painted its own color, with fonts ranging 8.5px to 22px in ~16 steps. The single biggest opportunity: run the design system it already owns (the 5-step `F` scale + a restrained accent) across this surface, and give the long scroll spatial anchoring (a sticky action bar). Nothing needs rebuilding; it needs a system pass.

## What's Working

- **Domain language and examples (heuristic 2, genuine 4).** "Razón social", "Placa CTP · Ya existe (reutilizar)", "EN BLOCKS DE 100", "Folio del 1000 al 2000", "Sin empaque de SYGMA". Placeholders carry real shop examples, not lorem. A new hire learns the shop by reading the form.
- **Error prevention at the right moments.** Required-field summary before submit, live contact warnings, RFC required for new clients, quantity must be > 0, automatic non-editable folio, and the in-app duplicate-client confirm modal (replacing a reflexive native `confirm`) at the exact point UVEG-style duplicates were being created.
- **State coverage.** `imgUploading` blocks submit with a labeled button ("Subiendo imagen..."), financials-locked banners explain *why* price is read-only, disabled/selected/warning states are all present. Most forms ship half of these.

## Priority Issues

- **[P1] Type-size jungle: the form ignores its own scale.** The codebase defines `F={title:15,label:13,body:11,meta:10,micro:9}` (established in the v10.73.10 OCard typeset pass), but OrderForm hardcodes ~16 sizes: 22, 18, 17, 16, 15, 14, 13.5, 13, 12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5. Many are 0.5px apart (13.5/11.5/10.5/9.5/8.5), which reads as noise, not hierarchy, and 8.5px hint text sits below a comfortable/accessible floor.
  - **Why it matters:** the product register explicitly warns that with many type elements, near-identical sizes create noise and undercut hierarchy. This is the root cause of heuristics 4 and 8 both scoring 2.
  - **Fix:** migrate every hardcoded size to the `F` scale (section header = a new/`label` step, field label = `meta`/`micro`, body = `body`, the % Ganancia number = `title`). Delete the half-steps. Raise sub-9px hints to `micro` (9) minimum.
  - **Suggested command:** `/impeccable typeset`

- **[P1] Color is used as categorization, not state — a rainbow, with a real collision.** In one default view a user meets: purple guide banner (`fac`), teal order-type (`ac`), red/amber/green priority, blue distribution card (`ios`), red "Sin empaque" card (`dn`), cyan "Replicar" bar (`ctp`), emerald stock (`emr`), purple "Avanzado" (`prf`), **orange acabados chips (`maq`)**, cyan CTP-plate (`ctp`). Orange (`maq`) simultaneously means "Maquila" in the order-type toggle and "finish selected" in the chips.
  - **Why it matters:** the product floor is Restrained (one accent for selection/primary + semantic red/amber/green for state). When ten hues compete, the *meaningful* ones (danger red for white-label, warning amber for missing contact) stop standing out. High extraneous cognitive load.
  - **Fix:** collapse to one selection accent (`ac`) for all "this option is chosen" states (order type, capture mode, agent, CTP, finishes), keep red/amber/green strictly for danger/warning/success, and drop the decorative per-feature tints on the callout cards. Resolve the orange double-meaning.
  - **Suggested command:** `/impeccable quieter`

- **[P2] No spatial anchoring in a 2500px form; submit and errors live at the bottom.** ~20 stacked sections, no section rail, no sticky action bar. The primary accelerator (Ctrl/⌘+Enter) is only revealed as a tip *at the very bottom* — you must reach the bottom to learn the shortcut that saves you from reaching the bottom. On submit-fail the view scrolls to top while the missing-field list renders at the bottom.
  - **Why it matters:** Lupita captures many orders a day; every order is a full-height scroll to reach "Crear Orden". Peak-end lands on either a long scroll or an error box detached from the fields it names.
  - **Fix:** a sticky bottom action bar (Cancelar / Crear Orden) with a live "N faltantes" count and the Ctrl+Enter hint inline; on submit-fail, focus/scroll to the *first invalid field*, not the top.
  - **Suggested command:** `/impeccable layout`

- **[P2] Section signposting is ambiguous — 3-4 near-identical header treatments.** "Cliente/Producto/Especificaciones" (10px uppercase gray), "Maquila" (10px uppercase colored + icon), "Modo de captura" (10px uppercase, letterSpacing .4), and the field `lbl` (10px uppercase gray, letterSpacing .3) are all ~10px uppercase gray. Section headers don't read as a distinct level from field labels.
  - **Why it matters:** in a long form the user scans for "where am I". Four competing labels at the same size flatten the IA.
  - **Fix:** one section-header style, clearly heavier/larger than field labels, consistent across all sections including "Adicional". Field labels drop a step below it.
  - **Suggested command:** `/impeccable layout`

- **[P2] Error recovery is a manual hunt.** Missing fields get a faint 1.5px border at ~38% red alpha (`C.dn+"60"`), low contrast; the summary can be off-screen; there's no link from "Cantidad" in the summary to the Cantidad field.
  - **Why it matters:** "what exactly is missing, and where" should be one glance and one click, not a scroll-hunt.
  - **Fix:** stronger invalid-field affordance (solid border + optional inline "requerido"), auto-focus the first invalid field on submit-fail, keep the summary pinned (folds into the sticky action bar above).
  - **Suggested command:** `/impeccable harden`

## Persona Red Flags

**Lupita (high-volume capturer — she enters Manuel's vales and most daily orders):** Full-height scroll per order; the Ctrl+Enter accelerator is hidden at the bottom; "Adicional" defaults expanded so CTP + 2 images + file + notes add ~4 sections she scrolls past on every simple job; on a validation miss the page jumps to the top away from the field. Death by a thousand scrolls at her volume.

**Karla (pricing/invoicing — edits price on no-price orders):** She often needs one field (price), but enters the whole ~20-section form with the price block at equal weight buried mid-page. The financials-locked banners are clear (good), yet there's no "just the price" fast path.

**Gerardo / German (producción / preprensa — specsOnly or hideC):** Their form is trimmed (client collapses to read-only, good), but the purple/teal "Modo de captura" and the colored callouts still compete with the specifications they actually came to fill. The thing they need isn't the loudest thing on screen.

## Minor Observations

- "Adicional" defaults **expanded** (Marcelo's call), which defeats the collapse for the common case. Consider collapsed-by-default or remembering the last state per user.
- Emoji (💡 ⚡ ℹ️ 🔴🟡🟢 📦📄) are mixed with Phosphor icons; the finish chips use a text "✓ " prefix while the rest of the form uses `<CheckIcon>`. Two icon vocabularies; emoji also render per-OS.
- Inputs are borderless (1px `boxShadow` ring) — clean on their own, but combined with per-cell `borderRight` dividers the grid rows can read busier than needed.
- The Email/WhatsApp/RFC 3-column row crams a lada `<select>` + tel input into one third; tight below ~640px.
- Faint error border alpha (`+"60"`) is the weakest link in an otherwise-solid validation story.

## Questions to Consider

- What if the daily driver (Lupita, internal, non-maquila) saw a *minimal core* by default, with maquila/stock/distribution/CTP revealed only when relevant? How short could the required path get?
- Does each feature-area need its own color, or would one accent plus restrained neutrals make the two colors that *carry real risk* (white-label red, missing-contact amber) finally pop?
- What would a confident version look like: one calm column, one type scale, one accent, a sticky action bar — the tool disappearing into the task?
