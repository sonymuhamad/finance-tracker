---
id: NNNN
title: <Technical design title>
status: Draft # Draft → Approved → In Progress → Implemented
prd: # link to docs/prd/NNN-*.md (the PRD this implements)
author: Engineering
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
last_verified: # date implementation was last checked against this doc
---

# RFC NNNN — <Title>

> **Accuracy rule:** this RFC must match what's in the code. If the
> implementation changes, update this document in the same change.

## 1. Context

Link the PRD. Summarize the problem in one paragraph. What exists today?

## 2. Design

### Data model
Prisma models / migrations introduced or changed.

### Layer flow
How it moves through `actions → service → repository`. List the key functions
in each layer and their responsibilities.

### Server Actions / API
Signatures, inputs (Zod schema), outputs, error cases.

### UI
Routes, components, states (loading/empty/error).

## 3. Alternatives considered

What else we looked at and why we rejected it.

## 4. Risks & trade-offs

Edge cases, data-integrity concerns, performance, security.

## 5. Test plan

Unit (service/repository), and what to verify manually.

## 6. Rollout

Migration steps, env vars, feature flags, and how to back out.

## 7. Implementation checklist

- [ ] Migration written & applied
- [ ] Service + repository + actions
- [ ] Zod schemas
- [ ] UI
- [ ] Tests
- [ ] `/simplify` + `/code-review` run
- [ ] This RFC updated to match final code (`last_verified` set)
