# Fuentes de la regla de la llave (RQ.S.02.1, QEX-1.2) · 18-nov-2026

Extractos copiados POR SCRIPT del texto de cada fuente (nunca tipeados). Las huellas son de los archivos de
los que se extrajeron. Los usa `public/js/qex-nucleo.mjs` (REGLAS_CERTIFICADOS, fuerzaClasica) y
`lib/informe-envivo.mjs` (ML_DSA). `scripts/check-rubrica-qex.mjs` exige que cada norma citada siga aquí.

## 1. NIST IR 8547, versión final (octubre de 2026), tabla 2 y tabla 3

PDF `ir8547.pdf`, sha256 `3049cdfdd7c20417cf588a3d55ace6e8813982d1499502b7ef69e9593b2dc280`; texto extraído `ir8547.txt`, sha256 `9e8e714e3fbda0a2d0cc10b310db5b2f3f2269093075262c5c73e69a0109013f`, líneas 680-722:

```
Table 2 lists currently approved quantum-vulnerable digital signature algorithm standards and 
their deprecation and disallowance timelines.  
Table 2. Quantum-vulnerable digital signature algorithms 
NIST’
s long-term cryptographic algorithm transition plans are outlined in SP 800-57pt1 (Part 1) 
[SP80057]. These guidelines had projected that NIST would disallow public-key schemes that 
provide 112 bits of security on January 1, 2031. However, based on the need to migrate to 
quantum-resistant algorithms during this time frame, NIST will instead deprecate all quantum-
vulnerable digital signature algorithms after 2030 and disallow their use under NIST standards 
and guidelines after 2035. Organizations may continue using these algorithms and parameter 
sets as they migrate to the post-quantum signatures identified in Table 3. For federal high value 
assets, high impact systems, and other systems prioritized under OMB Memorandum M-26-15 
[OMB2615], the continued use of these deprecated algorithms is constrained by the earlier 
migration deadlines established under EO 14412 [EO14412]. 
Digital Signature 
Algorithm Family Parameters Transition
ECDSA 
[FIPS186] ≥ 112 bits of classical security strength Deprecated after 2030 
Disallowed after 2035 
EdDSA 
[FIPS186] ≥ 128 bits of classical security strength Deprecated after 2030 
Disallowed after 2035 
RSA 
[FIPS186] ≥ 112 bits of classical security strength Deprecated after 2030 
Disallowed after 2035 
NIST IR 8547 Transition to Post-Quantum 
October 2026 Cryptography Standards 
16 
Table 3. Post-quantum digital signature algorithms 
Digital Signature Algorithm 
Family 
Parameter Sets Classical Security 
Strength
Security Category 
ML-DSA
[FIPS204]
ML-DSA-44 128 bits 2 (see note ) 2
2 The security category for ML-DSA-44 is reduced to category 1 if an approved RBG with less than 192 bits of security is used. 
ML-DSA-65 192 bits 3 
ML-DSA-87 256 bits 5 
SLH-DSA 
[FIPS205] 
SLH-DSA-SHA2-128[s/f] 
```

## 2. NIST SP 800-57 parte 1 rev. 5, tabla 2 (fuerza clásica por tamaño de llave)

PDF de https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf, sha256 `cc32391022c1382ac7c91490f6bcc8838e0f889925270da23ef4e800e2ecb7ad`; texto extraído con pypdf, líneas 2871-2930 (páginas 67-68 del PDF):

```
Table 2: Comparable security strengths of symmetric block cipher and asymmetric-key 
algorithms 
Security 
Strength 
Symmetric 
Key 
Algorithms 
FFC 
(DSA, DH, 
MQV) 
IFC* 
(RSA) 
ECC* 
(ECDSA, 
EdDSA, DH, 
MQV) 
≤ 80 2TDEA 
L = 1024 
N = 160 
k = 1024 f = 160-223 
112 3TDEA68 
L = 2048 
N = 224 
k = 2048 f = 224-255 
 
 
68 Although 3TDEA is listed as providing 112 bits of security strength, its use has been deprecated (see SP 800-131A) 
through 2023, after which it will be disallowed for applying cryptographic protection. The use of a deprecated 
algorithm means that the algorithm or key length may be used if the risk of doing so is acceptable. 
=== pagina 68
NIST SP 800-57 PART 1 REV. 5  RECOMMENDATION FOR KEY MANAGEMENT: 
  PART 1 – GENERAL 
 55 
This publication is available free of charge from: https://doi.org/10.6028/NIST.SP.800-57pt1r5 
Security 
Strength 
Symmetric 
Key 
Algorithms 
FFC 
(DSA, DH, 
MQV) 
IFC* 
(RSA) 
ECC* 
(ECDSA, 
EdDSA, DH, 
MQV) 
128 AES-128 
L = 3072 
N = 256 
k = 3072 f = 256-383 
192 AES-192 
L = 7680 
N = 384 
k = 7680 f = 384-511 
256 AES-256 
L = 15360 
N = 512 
k = 15360 f = 512+ 
```

## 3. NIST CSOR, «Digital Signature Algorithms Registered Objects»: los OID de ML-DSA

https://csrc.nist.gov/projects/computer-security-objects-register/algorithm-registration, consultada el 18-nov-2026, HTML sha256 `b61e08e04b37fe9b208e34cabb20bb637f1fcbbf661111138cb53683c30c711f`. Líneas del texto de la página:

```
nistAlgorithms OBJECT IDENTIFIER ::= { joint-iso-ccitt(2) country(16) us(840) organization(1) gov(101) csor(3) nistAlgorithm(4) }
sigAlgs OBJECT IDENTIFIER ::= { nistAlgorithms 3 }
The following objects are for use with "pure" ML-DSA public keys and signatures:
id-ml-dsa-44 OBJECT IDENTIFIER ::= { sigAlgs 17 }
id-ml-dsa-65 OBJECT IDENTIFIER ::= { sigAlgs 18 }
id-ml-dsa-87 OBJECT IDENTIFIER ::= { sigAlgs 19 }
id-hash-ml-dsa-44-with-sha512 OBJECT IDENTIFIER ::= { sigAlgs 32 }
id-hash-ml-dsa-65-with-sha512 OBJECT IDENTIFIER ::= { sigAlgs 33 }
id-hash-ml-dsa-87-with-sha512 OBJECT IDENTIFIER ::= { sigAlgs 34 }
```

De ahí: nistAlgorithms = 2.16.840.1.101.3.4; sigAlgs = 2.16.840.1.101.3.4.3; id-ml-dsa-44/65/87 = 2.16.840.1.101.3.4.3.17/18/19; id-hash-ml-dsa-*-with-sha512 = .32/.33/.34. Comprobación independiente: una llave ML-DSA-65 generada con Node.js (OpenSSL 3.5) exporta su SPKI con el OID 2.16.840.1.101.3.4.3.18 (`scripts/check-rubrica-qex.mjs`).
