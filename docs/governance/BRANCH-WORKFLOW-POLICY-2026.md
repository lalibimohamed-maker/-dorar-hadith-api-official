# Central Branch Governance Policy — 2026

## Purpose

This is the canonical governance policy for **every branch** of موسوعة دينُ الله: existing, historical refs that still exist, currently active, newly created, and future branches. No branch category is exempt from the policy.

The lifecycle rules are centralized so that repair, correction, modification, testing, operation, renewal, change, replacement, rollback, and acquisition are governed consistently rather than being reimplemented independently on individual branches.

## Architecture

`Central Policy → Canonical Scripts/Workflows → Every Branch → Drift Audit → Safe Repair → CI/Review`

The central reusable acquisition implementation is `.github/workflows/rechercher-governed-acquisition.yml` on `main`. Branches are callers/data holders, not independent policy authorities.

## Mandatory lifecycle rules

1. **Repair:** known policy drift is repaired deterministically on every non-protected branch.
2. **Correction:** corrections are made at the central authority first, then propagated by the branch drift guard.
3. **Modification:** workflow-policy modifications must use the canonical implementation; branches must not maintain divergent copies of governed logic.
4. **Operation:** branch operations must preserve the current branch tip and must never silently overwrite newer work.
5. **Renewal/update:** a central correction becomes effective for all branches through recurring governance audits; no manual per-branch exception is required.
6. **Change:** changes affecting content, corpus, book editions, source rights, or authoritative material are outside automatic self-healing and require their normal content/provenance review.
7. **Replacement:** a weak or prohibited workflow/source is replaced only with a verified canonical alternative; a different book edition is never substituted merely because its title matches.
8. **Preservation:** automatic governance repair never rewrites corpus/content data, authoritative texts, book editions, source-rights metadata, or application data.
9. **Race safety:** before a repair push, the job verifies that the branch tip is still the SHA it audited. If it moved, the repair is abandoned rather than overwriting newer work.
10. **No force push:** self-healing never uses force-push or destructive ref rewriting.
11. **All workflow files:** prohibited CI-skip markers are removed from automated workflow commit-message logic across every workflow, not only Rechercher workflows.
12. **Acquisition callers:** governed Rechercher callers use `push` to `rechercher/**` and/or `workflow_dispatch`; they do not use `pull_request` as a write-back producer.
13. **Legacy producer:** `rechercher-waqfeya-pdf-download-01.yml` is prohibited. Active acquisition branches are migrated to the canonical multi-volume caller.
14. **Acquisition rights:** only entries explicitly marked `verified-redistributable` may be automatically re-hosted. Others remain metadata/source-link only until rights are verified or a lawful replacement is established.
15. **Source/edition integrity:** every acquired book must remain bound to its verified source, edition, volume ordering, validation result, and SHA-256 manifest.
16. **Future branches:** the scheduled central audit enumerates repository branch refs from the remote, so branches created after this policy are brought under the same governance automatically.
17. **Protected main:** `main` is audited by exactly the same repair rules but is not directly rewritten by self-healing; any main correction goes through the repository's protected reviewed-PR path. This is a safety mechanism, not a policy exemption.
18. **Unknown drift:** unknown or ambiguous differences are reported and left untouched rather than guessed at or overwritten.

## Scope: every branch

The policy intentionally does not exclude `feature/*`, `feat/*`, `fix/*`, `chore/*`, `rechercher/*`, historical branches, release branches, or other naming categories. Existing branch refs are audited; future branch refs are discovered by the recurring central audit.

Branches that have been deleted and no longer exist as refs cannot be modified retroactively; if restored or recreated, they are automatically subject to this policy again.

## Self-healing boundary

Self-healing is deterministic and conservative. It may repair known workflow-policy drift and prohibited workflow constructs. It must not infer or alter content meaning, editions, rights, corpus records, or authoritative material.

## CI and review separation

PR CI remains a validation system. Protected-branch changes remain review-gated. GitHub supports branch protection/rulesets targeting all branches or branch patterns, requiring reviews/status checks and blocking force pushes; the repository's active `main` ruleset currently enforces review and required checks. citeturn0search0turn0search1turn0search3

## Authority

This file is the canonical written policy. The canonical executable enforcement is:

- `.github/workflows/branch-workflow-governance.yml`
- `scripts/enforce_all_branch_governance.py`
- `scripts/enforce_branch_workflow_policy.py`
- `.github/workflows/rechercher-governed-acquisition.yml`

A policy correction should be implemented once at the central source and then propagated/audited across every branch.
