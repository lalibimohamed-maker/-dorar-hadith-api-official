# Central Branch Workflow Policy — 2026

## Purpose

This is the canonical branch-level policy for workflow repair. Branches must not carry a stale copy of a known-bad acquisition workflow or a recursive `pull_request` trigger for branch-side Rechercher acquisition producers.

## Mandatory rules

1. Rechercher acquisition producers are branch-side producers and run from `push` to `rechercher/**` and/or `workflow_dispatch`.
2. They must not use `pull_request` as their producer trigger when they write back to the head branch with `GITHUB_TOKEN`.
3. No workflow may use `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, or `[actions skip]` in an automated commit message.
4. The obsolete single-volume workflow `rechercher-waqfeya-pdf-download-01.yml` is prohibited.
5. Automatic repair may only change the governed workflow-policy files. It must never force-push or rewrite unrelated branch content.
6. Before pushing a repair, the repair job must fetch the current remote branch and verify that its expected old SHA is still the branch tip. If the branch moved, it must skip that branch and report drift rather than overwrite newer work.
7. Central policy changes are made on `main` and propagated by the branch-governance workflow; individual branches do not become independent policy authorities.

## Self-healing boundary

Self-healing is limited to deterministic workflow-policy corrections. It does not alter application/content data, book editions, source rights, or authoritative corpus material. Unknown or ambiguous workflow differences are reported and left untouched.

## Rationale

GitHub recommends reusable workflows to avoid duplicated workflow logic. The repository therefore treats this document and its enforcement workflow as the governance authority, while branch-specific workflows remain callers/producers. See GitHub's reusable-workflow guidance: https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations
