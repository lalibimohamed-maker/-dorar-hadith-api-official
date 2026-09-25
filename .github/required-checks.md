# Required checks invariant

Pull-request required checks must be reported on the current head commit.
Automated ledger commits must not use `[skip ci]`/`[ci skip]` because GitHub leaves required checks in a pending state when a required workflow is skipped by commit message.

Rechercher evidence persistence remains in the System Layer and must not bypass the protected `main` branch or the item-level rights gate.
