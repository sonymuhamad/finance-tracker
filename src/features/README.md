# `features/` — domain modules

Each feature is a self-contained domain module. The layering mirrors the clean
architecture used in `Satu-Dental-CMS-BE` (handler → usecase → repository),
adapted to Next.js + Prisma.

```
features/<domain>/
  actions.ts      # Server Actions — the entry layer. Auth check + input
                  # validation (Zod) + call the service. No business logic here.
  service.ts      # Business logic (the "usecase"). Pure-ish, testable, knows
                  # nothing about HTTP/forms. Calls the repository.
  repository.ts   # Data access. The ONLY layer that touches Prisma directly.
  schema.ts       # Zod schemas / DTOs for this domain.
  types.ts        # Domain types shared within the feature.
  components/     # Feature-specific React components.
  __tests__/      # Co-located unit tests (service/repository/util).
```

## Rules

1. **Dependencies point one way:** `actions → service → repository`. Never skip
   a layer (no Prisma in `actions`), never reverse it.
2. **`repository.ts` is the only place Prisma is imported.** Swapping/auditing
   data access stays local.
3. **Validate at the edge.** `actions.ts` parses input with the Zod schema
   before anything else; the service trusts its typed inputs.
4. **Every feature traces to docs.** A feature lands here only after its PRD is
   Approved and its RFC describes this design. Keep the RFC accurate.

> New feature? Run `/new-feature <name>` — it enforces PRD → RFC → plan →
> implement → sync-docs so this structure stays consistent.
