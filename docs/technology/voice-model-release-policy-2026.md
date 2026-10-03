# Voice model release policy

Large voice-model binaries are never committed to Git. They are published only as GitHub Release assets after checksum and provenance validation. GitHub currently permits up to 1000 assets per release and each release asset must be under 2 GiB (see GitHub's About releases documentation).

A model is release-eligible only when the model-specific license/redistribution terms are recorded. The Apache-2.0 license of a runtime repository is not, by itself, proof that every pretrained model artifact may be redistributed.

The Al-Huda wake-word model remains a separate build target: no public Release asset is declared until a trained Arabic model for **الهُدَى** exists and inference evidence is recorded.
