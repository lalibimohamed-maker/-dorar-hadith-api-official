# Rechercher acquisition push authentication fix

The central governed acquisition workflow intentionally disables checkout credential persistence. It therefore configures Git HTTPS transport explicitly from the GitHub Actions workflow token before fetch, rebase, and push.

This preserves the existing acquisition sequence and does not alter corpus data, manifests, rights policy, encryption, or source records.
