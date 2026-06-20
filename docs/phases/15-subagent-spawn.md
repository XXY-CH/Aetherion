# Phase 15 — Subagent Spawn

Alignment: doc 17 P3-11. The multiagent governance model (AgentContract, ResourceBudget, CircuitBreaker) is mature but only 1 hardcoded read op exists. OpenClaw has `sessions_spawn` for background sub-agents.

## Scope (minimum viable)

1. Declare `agent_spawn` tool (verb=exec, L4 risk, approval-gated).
2. On execution: create an AgentContract with a conservative budget (1000 tokens, 5 tool calls, 30s wall time, L2 risk max), start a nested `runAgentLoop` synchronously (blocks parent until child completes), return the child's final assistant text as the tool result.
3. Child uses the same provider + toolRegistry but a fresh conversation state.
4. Budget enforcement: if child exceeds token/tool/time budget, circuit breaker stops it.

## What this is NOT
- No async/background sub-agents (synchronous only in V1).
- No sub-agent-to-parent messaging.
- No nesting depth > 1 (child cannot spawn grandchild).

## Tests
1. `agent_spawn registry entry exists`
2. `agent_spawn creates contract with budget`
3. `agent_spawn runs child loop and returns result`
4. `circuit breaker stops child on budget exhaustion`

## Out of scope
- ACP (external harness delegation).
- Multi-child parallelism.
- Child persistence/resume.
