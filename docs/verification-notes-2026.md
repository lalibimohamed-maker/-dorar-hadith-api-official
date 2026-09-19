# Verification Notes

External claims used in this feature were checked against current primary documentation.

- GitHub Pages is available to public repositories on GitHub Free, but its published-site limit is 1 GiB and its soft bandwidth limit is 100 GiB/month. It is therefore used for the web shell/light assets, not as an unlimited media CDN.
- GitHub LFS on GitHub Free includes 10 GiB storage and 10 GiB monthly bandwidth; this is a quota, not unlimited delivery.
- GitHub Releases allow release assets up to 2 GiB per file; this is useful for versioned bundles but not a claim of unlimited storage or bandwidth.
- Apple Developer Program membership is USD 99/year for App Store distribution unless a qualifying fee waiver applies. A free Apple Developer account remains useful for development/testing, so App Store distribution is an optional channel.
- F-Droid is a community-run free/open-source Android repository with an inclusion/review process, making it a useful secondary Android path.
- Internet Archive is included only as a candidate external preservation/distribution target; current terms, rights, item status and retention expectations must be checked at integration time.

The engineering policy therefore uses the phrase **zero-cost-first** rather than claiming **absolute zero cost forever**.
