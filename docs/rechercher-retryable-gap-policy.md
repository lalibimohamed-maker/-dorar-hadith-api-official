# Rechercher retryable acquisition gaps

Acquisition gaps such as missing safe volume-count evidence or incomplete source coverage remain pending and are retried by the scheduled queue.

They must not be converted into successful acquisition records, deleted from the catalog, or treated as integrity failures. Integrity failures remain blocking.
