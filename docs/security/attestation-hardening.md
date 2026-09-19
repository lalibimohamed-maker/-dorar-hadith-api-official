# Supply-chain attestation hardening

The attestation workflow separates pull-request validation from trusted attestation.

- Pull requests build and hash a source bundle and publish validation evidence only.
- Pushes to `main`, version tags, and manual runs may use GitHub OIDC for keyless Sigstore signing and GitHub artifact attestations.
- Signature verification is restricted to this repository's workflow identity and GitHub's Actions OIDC issuer.
- No long-lived signing secret is required.
