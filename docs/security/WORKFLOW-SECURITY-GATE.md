# Workflow Security Gate

This repository continuously audits every GitHub Actions workflow.

The gate checks for:
- full 40-character SHA pinning for every Action;
- prohibited untrusted-code triggers such as pull_request_target and issue_target;
- excessive workflow permissions;
- actions: write;
- unjustified contents: write;
- remote shell-piping patterns;
- chmod 777;
- checkout credentials that are not explicitly disabled.

The gate runs on pull requests, pushes to main, and weekly.

A finding is a hard failure. Security exceptions must be implemented as narrowly scoped code changes and reviewed rather than silently bypassing the gate.
