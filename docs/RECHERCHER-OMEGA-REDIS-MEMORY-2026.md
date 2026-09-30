# Rechercher Omega — Redis conversation memory

The default in-process memory remains volatile. This file adds an optional self-hosted Redis 7 deployment for distributed/session persistence without introducing a paid service dependency.

Raw conversation persistence remains a policy decision: the Redis adapter is generic key/value infrastructure and does not bypass the existing privacy policy. Store only bounded, policy-approved records; prefer hashes/digests for sensitive evidence.

The CI smoke test may launch the official Redis container and verify SET/GET/DEL. A successful CI smoke test proves the adapter works, not that a public production host has been deployed.
