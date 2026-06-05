# Innovation Thesis

The product is not most valuable because it is another agent that can use a computer. Computer use will become a baseline capability. Aetherion's highest-leverage bet is a governed harness kernel that makes agent action trustworthy, evolvable, inspectable, and portable.

The four innovation bets below should guide architecture, product scope, and MVP sequencing.

## 1. Capability Capsule Replaces Traditional Skill

Traditional agent skills are usually knowledge packages: instructions, examples, triggers, and maybe helper files.

Aetherion should treat that as only one layer. The internal first-class unit is the Capability Capsule:

```text
Capability Capsule =
  playbook
  manifest
  tool contract
  permission requirements and constraints
  tests
  evals
  policy
  provenance
  audit records
  lifecycle state
  rollback target
```

This turns "the agent learned a trick" into an auditable capability lifecycle:

```text
observe
-> propose
-> draft
-> test
-> evaluate
-> policy review
-> staged activation
-> monitor
-> patch or rollback
```

Design rule:

> Skill is procedural knowledge. Capability Capsule is governed operational ability.

Implications:

- Imported skills enter as draft capsules, not trusted active powers.
- A capsule never owns permission by itself.
- Permission expansion is a capsule diff plus explicit policy decision.
- Tool contracts, tests, evals, and rollback metadata are not optional for capabilities with side effects.

## 2. Event-Driven Proactive, Not Cron Proactive

Proactive behavior should not mean the agent wakes up on a timer and decides to talk.

Aetherion's proactive system should start from meaningful state changes:

- User message.
- Browser or file event.
- Connector webhook.
- Task completion or failure.
- User correction.
- Memory contradiction.
- Capability used repeatedly.
- Capability failed repeatedly.
- Project state change.
- Exact deadline.
- Attention budget window.

Those events produce opportunities, not interruptions:

```text
event source
-> correlation
-> opportunity
-> salience score
-> attention budget check
-> policy gate
-> intervention ladder
```

Intervention ladder:

```text
silent memory update
-> proactive inbox
-> digest
-> low-friction notification
-> ask for permission
-> draft action
-> low-risk autonomous action
```

Design rule:

> Aetherion should earn the right to interrupt the user.

## 3. Dreaming As Reviewable Patches

Dreaming should not be mystical self-reflection. It should be an event-driven consolidation pipeline that produces reviewable artifacts.

Valid dreaming outputs:

- Memory patch.
- User model patch.
- Capability patch.
- Eval fixture.
- Regression case.
- Policy suggestion.
- Project graph update.
- Contradiction report.

Invalid dreaming outputs:

- External side effects.
- Direct permission upgrades.
- Direct tool execution.
- Silent active capability replacement.
- Secret extraction.
- Untraceable memory mutation.

Design rule:

> Dreaming produces patches, not actions.

This makes self-improvement auditable:

```text
trace
-> simulation or replay
-> patch proposal
-> source references
-> confidence and risk
-> policy gate
-> merge, queue, or reject
```

## 4. Human-Readable Source Of Truth Plus Rebuildable Indexes

Trust should come from inspectable state, not opaque databases.

Source of truth:

- Markdown for playbooks, reports, decisions, and review notes.
- YAML for manifests, policies, migration reports, and capability metadata.
- JSONL for append-only event streams.

Rebuildable projections:

- SQLite operational views.
- Vector indexes.
- Graph indexes.
- Search indexes.
- Cache layers.

Design rule:

> Human-readable files are authoritative; indexes are disposable projections.

Implications:

- Users can inspect, diff, export, and delete meaningful state.
- Debugging can reconstruct why the agent acted.
- Memory and capability changes can be reviewed like code.
- Secrets never enter source-of-truth files, memory, logs, or indexes as raw values.
- Retention, redaction, encryption, and export sanitization are architecture requirements, not compliance polish.

## Product Bet Summary

The sharp product claim:

> Aetherion is not betting on agent action alone. It is betting on governed agent evolution: capabilities that can be learned, tested, approved, audited, patched, and rebuilt from human-readable truth.

This should remain the bar for roadmap choices. If a feature improves raw agency but weakens capability governance, event provenance, patch reviewability, or source-of-truth clarity, it should be treated as architectural debt.
