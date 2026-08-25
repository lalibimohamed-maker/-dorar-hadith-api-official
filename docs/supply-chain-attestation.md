# Supply-chain attestation

The repository uses Sigstore/Cosign to sign and immediately verify the source bundle produced by trusted GitHub Actions runs on `main` and version tags. The workflow also produces an SPDX SBOM and a GitHub artifact attestation.

The signature is keyless and tied to GitHub OIDC identity; no long-lived signing secret is stored in the repository.
