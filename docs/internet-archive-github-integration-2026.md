# GitHub ↔ Internet Archive Integration Plan

## Verified position

There is no assumption here that a GitHub account can be directly linked to an Internet Archive account as a native identity integration. Treat the two accounts as separate trust domains.

## Recommended architecture

`GitHub main/PR -> validated release manifest -> CI export -> Internet Archive item`

The GitHub repository remains the source of code/configuration and the canonical provenance manifest. Internet Archive, when used, is an external preservation/distribution target for legally redistributable artifacts.

## Credentials

- Keep Internet Archive credentials outside Git history.
- Store secrets only in the repository's protected secret mechanism or an equivalent external secret manager.
- Use a dedicated Archive account or dedicated credentials for automation where supported.
- Never place an Archive access key, secret key, session token, or password in JSON, source code, README files, artifacts, or public logs.
- Use least privilege and rotate credentials after any suspected exposure.

## Item manifest

Every uploaded item should carry:

- stable item identifier
- source URL
- canonical source identifier
- content hash/checksum
- source publication date when known
- retrieval timestamp
- license/rights status
- redistribution decision
- version/revision
- generator/build identifier
- relationship to the Git commit/release

## Upload gate

An Archive upload must be rejected when:

- rights are unknown or incompatible;
- provenance is incomplete;
- the artifact was not generated from an approved release;
- checksum generation failed;
- source content changed without a corresponding review;
- the target item would violate Archive terms or the rights holder's conditions.

## No automatic scientific authority

Publishing a file to Internet Archive does not make its contents scientifically authenticated. Archive is a storage/distribution location; the scholarly status is determined by the encyclopedia's evidence and review layers.

## Disaster recovery

Maintain an independent manifest of all external items so that a lost or withdrawn Archive item can be detected and, where rights permit, reconstructed from the canonical source and another permitted mirror.
