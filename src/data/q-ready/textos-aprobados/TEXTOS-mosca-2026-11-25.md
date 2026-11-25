# Textos provisorios · gráfico «Sume los años» (/es/q-ready, /q-ready)

Generado por `node scripts/textos-mosca.mjs` desde `src/lib/mosca-textos.mjs`. **Ninguno está aprobado.**
Los textos que el gráfico ya tenía (Migrar, Seguir secreto, Amenaza, «necesita protección hasta ‹año›», la
descripción y el pie) no cambian y siguen en `src/lib/puerta-textos.mjs`.

Marcadores: ‹año› = hasta cuándo necesita protección; ‹h› = año del horizonte; ‹p› = rótulo publicado de la
encuesta («≥51%»).

| clave | español | inglés |
|---|---|---|
| `etSecreto` | Años que sus datos deben seguir secretos | Years your data must stay secret |
| `etMigracion` | Años que le toma migrar | Years it takes you to migrate |
| `anioUno` | 1 año | 1 year |
| `tarde` | Ya va tarde. | You are already late. |
| `aTiempo` | Llega a tiempo. | You are on time. |
| `lineaTarde` | Necesita protección hasta ‹año›. Hacia ‹h›, los expertos ya estiman ‹p›. | You need protection until ‹año›. By ‹h›, experts already estimate ‹p›. |
| `lineaMasAlla` | Necesita protección hasta ‹año›, más allá del último horizonte que mide la encuesta (‹h›: ‹p›). | You need protection until ‹año›, beyond the last horizon the survey measures (‹h›: ‹p›). |
| `lineaATiempo` | Necesita protección hasta ‹año›, antes del primer horizonte que estima la encuesta (‹h›: ‹p›). | You need protection until ‹año›, before the first horizon the survey estimates (‹h›: ‹p›). |
| `reset` | Volver al perfil de ejemplo | Back to the example profile |
| `sinEstimacion` | sin estimación | no estimate |
| `tablaCaption` | Probabilidad estimada de la amenaza, por horizonte | Estimated probability of the threat, by horizon |
| `tablaHorizonte` | Horizonte | Horizon |
| `tablaProb` | Probabilidad estimada | Estimated probability |

**Criterio del veredicto (también por aprobar):** «Ya va tarde» si el año hasta el que necesita protección llega
al primer horizonte que estima la encuesta; «Llega a tiempo» si vence antes.
