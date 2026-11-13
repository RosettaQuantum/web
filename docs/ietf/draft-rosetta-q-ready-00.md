---
title: "A Well-Known URI for Declaring Post-Quantum Migration Readiness (q-ready)"
abbrev: "q-ready"
docname: draft-rosetta-q-ready-00
category: info
submissiontype: independent
ipr: trust200902
area: Security
workgroup: Independent Submission
keyword: [post-quantum, well-known, migration, security.txt]
stand_alone: yes
pi: [toc, sortrefs, symrefs]

author:
 -
    organization: Rosetta Quantum
    email: hello@rosettaquantum.com

normative:
  RFC2119:
  RFC8174:
  RFC8032:
  RFC8037:
  RFC7517:
  RFC8615:
  RFC8785:
  RFC3339:

informative:
  RFC9116:

--- abstract

This document defines the "q-ready" well-known URI. An organization publishes at it a short, signed
JSON document that declares who is responsible for its post-quantum cryptographic migration, the
status of its internal cryptographic inventory, a target migration date, and the status of its
critical providers by role. The document expires, like the Expires field of security.txt, and is
signed with Ed25519 so that a third party can verify that it was published by the holder of a key
served from the same domain.

--- middle

# Introduction

Organizations are asked, by regulators and by their own customers, whether they have a plan to migrate
away from cryptography that a cryptographically relevant quantum computer would break. Part of the
answer can be measured from outside (for example, whether a TLS endpoint accepts the X25519MLKEM768
hybrid key exchange). Most of it cannot: the internal inventory, the target date, and the status of
providers that are not directly observable.

"q-ready" gives organizations one place to declare that part, in a form that is machine readable,
dated, and signed, so that it can be cross-checked against outside measurement rather than taken on
trust. It is modeled on security.txt {{RFC9116}}.

## Requirements Language

{::boilerplate bcp14-tagged}

# The q-ready Document

The document is a JSON object served at `https://<domain>/.well-known/q-ready` {{RFC8615}} with media
type `application/json`. Clients MUST NOT follow redirects when retrieving it and MAY refuse documents
larger than 64 KiB.

The members are:

q_ready:
: REQUIRED. The string "0" for this version.

domain:
: REQUIRED. The domain name the document speaks for.

owner:
: OPTIONAL. A human-readable name of the responsible party.

contact:
: REQUIRED. A non-empty array of URIs using the "mailto" or "https" scheme.

inventory:
: REQUIRED. An object with member "status", one of "complete", "in_progress" or "not_started", and
  OPTIONAL member "as_of", a full-date as defined in {{RFC3339}}.

migration:
: REQUIRED. An object with member "target_date", a full-date {{RFC3339}}.

providers:
: REQUIRED. An array, possibly empty. Each element has "role" (one of "edge", "certificates", "email",
  "payments", "identity", "hosting", "other"), "status" (one of "pq_hybrid", "planned", "classical",
  "unknown") and OPTIONAL "target_date". Providers are identified by role only.

expires:
: REQUIRED. A date-time {{RFC3339}} in UTC ("Z"). A document whose "expires" is in the past is stale.
  It SHOULD be less than one year in the future and verifiers MAY reject documents that expire more than
  366 days after retrieval.

signature:
: REQUIRED. An object with members "alg" (the string "Ed25519"), "kid" (a key identifier), "keys" (an
  https URI on the same domain or a subdomain, where a JSON Web Key Set {{RFC7517}} is served) and
  "value" (the signature, base64url without padding).

Numbers that are not integers MUST NOT appear in version 0 documents. Unknown members MAY appear and are
covered by the signature.

# Signature

To sign, the publisher removes "signature.value" from the document, serializes the remainder with the
JSON Canonicalization Scheme {{RFC8785}}, and signs the UTF-8 octets with Ed25519 {{RFC8032}}. The
64-octet signature is encoded in base64url without padding and placed in "signature.value".

The public key is published in the JSON Web Key Set at "signature.keys" as an OKP key with curve
"Ed25519" {{RFC8037}} and the same "kid".

To verify, a client retrieves the document and the key set, checks that every REQUIRED member is
present and well formed, that "expires" is in the future, and that the signature verifies over the
canonical serialization with the key whose "kid" equals "signature.kid".

# Cross-Checking

A valid signature shows that the holder of the key published the declaration; it does not show that the
declaration is true. Verifiers SHOULD compare declared provider status with what can be measured from
outside and SHOULD report a mismatch (for example, an "edge" declared "pq_hybrid" whose TLS endpoint does
not accept a hybrid post-quantum key exchange).

# Security Considerations

The key set is served from the same domain as the document. An attacker who controls the web origin can
replace both; the signature protects the document once it has been copied elsewhere and binds it to a
key, but it does not add trust beyond control of the origin. Publishers MAY additionally anchor the key in
DNS; such anchoring is out of scope for version 0.

The document discloses migration plans and provider roles. Publishers SHOULD declare roles only and avoid
naming vendors or internal systems.

# IANA Considerations

This document requests registration of the well-known URI suffix "q-ready" in the "Well-Known URIs"
registry {{RFC8615}}:

URI suffix:
: q-ready

Change controller:
: Rosetta Quantum

Specification document:
: This document

Status:
: provisional

--- back

# Acknowledgments
{:numbered="false"}

The structure follows security.txt {{RFC9116}}.
