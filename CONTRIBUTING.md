# Contributing

[中文版本](CONTRIBUTING.zh-CN.md)

Thank you for helping build Aetherion. The project is a codename for a local-first Agent Harness Kernel. Contributions should strengthen the governed runtime instead of widening the product surface too early.

## Project Boundaries

Aetherion is not a chatbot, replacement operating system, unrestricted plugin host, or broad connector marketplace. The current build remains V1-oriented and TUI-first.

Good early contributions usually improve:

- JSON Schemas and matching examples.
- Contract validation and fixtures.
- The Ether terminal command surface.
- Rust Local Supervisor authority checks.
- Event Ledger append, verification, replay, and projection audits.
- Tool request, policy decision, scoped lease, local file action, observation, and verification flows.
- Documentation that clarifies authority, policy, memory, capability, or audit boundaries.

Avoid early contributions that add real GUI, mobile, IM delivery, browser automation, MCP/OAuth connectors, cloud workers, secret backends, generated-package execution, or unrestricted plugin behavior unless an explicit implementation phase asks for them.

## Development Setup

Requirements:

- Node.js 25 or newer for the current TypeScript test runner.
- Rust and Cargo for the supervisor crate.
- `cargo-audit` for the full dependency-audit gate (`cargo install cargo-audit --locked --version 0.22.1`).

Useful commands:

```sh
npm ci --ignore-scripts
npm audit --audit-level=high --json
npm test
cargo audit
cargo test --locked
npm run test:all
cargo clippy --all-targets --all-features --locked -- -D warnings
cargo fmt --check
git diff --check
npm run ether -- doctor --workspace .
npm run ether -- security audit --workspace .
npm run ether -- run --workspace . --input README.md --output .aetherion/SUMMARY.md --approve-write
```

Runtime output under `.aetherion/` is local state and should not be committed.
GitHub Actions runs lockfile installs, dependency audits, TypeScript tests, locked Rust tests, Rust lint/format gates, whitespace diff check, tracked runtime/build artifact guard, operator readiness snapshots, Node 24 JavaScript action-runtime opt-in, and a Ubuntu/macOS platform-smoke job for pull requests and pushes to `main`.

The root JavaScript surface currently has no npm dependencies, but `package-lock.json` is committed and must be updated in the same change as any future dependency addition. `Cargo.lock` is committed and Rust verification should use `--locked`. The ignored `promo/` subtree is local/generated promotional material and is not release evidence.

## Contribution Workflow

1. Read the relevant docs before changing behavior, especially `docs/00-product-brief.md`, `docs/01-architecture.md`, `docs/06-roadmap.md`, and `docs/10-technical-strategy.md`.
2. Keep changes small, reviewable, and reversible.
3. For contract work, update schema, example, fixture, minimal runtime path, and tests together.
4. For cleanup or refactor work, write down the cleanup plan first and protect existing behavior with tests before changing code.
5. Reuse existing helpers and patterns before adding abstractions.
6. Do not add dependencies unless the issue or maintainer direction explicitly calls for one.
7. Do not store raw secrets, tokens, private data, raw prompt text, raw model output, or sensitive traces in examples, fixtures, logs, schemas, docs, or tests.
8. Run the narrowest useful tests first, then `npm run test:all` before asking for review when practical.

## Contract-First Checklist

For a new kernel contract or lifecycle transition, include:

- A JSON Schema in `schemas/`.
- A valid example in `examples/contracts/`.
- Runtime validation where the contract enters the harness.
- Tests that fail on missing, malformed, or authority-bypassing data.
- Ledger or artifact references when the data is evidence-bearing.
- Documentation updates when the contract changes project semantics.

## Pull Requests

Pull requests should explain the intent, the authority boundary touched, the tests run, and any known gaps. If a change affects runtime safety, policy, ledger semantics, replay, memory, capability lifecycle, or external-surface quarantine, call that out clearly.

Commit messages should prefer the repository's Lore protocol when the change records an important decision. At minimum, write the first line as the reason for the change rather than a mechanical summary of the diff.

## License

By contributing, you agree that your contributions are licensed under the MIT License in [LICENSE](LICENSE).
