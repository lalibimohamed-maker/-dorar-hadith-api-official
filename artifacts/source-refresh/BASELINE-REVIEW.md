# Source refresh baseline review

This file documents the baseline-generation procedure for source-refresh integrity.

## Safety rule

The baseline must be generated from a successful, trusted `source-refresh-gate` run. It must not be hand-authored or populated with guessed SHA-256 values.

## Two-account review

- `lalibimohamed-maker` remains the repository owner and final merger.
- `lalibimohamed82-coder` is the independent reviewer.
- A generated baseline is proposed through a pull request and must be reviewed before it becomes trusted state.

## Required sequence

1. Run the source refresh gate successfully from the review branch/workflow.
2. Capture the generated `artifacts/source-refresh/manifest.json`.
3. Generate `config/source-refresh-baselines.json` from that successful manifest without altering source hashes.
4. Review the resulting diff for unexpected hosts, redirects, sizes, statuses, or source additions.
5. Require the independent second-account review before merge.
6. Do not merge if any source is blocked or if the manifest was not produced by a successful trusted run.

No baseline values are embedded in this document; the values must come from the verified run artifact.
