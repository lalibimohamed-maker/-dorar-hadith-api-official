# Merge-Queue Security Checks 2026

The protected main status-check workflows are wired to GitHub Actions merge_group with checks_requested so merge-queue commits receive fresh checks.

Required contexts covered by the regression guard:
test (22), test (24), dependency-review, workflow-security, CodeQL, baseline.

The Free Antivirus Analysis Mesh also listens to merge_group. Its summary gate reads every scanner result and exits non-zero for cancellation, failure, or any result other than success. A cancelled scanner is never promoted to success.

This is CI/security plumbing only; it does not modify Corpus or scholarly content.
