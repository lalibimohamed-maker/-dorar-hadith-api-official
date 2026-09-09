# Rechercher whole-encyclopedia catalog registry

Rechercher treats Dorar as a supplementary bibliographic discovery source, not as the encyclopedia's era catalog.

The central registry is `config/rechercher-encyclopedia-catalog-registry.json`. It covers the prophetic era, Companions and Followers, 1-400H, 401-800H, 801-1200H, 1201H onward, the modern era, and future books.

Saved repository catalogs remain the authoritative discovery inputs. A new governed catalog added under `books-batches/**/catalog.json` is automatically eligible for the next census.

Dorar `/v1/data/book` is matched against the saved catalog inventory for supplementary discovery only. Presence in Dorar does not imply copyright permission, redistribution permission, completeness, or PDF availability.
