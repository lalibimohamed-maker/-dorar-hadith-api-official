# Rechercher acquisition push authentication fix

The central governed acquisition workflow intentionally keeps checkout credentials non-persistent.

## Authentication contract

For Git operations that contact GitHub after checkout, the workflow builds an ephemeral HTTP Authorization header from the workflow token and passes it with Git's `http.extraheader` configuration.

Primary acquisition sync uses the `GITHUB_TOKEN` for:

- fetch of the governed target branch;
- LFS push dry-run;
- final branch push.

Secondary PDF storage uses the dedicated `RECHERCHER_SECONDARY_STORAGE_TOKEN` for:

- fetch of secondary `main`;
- LFS push dry-run;
- final secondary push.

The token is not written to the repository Git config and `persist-credentials: false` remains enabled.

## Integrity boundary

The change is authentication-only. It does not alter:

- Corpus contents;
- acquisition order;
- manifests;
- rights policy;
- encryption policy;
- source records;
- PDF validation;
- LFS storage model.

The rebase itself remains a local operation after an authenticated fetch. Interactive credential prompts remain disabled by `GIT_TERMINAL_PROMPT=0`.
