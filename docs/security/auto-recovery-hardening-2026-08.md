# Auto-recovery hardening

The privileged `workflow_run` recovery workflow never checks out or executes pull-request code.

Recovery now reads the pull request file list and writes only allowlisted workflow files by creating a commit through the GitHub Git API, using the corresponding file contents from trusted `main`.

The workflow verifies that the PR head SHA has not advanced since the triggering `workflow_run`, that the PR is same-repository and targets `main`, and that the branch reference is safe. Added workflow files without a trusted counterpart on `main` are not auto-created and require manual review.

This preserves the existing fail-closed recovery policy while removing the dangerous privileged checkout pattern documented by GitHub.
