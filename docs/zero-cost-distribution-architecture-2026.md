# Zero-Cost-First: Universal Free Distribution Architecture

## Purpose

Make the core of the Din Allah Encyclopedia freely accessible without making any paid provider, paid API key, commercial cloud, or app-store membership a prerequisite for reading the encyclopedia on the web/PWA.

## Important correction: zero-cost is a design target, not a perpetual vendor guarantee

The project must not claim that a third-party provider offers unlimited bandwidth/storage forever. Free services have published quotas, acceptable-use rules, rate limits, or can change terms. Therefore the architecture is **zero-cost-first, provider-independent, and fail-closed**, not dependent on a single free vendor.

## Distribution layers

1. **Primary universal path: static/PWA web application.**
   - Public web access requires no app-store membership.
   - Client-side locale detection uses BCP 47/CLDR-aware identifiers.
   - Offline bundles and local search reduce repeated server traffic.

2. **GitHub Pages for the web shell and lightweight public assets.**
   - Eligible for public repositories on GitHub Free.
   - Published Pages sites are limited to 1 GiB and have a soft 100 GiB/month bandwidth limit.
   - Therefore GitHub Pages is not treated as unlimited hosting and is not the sole distribution path for large media.

3. **GitHub Releases for versioned application/bundle assets.**
   - Release assets are versioned and addressable.
   - Individual release assets must remain below GitHub's documented per-file limit.
   - Critical large assets still receive independent mirrors/fallbacks.

4. **Internet Archive as an external preservation/distribution candidate.**
   - Use only for material whose rights permit redistribution.
   - Store provenance, source metadata and rights with every item.
   - Do not promise perpetual retention or unlimited bandwidth without rechecking current Archive policies.
   - Do not assume a native GitHub-to-Internet-Archive account-linking mechanism.
   - Any automation uses separate Archive credentials kept outside the repository and scoped to the minimum required access.

5. **Peer-assisted distribution (optional).**
   - Suitable for legally redistributable offline bundles.
   - Never make P2P the only delivery channel; browsers, mobile platforms, NATs, and regional policies vary.

## App stores

The web/PWA route is the cost-independent primary channel. Official stores are secondary distribution channels:

- Apple App Store requires Apple Developer Program membership for store distribution; the current annual fee is USD 99 unless a qualifying organization receives a fee waiver.
- Google Play is also a fee-bearing distribution channel.
- Android FLOSS distribution can additionally target F-Droid, subject to its inclusion and reproducible-build requirements.

No store membership is required for users to access the web/PWA version.

## Large offline packages

A 10 GiB package downloaded by a user does not itself create a direct charge to the project owner merely because the user's device stores and reads it locally. A cost can arise from the provider serving the 10 GiB package, quota exhaustion, storage, egress, or a paid distribution channel. Therefore large packages are split into independently addressable, checksummed chunks and delivered through multiple permitted hosts or peer-assisted mechanisms.

## Developer self-use

Local development and local/offline execution on the developer's own devices consume the device's CPU/storage and do not create a hosting bill merely from running the application locally. Network traffic to third-party services can still be subject to those services' own limits or terms.

## Rights

Free access, open-source software, public-domain content, and permission to redistribute a book/media item are distinct concepts. The encyclopedia never treats a freely viewable web item as automatically free to mirror or redistribute.

## Resilience rule

For every critical artifact:

`canonical source -> verified manifest -> mirror A -> mirror B -> offline package -> checksum -> restore test`

No single vendor is authoritative for the encyclopedia's continued availability.
