# Central Branch Workflow Policy — 2026

## Purpose

This is the canonical branch-level policy for workflow governance and self-healing. Branches must not carry independent copies of acquisition implementation that can drift from the repository authority.

## Architecture

`Central Policy → Reusable Workflow → Branch callers → Branch Drift Guard → Self-healing audit`

The reusable acquisition implementation is `.github/workflows/rechercher-governed-acquisition.yml` and is maintained on `main`. Governed branch workflows are callers only and reference that central workflow at `@main`; they do not contain acquisition implementation logic.

## Mandatory rules

1. Rechercher acquisition producers run from `push` to `rechercher/**` and/or `workflow_dispatch`.
2. Governed acquisition callers must not use `pull_request` as their producer trigger when they write to the head branch with `GITHUB_TOKEN`.
3. Governed acquisition callers must contain only the canonical caller contract; implementation changes belong in the central reusable workflow.
4. No workflow may use `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, or `[actions skip]` in an automated commit message.
5. The obsolete single-volume workflow `rechercher-waqfeya-pdf-download-01.yml` is prohibited.
6. Automatic repair may only change governed workflow-policy files. It must never force-push or rewrite corpus/content data, book editions, source rights, or authoritative material.
7. Before pushing a repair, the repair job must fetch the current remote branch and verify that its expected old SHA is still the branch tip. If the branch moved, it must skip that branch rather than overwrite newer work.
8. The central policy and reusable workflow are maintained on `main`. Individual branches are callers/data holders, not independent workflow-policy authorities.
9. A new workflow-policy correction is implemented once in the central source; the Drift Guard detects non-conforming callers and repairs them to the canonical contract.

## Self-healing boundary

Self-healing is deterministic and conservative. It may repair known workflow-policy drift and remove prohibited legacy producers. It does not infer or alter book editions, source rights, corpus content, or application data. Unknown or ambiguous workflow differences are reported and left untouched.

## Versioning and safety

The caller intentionally references the central reusable workflow from `main` so a policy correction becomes effective centrally without requiring every branch to carry a copied implementation. GitHub documents reusable workflows as a mechanism for centralizing repeatable logic and supports repository/branch references for called workflows.

## CI separation

PR CI remains a separate validation system. The branch-side acquisition producer is not a PR workflow, preventing the `GITHUB_TOKEN` write-back from creating the approval-required PR synchronization cycle that motivated this governance layer.
