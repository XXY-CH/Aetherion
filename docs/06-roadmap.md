# Roadmap

## Phase 0: Foundation Documents

Goal: turn the concept into a buildable product frame.

Deliverables:

- Product brief.
- Layered architecture.
- User Boundary Layer policy.
- Memory OS model.
- Skill and Scaffold OS lifecycle.
- Audit and data contract drafts.
- MVP acceptance criteria.

Exit criteria:

- A developer can explain what belongs in each subsystem.
- A developer can identify which subsystem owns permissions, memory, skills, tools, and execution.
- A developer can start scaffolding schemas and packages without guessing product intent.

## Phase 1: Local-First Harness MVP

Goal: create a local desktop-first loop with auditable file and browser operations.

Deliverables:

- Workspace identity and local project registry.
- Local event log.
- Permission firewall with L0-L5 risk levels.
- Approval card model.
- File operator.
- Browser operator prototype with screenshot plus DOM inspection.
- Basic context assembler.

Exit criteria:

- User can issue a local task.
- Agent can request or infer allowed local workspace actions.
- Agent can execute a reversible local action.
- Event and action logs can reconstruct what happened.

## Phase 2: Memory OS MVP

Goal: make memory useful without turning it into an untraceable vector dump.

Deliverables:

- Raw event log storage.
- Memory card schema.
- Memory candidate review state.
- Episodic task timeline.
- Basic user model file.
- Context assembler retrieval rules.

Exit criteria:

- Memory cards always cite source events.
- Sensitive memory can be blocked from future contexts.
- User can inspect and delete memory.
- Context assembly can show why memory was selected.

## Phase 3: Skill OS MVP

Goal: turn repeated workflows into governed procedural knowledge.

Deliverables:

- Skill manifest schema.
- Skill registry.
- Draft, test, publish, deprecated states.
- Replay test harness over historical episodes.
- Skill scoring metrics.

Exit criteria:

- Agent can propose a skill candidate from repeated episodes.
- Draft skill can be tested before use.
- Published skill has version, source tasks, evals, risk, and rollback.
- Skill cannot receive tool permissions directly.

## Phase 4: Scaffold OS and Capability Packages

Goal: let the agent generate extensions while preserving engineering control.

Deliverables:

- Capability package manifest.
- Tool, workflow, connector, and UI templates.
- Permission diff engine.
- Sandbox trial runner.
- Static safety scan hook.
- Approval UI contract.
- Package signing and rollback metadata.

Exit criteria:

- Agent can generate a package draft.
- Package cannot install until schema, tests, permission diff, sandbox, and approval pass.
- Permission changes are visible between versions.

## Phase 5: User Connection Layer

Goal: connect real user surfaces without making them unsafe authority boundaries.

Deliverables:

- Browser extension.
- One IM gateway.
- Mobile companion or lightweight approval surface.
- OAuth connector runtime for a small integration set.
- Device pairing.
- Channel identity mapping.

Exit criteria:

- User can wake the agent remotely.
- User can approve high-risk action from another device.
- Chat channel cannot bypass desktop/user boundary permissions.
- Connector authorization remains separate from agent action approval.

## Phase 6: Proactive and Dreaming Loops

Goal: make the agent useful between explicit prompts.

Deliverables:

- Event-driven proactive scheduler.
- Priority policy.
- Dreaming job runner.
- Contradiction detection.
- Skill candidate generation from dreams.
- Memory staleness review.

Exit criteria:

- Proactive suggestions cite their trigger and reason.
- Dreaming produces candidates, not direct external actions.
- User can disable or scope proactive behavior.
- All proactive actions are auditable.

