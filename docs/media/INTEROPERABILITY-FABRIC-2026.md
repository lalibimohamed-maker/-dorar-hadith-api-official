# Open Interoperability Fabric — 2026

This layer defines how the Din Allah Encyclopedia can combine independent open-source components without becoming dependent on a single vendor.

## Core fabric

- Apache NiFi: dataflow routing, transformation, mediation and provenance.
- Eclipse Ditto: policy-controlled digital-twin representation and connectivity.
- NATS: lightweight messaging between services and edge/runtime components.
- OpenUSD + glTF: interoperable 3D scene and asset exchange.
- Real-ESRGAN, Video2X and FFmpeg: governed media-processing path.
- MediaMTX: live-media protocol routing.

Apache NiFi provides directed dataflow graphs and detailed provenance for objects moving through a flow. citeturn958022search1turn958022search14

Eclipse Ditto provides JSON-based digital twins and protocol mappings across WebSocket, MQTT, HTTP, AMQP and Kafka, with policy-controlled read/write access. citeturn958022search5turn958022search13

NATS provides an open messaging fabric suitable for request/reply, pub/sub and streaming, and its server is distributed under Apache-2.0. citeturn553266search11turn553266search14

## Selection and replacement policy

A newer component may be proposed when it demonstrates an improvement in security, quality, performance, interoperability, maintenance, or licensing suitability.

The system must compare the candidate against the currently active component before proposing replacement. Discovery is automatic; installation and promotion are gated.

## Ownership and provenance boundary

The encyclopedia may integrate, configure and compose open-source components, but it does not acquire proprietary source code, private data, credentials, or hidden copies of closed systems. Upstream licenses, copyright notices and attribution remain intact.

Derived artifacts created by the pipeline can be owned by the encyclopedia where legally permitted, while provenance records identify the upstream components and processing chain.

## Free-cost requirement

The preferred deployment path uses self-hostable open-source software without mandatory subscription fees. This is a cost objective, not a promise that every future upstream release will remain free forever. Every future update must re-check its license and dependency terms before activation.

## Safety

No interoperability component may silently modify trusted Corpus, scholarly source text, rights/provenance records, protected branches, or security policy. Unknown software remains untrusted until validated.
