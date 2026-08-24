# Protected Source Refresh

Registered sources are checked automatically on a schedule.

The refresh path is a verification boundary, not an authority boundary:

- HTTPS is required.
- Credentials and unusual ports are rejected.
- Redirects are followed manually and are limited to the registered host.
- Requests have strict time and response-size limits.
- Retrieved bytes receive a SHA-256 fingerprint.
- Every result is recorded in an auditable manifest.
- A failed or uncertain source is blocked.
- The refresh checker has read-only repository permissions.
- It never overwrites authoritative Corpus content.

Freshness checking and authoritative publication are deliberately separate. Before any external bytes can become authoritative data, they must pass provenance, rights, parsing/schema, quality/diff, and atomic-publication validation. The previous verified version remains authoritative whenever any gate is uncertain.