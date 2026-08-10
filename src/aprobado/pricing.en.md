# Approved text — `/pricing`

Este archivo NO se escribe a mano dos veces. Es la columna inglesa de
`pricing-en-tabulado.md` —el documento que Nicholas aprobó— puesta en la misma forma
que `pricing.es.md` para que el armador la lea con el mismo código.

**Cada fragmento de abajo se verifica contra el tabulado antes de generar la página**
(`build-pricing.mjs` aborta si alguno no aparece allí, palabra por palabra). Así una
letra cambiada en el viaje no llega a producción: es la contraparte inglesa del sha
que ancla la cara española.

Única desviación deliberada, y es de formato, no de contenido: los miles van con coma
inglesa (**US$24,900**, no US$24.900). En una página de precios en inglés, «US$24.900»
se lee como veinticuatro con nueve, un error de mil veces sobre el precio. El
verificador normaliza los separadores antes de comparar, así que la comprobación sigue
siendo palabra por palabra en todo lo demás.

---

## El texto propuesto

### Header

> **We measure under seal. We publish the negatives.**
> What you buy is a measurement you can check without asking us: every delivery comes with its hash, anchored in Bitcoin and published in three independent copies.
>
> Today our archive reports **0 measured quantum wins**. That number is on this page because it is the product, not a defect.

### Table

| | what you get | price |
|---|---|---|
| **Evidence** | The full archive over API and MCP: sealed runs, verdicts, pre-registrations. No key, no sign-up. | **US$0**, always |
| **Exploration** | One target. Connectivity matrix, ranked candidate sites, and the seal to verify it. Delivered in 48 h. | **US$490** |
| **Full experiment** | Your problem measured end to end: quantum run, classical run at the same budget, statistical null, permutation test, and a verdict published in the archive. Pre-registered before we run. | **US$4,900** |
| **Monitor** | Periodic re-runs and an alert when something changes for your problem class. | **US$290/mo** |
| **Measurement Program** | The full challenge format for your company: five sealed experiments on your instances, a strong classical baseline, and a quarter of monitoring. It is what Cleveland Clinic, Airbus, E.ON, HSBC and VW are asking for in their public challenges — run for you, on your problems. | **US$24,900** |

### Q-Ready — cryptographic exposure

> For organizations that need to know how exposed they are by the cryptography they run today.

| | what you get | price |
|---|---|---|
| **Cryptographic Exposure Map** | Your public surface discovered and measured: hostnames, cryptography per endpoint, providers detected. | **US$0** |
| **Migration Starter Kit** | The map, plus the critical path —which provider sets your deadline—, where you stand against your sector, and a 30/90/365-day plan derived from your own findings. | **US$4,900** |

### Why these prices

> Our compute costs almost nothing: on the order of a thousand analyses per dollar, and we measure it.
> The price does not come from our cost — it comes from what the alternative costs.
>
> The alternative to a sealed experiment is a week of a specialized consultant. The alternative to a Starter Kit is a questionnaire-based assessment: we reviewed ~35 publications from the large consultancies and sector bodies — **none measured, all asked**.
>
> What we charge for is the measurement, and the proof that we made it.

### What we do not sell

> - **We do not sell quantum advantage.** Today our archive measures zero, and we publish it.
> - **We do not certify or accredit** anything, to anyone.
> - **We do not do regulatory compliance.**
> - **We do not promise a result.** We promise an honest measurement, and we charge you for it just the same if the result is that your problem gains nothing here. That "no" saves you the budget you were about to spend finding out.

### How to buy and how refunds work

> Paid work is arranged with us: there is no self-service, because every measurement is designed with the client and reviewed before it is sealed.
>
> **Full refund** if we do not deliver within the agreed term, or if the seal we deliver does not verify. No refund on the result: you pay for the measurement, not for the verdict.
>
> Write to us at **hello@rosettaquantum.com**.
> Sold by Blue Tuna SpA through Paddle.com, acting as the merchant of record.

---

## Nota

La frase del cómputo aparece aquí porque ya está instrumentada
(`costos.analisis_por_dolar()`, quantum-run 23f2d3e). En la cara española va con la
redacción que Nicholas aprobó; ésta es su traducción literal.
