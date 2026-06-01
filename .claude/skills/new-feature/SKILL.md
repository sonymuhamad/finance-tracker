---
name: new-feature
description: Orchestrate a new finance-tracker feature end-to-end with the strict docs-first workflow. Use whenever starting any new feature or non-trivial change. Triggers on "/new-feature", "new feature", "let's build", "add a feature", "start working on".
---

# new-feature — strict feature workflow

The non-negotiable pipeline for every feature in finance-tracker. Do NOT skip
steps. Each gate needs Sony's approval before moving on.

## The pipeline

```
1. PRD        →  2. PHASE   →  3. RFC      →  4. PLAN     →  5. IMPLEMENT  →  6. SYNC DOCS
   (pm skill)     (pm skill)    (eng skill)    (writing-     (eng skill)      (eng skill)
                                               plans)
```

### 1. PRD  *(use the `pm` skill)*
Draft `docs/prd/NNN-<slug>.md` from `_template.md`: problem, goals, non-goals,
user stories, scope, success metric. **Gate:** Sony sets status → `Approved`.

### 2. Phase  *(use the `pm` skill)*
Recommend a milestone and, on approval, update `docs/roadmap.md`.

### 3. RFC  *(use the `eng` skill)*
Draft `docs/rfc/NNNN-<slug>.md` from `_template.md`: data model, layer flow
(`actions → service → repository`), Server Action signatures, alternatives,
risks, test plan. Link the PRD. **Gate:** Sony approves the design.

### 4. Plan
Invoke the `superpowers:writing-plans` skill to turn the RFC into a step-by-step
implementation plan.

### 5. Implement  *(use the `eng` skill)*
Build per the layering with co-located tests. Then:
`bun run test` · `bun run type-check` · `bun run lint` · `/simplify` · `/code-review`.

### 6. Sync docs  *(use the `eng` skill)*
Update the RFC to match the final code, set `last_verified`, flip PRD + RFC
status → `Implemented`, and tick the roadmap entry.

## Rules

- **No code before an Approved PRD.** No closed RFC that disagrees with the code.
- Keep each feature a small, isolated slice. One feature = one PRD + one RFC.
- When unclear, ask one question at a time.
