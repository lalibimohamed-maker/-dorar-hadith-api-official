# Open-Source Integration & Installation Policy — 2026

The encyclopedia prefers self-hostable open-source components with no mandatory subscription fee. Components are integrated by capability, not copied from proprietary products.

## Automatic lifecycle

`discover → identify upstream → verify release and provenance → verify license → security scan → compatibility benchmark → protected PR → independent review → deploy → monitor → re-evaluate`

Discovery can run automatically. Installation and promotion require verified evidence and the protected change process.

## Interoperability stack

Apache NiFi can manage data routing, transformation and provenance across systems. Eclipse Ditto can represent digital twins and connect them through WebSocket, MQTT, HTTP, AMQP and Kafka with policy-controlled access. NATS can provide low-latency messaging and streaming. OpenUSD provides an open 3D scene composition/interchange layer.

These roles are complementary, not redundant: NiFi is the dataflow plane; Ditto is the digital-twin/edge-state plane; NATS is the event/messaging fabric; OpenUSD/glTF are the 3D asset plane.

## Installation rule

Repository CI must never download and execute an unknown binary. A deployment installer may install only a component that has a recorded upstream, verified release, license decision, security result, checksum/signature evidence where available, and compatibility result.

A future release is never assumed to keep the same license. A paid-only or materially restricted successor is not silently substituted for an open component.

## Provenance and ownership

Combining and configuring open-source components does not transfer ownership of upstream code to the encyclopedia. The encyclopedia may own its original orchestration, configuration, documentation and independently created derived artifacts where law and the upstream license permit, while preserving required notices and attribution.

No process is allowed to create an untraceable copy of a proprietary system or remove evidence of origin.

## Resource-aware quality

The media pipeline may target 4K, 8K and 12K outputs, but output quality, latency and cost remain dependent on the actual hardware and input material. Benchmarks are required before promoting a new engine.
