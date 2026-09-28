# Global Cross-Device Display Federation 2026

The encyclopedia's display federation is a presentation/infrastructure layer for TVs, computers, projectors, phones, tablets and compatible receivers.

## Candidate paths

Miracast/MiracleCast, AirPlay/UxPlay, Cast adapters, Screen Capture/WebRTC, scrcpy and Sunshine/Moonlight are registered as candidates only. Registration does not prove installation or device support.

## Capability-first negotiation

A route is selectable only after a concrete device capability is verified. Resolution negotiation uses the minimum verified capability between source and destination. `native`, `4K`, `8K`, `10K`, `12K`, `16K`, `24K` and `future` describe capabilities/assets, not universal promises.

## Browser capture

`getDisplayMedia()` is an optional consent-gated route. Browser support is not assumed to be universal, so the federation does not rely on it as its only path.

## Security and privacy

Display sessions require explicit user consent. Local discovery is preferred. The layer does not expose screens to the public internet automatically, install software, or silently activate privileged services.

## Free-first and separation

No paid API is required by the core. External platforms remain optional adapters. The layer does not modify Corpus content, add scientific authority, or become a dependency of Rechercher acquisition.

## Clean-build rule

No display client, driver, server, bridge or remote-control package is installed by this layer in CI or at runtime.
