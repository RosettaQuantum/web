# El Compilador por MCP

Un agente puede preguntarle a Rosetta **qué experimentos se pueden pedir, qué parámetros
acepta cada uno, y si un pedido concreto es válido** — sin correr nada y sin gastar nada.

Este servidor **compila y valida. No ejecuta.** Ejecutar todavía no existe: es la segunda
mitad del puente (SPEC-04, pieza P2) y depende de una decisión abierta sobre qué ejecutor
dispara la corrida (D-1). Cada respuesta lo declara en su propio cuerpo, para que un agente
no pueda confundir un plan con una corrida.

## Instalación

No tiene dependencias: sólo Node. Habla JSON-RPC 2.0 por stdio.

```bash
npm run compilador:mcp        # lo levanta en este repo
```

Para registrarlo en un cliente MCP:

```json
{
  "mcpServers": {
    "rosetta-compilador": {
      "command": "node",
      "args": ["mcp/servidor.mjs"],
      "cwd": "/ruta/a/este/repo"
    }
  }
}
```

## Prueba de humo

Dos líneas por stdio. Si el servidor está sano, la primera devuelve su nombre y la segunda
las tres herramientas:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node mcp/servidor.mjs
```

Salen dos líneas JSON-RPC completas. Lo que hay que mirar dentro de ellas:

```
linea 1 → result.serverInfo  {"name":"rosetta-compilador","version":"0.1.0"}
linea 2 → result.tools[].name  listar_recetas · ver_receta · validar_pedido
```

La prueba completa —nueve comprobaciones ejercidas por stdio, incluida una que verifica que
ninguna respuesta diga que algo quedó encolado— corre con:

```bash
npm run compilador:test
```

## Las tres herramientas

| herramienta | para qué |
|---|---|
| `listar_recetas` | qué se puede pedir hoy y en qué estado está cada receta |
| `ver_receta` | la ficha entera: parámetros, qué devuelve, si puede emitir veredicto, y lo que declara que **no** va a cumplir |
| `validar_pedido` | compila un pedido: devuelve el `config` que correría el ejecutor, o lo rechaza **nombrando cada campo** |

## Un pedido rechazado

Hoy, contra el servidor real, cualquier pedido para la única receta cargada se detiene antes
de mirar los parámetros, porque la receta no es vendible todavía — y el rechazo dice **qué le
falta**, no sólo que no se puede:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"validar_pedido","arguments":{"receta":"RQ-M1-QKSVM","params":{"datasets":["Iris","Titanic"],"qpu":true}}}}' | node mcp/servidor.mjs
```

```json
{
  "status": "rejected",
  "code": "RECIPE_NOT_SELLABLE",
  "http": 409,
  "reason": "that recipe exists but cannot be ordered yet",
  "recipe": "RQ-M1-QKSVM",
  "state": "measuring",
  "missing": "Le faltan la ficha de requisitos, la plantilla de informe y la tarifa medida (SPEC-05 §5, objetos 10a, 10b y 11).",
  "aviso_del_servidor": "Esto compila y valida. Ejecutar no existe todavia (SPEC-04 P2, decision D-1)."
}
```

**Los dos ejemplos que siguen están simulados, y aquí se declara cómo:** se llama al módulo
directamente con la receta marcada `sellable`, porque ninguna receta lo está todavía y por
el servidor real no hay forma de pasar de esa compuerta. Las salidas son reales —copiadas de
la corrida, no escritas a mano—, y es el mismo módulo que usan el servidor y la landing;
lo garantiza un chequeo que compara los bytes (`npm run check:compilador-copia`).

### Rechazado nombrando cada campo

Tres defectos en un pedido: un campo que la receta no acepta, un valor fuera del enumerado, y
la semilla cambiada —que está congelada por el pre-registro, porque cambiarla es otro
experimento, no el mismo con otra semilla—:

```json
{
  "status": "rejected",
  "code": "INVALID_PARAMS",
  "http": 422,
  "detail": "Every offending field is named below. Nothing was queued and nothing was charged.",
  "fields": [
    { "campo": "qpu", "problema": "esta receta no acepta este campo",
      "acepta": ["datasets","familias","C_grid","gammas","repeticiones","semilla","contexto"] },
    { "campo": "datasets[1]", "problema": "no es uno de [\"Iris\",\"Tae\",\"Penguin\",\"Glass\",\"Ecoli\",\"Vowel\"]" },
    { "campo": "semilla", "problema": "tiene que ser exactamente 20261026" }
  ]
}
```

### Aceptado

Un pedido válido devuelve el `config` completo —**con los defaults aplicados y declarados**,
para que nadie tenga que adivinar qué se rellenó— y dice en su propio cuerpo que no ejecutó:

```json
{
  "status": "plan",
  "recipe": "RQ-M1-QKSVM",
  "recipe_version": 1,
  "config": {
    "datasets": ["Iris","Tae"], "familias": ["FQK"], "contexto": true,
    "C_grid": [0.01,0.1,1,10,100,1000], "gammas": [0.125,0.5,2,8],
    "repeticiones": 10, "semilla": 20261026
  },
  "defaults_applied": ["C_grid","gammas","repeticiones","semilla"],
  "emits": "VERDICT",
  "arbiter": "juez-v1",
  "gates": ["C2","C3","C5","C6","C7","C8","C9"],
  "not_executed": "compiled only: no work was queued, no quota was consumed and nothing was written",
  "estimated_cost": null,
  "why_no_cost": "no measured tariff exists yet; an invented cost is worse than none"
}
```

`estimated_cost` es `null` a propósito. **No hay tarifa medida**, y una cifra inventada es
peor que ninguna: viajaría como una medición. Cuando la tarifa exista, el campo la trae.

## Su punto ciego, declarado

Valida el **pedido**, no el resultado. Que un pedido compile no dice nada sobre si el
experimento va a encontrar algo: la corrida M1, con una receta de esta misma familia, dio
«ventaja no distinguible en 6 de 6». Un plan válido es un plan, no una promesa.
