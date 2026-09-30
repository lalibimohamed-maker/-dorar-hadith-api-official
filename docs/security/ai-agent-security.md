# AI and Agent Security Policy

## Principle

AI agents, bots, scheduled automation, and human users are separate security principals. Trust in an agent does not imply unrestricted authority.

## Capability model

The preferred lifecycle is:

`Read → Analyze → Propose → Test → Review → Merge`

Agents should normally stop at `Propose` unless the repository explicitly grants a narrowly scoped capability for later stages.

## Prohibited defaults

An agent must not be granted permanent unrestricted write access to `main`, deletion rights, force-push capability, secrets, signing credentials, or production credentials.

An agent must not bypass required pull-request review, security checks, or provenance validation merely because it is an internal or trusted automation principal.

## Sensitive operations

The following operations require protected review or an equivalent explicit authorization boundary:

- changing source/provenance/rights policy;
- changing security workflows or their permissions;
- modifying authentication, authorization, secrets handling, or signing;
- changing Corpus publication gates;
- changing recovery or backup policy;
- changing the `main` protection model;
- merging security-sensitive changes.

## Untrusted input

Prompts, issue text, pull-request descriptions, comments, source documents, OCR text, remote metadata, and fetched content are untrusted inputs. They must not be interpolated into privileged shell commands or treated as authorization instructions.

## Tool-use boundary

An agent should use the least-privileged tool required for the current task. Read-only inspection is preferred. Write access should be limited to the smallest repository scope and branch necessary to produce a reviewable change.

## Reviewability

Agent-generated changes must remain reviewable as normal Git commits and pull requests. Security-sensitive agent work should leave an explicit audit trail through commit messages, PR descriptions, test results, and workflow evidence.

## Kill switch

When suspicious behavior is detected, disable the affected automation path, revoke or rotate impacted credentials, quarantine affected data, and preserve evidence. Do not attempt to retaliate against external systems.

## Fail-safe behavior

If an agent cannot establish provenance, authorization, integrity, or policy compliance, it must stop and retain the previous verified state rather than publish a guess.
