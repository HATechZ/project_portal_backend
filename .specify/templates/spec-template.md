# SPEC: [Module Number] — [Module Title]

**Status:** Draft | In Review | Approved
**Tables owned:** [count, or "—" for platform/infrastructure modules]
**Owner:** [Agent/Author]

---

## 1. Overview & Business Intent

[What problem this module solves, which actors use it, and its role in the project portal
workflow. Name the `ActorRoleCode` values involved.]

---

## 2. User Stories

- **US-01**: As a [ActorRoleCode], I want to [action], so that [benefit].
- **US-02**: As a [ActorRoleCode], I want to [action], so that [benefit].

---

## 3. Domain Rules

Invariants that hold regardless of endpoint. State each as a rule the code must not be able
to violate.

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | [e.g. A work request's status is never stored; it is the latest audit log entry] | [repository / DB constraint / service] |

---

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---|---|
| [e.g. referenced division does not exist] | 409 | `DATABASE_CONSTRAINT` |
| [e.g. record not found] | 404 | `NOT_FOUND` |

---

## 5. EARS Acceptance Criteria

- **Ubiquitous (Always Active)**:
  - `[AC-U01] The module SHALL [behavior].`
- **Event-Driven (When)**:
  - `[AC-E01] WHEN [actor] [action], the system SHALL [response].`
- **State-Driven (While)**:
  - `[AC-S01] WHILE [condition/state], the system SHALL [behavior].`
- **Unwanted Behavior (If / Then)**:
  - `[AC-W01] IF [invalid condition], THEN the system SHALL [graceful handling].`

---

## 6. Out of Scope

[What this module deliberately does not do, and which module owns it instead.]
