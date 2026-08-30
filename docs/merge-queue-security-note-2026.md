# Merge-queue security checks

Required checks for `main` now also run on GitHub Actions `merge_group` events so merge-queue commits receive fresh status checks.

The free antivirus mesh also listens to `merge_group`. It remains fail-closed: cancellation or any non-success scanner result is not treated as success.

No Corpus or scholarly content is modified by this change.
