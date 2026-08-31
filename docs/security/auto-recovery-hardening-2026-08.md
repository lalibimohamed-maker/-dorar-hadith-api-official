# Auto-recovery hardening

The privileged `workflow_run` recovery workflow never checks out or executes pull-request code.

Recovery reads the pull request file list and writes only allowlisted workflow files using trusted `main` contents through the GitHub API.

The workflow verifies that the PR head SHA has not advanced since the triggering run, that the PR is same-repository and targets `main`, and that the branch reference is safe. Newly added workflow files without a trusted counterpart on `main` are not automatically created.
