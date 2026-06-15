# Graph Report - c:\Users\padil\Projects\PrintFlow  (2026-06-02)

## Corpus Check
- 11 files · ~133,724 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 208 nodes · 348 edges · 15 communities (10 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `bt()` - 50 edges
2. `useEscClose()` - 38 edges
3. `bs()` - 18 edges
4. `fmt()` - 14 edges
5. `OCard()` - 12 edges
6. `DetailModal()` - 8 edges
7. `isSec()` - 7 edges
8. `fD()` - 6 edges
9. `OrdenesCompraView()` - 6 edges
10. `ssLabel()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `src/main.jsx bootstrap` --references--> `src/App.jsx (single-file React app)`  [INFERRED]
  index.html → CHANGELOG.md
- `src/App.jsx (single-file React app)` --implements--> `Inline JSX style object C (colors)`  [EXTRACTED]
  CHANGELOG.md → CLAUDE.md
- `PrintFlow 7-role permission system` --conceptually_related_to--> `ACTION_ROLES permission map`  [INFERRED]
  CLAUDE.md → CHANGELOG.md
- `getTaskFilters(role)` --references--> `PrintFlow 7-role permission system`  [INFERRED]
  CHANGELOG.md → CLAUDE.md
- `chipsForRole(role)` --references--> `PrintFlow 7-role permission system`  [INFERRED]
  CHANGELOG.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **OC-level folio assignment flow** — roadmap_assign_oc_folio_modal, changelog_assign_folio_to_oc, roadmap_shared_invoice_folio, roadmap_folios_locked, changelog_invoice_counters [EXTRACTED 0.90]
- **Role-based permission/visibility system** — claude_roles_system, changelog_action_roles, changelog_can_execute_action, claude_is_sec, claude_sec_owns, claude_v_owns [INFERRED 0.85]
- **Folio counter integrity safeguards** — changelog_invoice_counters, changelog_folio_counter_guard, claude_folio_system, claude_seed_phantom_record [EXTRACTED 0.85]

## Communities (15 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (27): ACTION_ROLES, AGENTS, ALL_S, C, db, escStack, FINISHES, GUIDES (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (36): AddExistingProductsModal(), AdjustStockModal(), AuditoriaView(), bt(), CancelInvoicedModal(), CancelOrderModal(), ConfirmModal(), CoronaModal() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (22): ACTION_ROLES permission map, src/App.jsx (single-file React app), canExecuteAction permission gate, chipsForRole(role), getTaskFilters(role), InventoryModal, PrintFlow Changelog, sell_from_stock permission (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (20): dependencies, framer-motion, @phosphor-icons/react, react, react-dom, @supabase/supabase-js, devDependencies, tailwindcss (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (20): Archive(), Calendar(), canAddProductToOC(), canEditWebOrder(), ChemicalPanel(), ClientHistory(), DetailModal(), fD() (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (14): assign_folio_to_oc RPC, corona_credit_bridge_enabled flag, trg_guard_invoice_counter_jump trigger, invoice_counters table, normalize_app_config_booleans trigger, Folio numbering system (P/D/R/C/W), OP-SEED-P3434-DO-NOT-DELETE phantom record, AssignOCFolioModal component (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (14): Analytics(), AssignOCFolioModal(), bs(), ClientConfirmModal(), CommentLog(), fmtM(), LiveTimer(), MoveOrderModal() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (6): getTaskFilters(), isSec(), OrderForm(), pct(), PrintFlow(), PrintOrder()

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (4): Busy-state guard pattern for critical modals, cobranza.client_credit_ledger table, CreditAdjustModal, credit_adjust RPC

## Knowledge Gaps
- **62 isolated node(s):** `allow`, `name`, `version`, `private`, `type` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `bt()` connect `Community 1` to `Community 0`, `Community 4`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03278688524590164 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13157894736842105 - nodes in this community are weakly interconnected._