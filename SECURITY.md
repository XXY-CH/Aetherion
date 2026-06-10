# Security Policy

[中文版本](SECURITY.zh-CN.md)

Aetherion is an early local-first runtime prototype. Security reports are welcome, especially when they concern authority boundaries, policy bypass, event integrity, scoped leases, secret handling, tainted input, or unintended side effects.

## Supported Versions

There are no stable public releases yet. Security review currently targets the default branch and any active release branch explicitly named by maintainers.

| Version | Supported |
| --- | --- |
| `main` / active development branch | Yes |
| Older snapshots, forks, and local experiments | No |

## Reporting a Vulnerability

Please report vulnerabilities privately. Do not open a public issue with exploit details, secrets, credentials, private traces, raw user data, or proof-of-concept payloads that could harm users.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting or security advisory flow when it is enabled for this repository.
2. If that path is unavailable, contact a maintainer privately and ask for a secure reporting channel before sharing sensitive details.

Include, when safe:

- A concise description of the impact.
- Affected files, commands, schemas, or crate/package names.
- Reproduction steps using redacted or synthetic data.
- Whether the issue can bypass Local Supervisor, Tool Policy Proxy, scoped leases, consent, Event Ledger verification, quarantine, or replay checks.
- Any suggested fix or mitigation.

## Scope Of Interest

High-priority reports include:

- Reads, writes, imports, exports, connector calls, or generated code paths that bypass policy.
- Ledger hash-chain, replay, artifact reference, or projection integrity failures.
- Raw secret, credential, prompt, model output, private payload, or sensitive trace persistence.
- Tainted browser, IM, document, web, package, or third-party content authorizing actions.
- Capability Capsule, store package, sandbox, or migration flows that inherit trust without review.
- Rust supervisor RPC behavior that accepts malformed envelopes, mismatched workspace identity, stale leases, wrong paths, or direct file actions without traced lifecycle events.

Currently out of scope for this repository's security process:

- Attacks against unimplemented production systems such as real IM delivery, OAuth connectors, browser automation, cloud workers, or vault backends.
- Denial-of-service against local developer machines outside the project runtime.
- Findings that require committing real credentials or private user data to demonstrate impact.

## Maintainer Response

Maintainers aim to acknowledge valid private reports promptly, triage impact, coordinate a fix, and document the resolution. Timelines may vary while the project is pre-release, but security-sensitive issues should stay private until a mitigation is available.

## Safe Research Rules

- Use synthetic workspaces and redacted fixtures.
- Do not exfiltrate data or run destructive actions.
- Do not attempt persistence outside the local test workspace.
- Do not publish exploit details before maintainers have had a reasonable chance to respond.
