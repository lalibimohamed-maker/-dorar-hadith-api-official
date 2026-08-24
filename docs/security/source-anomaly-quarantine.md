# Source Anomaly and Quarantine Gate

A source may be reachable and still be unsafe to publish.

The gate compares verified refresh metadata with the last accepted baseline. High-risk changes include leaving the registered host, extreme response-size changes, or blocked source states.

High-risk candidates are quarantined and do not replace the authoritative Corpus.

The baseline is deliberately metadata-only. It does not store external source content.