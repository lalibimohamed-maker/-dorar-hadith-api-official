# Verified zero-cost facts used by the encyclopedia

This document records corrections applied after external verification.

## Facts

- GitHub Pages is available for public repositories on GitHub Free, but published Pages sites are limited to 1 GiB and have a soft 100 GiB/month bandwidth limit. It is therefore unsuitable as a promise of unlimited global media delivery.
- GitHub Releases support versioned release assets; each asset must remain under the documented per-file limit. Release assets are therefore appropriate for selected bundles, not a claim of unlimited hosting.
- Git LFS on GitHub Free currently includes 10 GiB storage and 10 GiB bandwidth per month; exceeding free quota can block further LFS use when no paid budget is enabled. LFS must not be treated as unlimited free storage/distribution.
- Apple Developer Program membership is currently USD 99 per year for store distribution, with fee-waiver eligibility for qualifying nonprofits, accredited educational institutions and government entities. PWA access does not require Apple Developer membership.
- F-Droid is a free, community-run Android repository for free/open-source software, with an inclusion process and build/review requirements. It can be a secondary Android distribution route.

## Consequence for the project

The encyclopedia therefore adopts **zero-cost-first**, not **zero-cost-by-declaration**:

`local/open-source -> free public infrastructure within documented limits -> multiple mirrors -> offline bundles -> optional community-provided paid channels`

The user-facing core remains free, while the project never promises an unlimited service from a third-party provider whose published limits do not support that promise.
