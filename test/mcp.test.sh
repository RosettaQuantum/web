#!/bin/bash
# Ejerce el MCP por su propio camino: hablandole JSON-RPC por stdio, como un agente.
# Un servidor que solo se prueba importando sus funciones no esta probado.
#
# OJO con lo que este archivo NO prueba, y por que: el rechazo que NOMBRA el campo que
# sobra no se puede ejercer aqui, porque con las recetas reales el Compilador para antes,
# en la compuerta de 'sellable'. Eso no es un hueco de la prueba: es el estado del
# producto, y esta cubierto en test/compilador.test.mjs con una receta vendible de
# laboratorio. Poner una receta vendible falsa en recetas/ para que esta prueba pasara
# seria meter en el catalogo algo que no existe.
cd "$(dirname "$0")/.."
SALIDA=$(printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"listar_recetas"}}' \
 '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"validar_pedido","arguments":{"receta":"RQ-M1-QKSVM","params":{"datasets":["Iris"],"esto_no_existe":123}}}}' \
 '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"validar_pedido","arguments":{"receta":"RQ-NO-EXISTE","params":{}}}}' \
 '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"ver_receta","arguments":{"id":"RQ-M1-QKSVM"}}}' \
 | node mcp/servidor.mjs)
fallos=0
chk(){ if echo "$SALIDA" | grep -q "$1"; then echo "  ok    $2"; else echo "  FALLA $2"; fallos=$((fallos+1)); fi; }
nochk(){ if echo "$SALIDA" | grep -q "$1"; then echo "  FALLA $2"; fallos=$((fallos+1)); else echo "  ok    $2"; fi; }

chk 'rosetta-compilador'      'initialize responde con el nombre del servidor'
chk 'validar_pedido'          'tools/list expone validar_pedido'
chk 'Ninguna receta esta en estado'  'listar_recetas avisa que nada es pedible'
chk 'RECIPE_NOT_SELLABLE'     'con la receta real para en la compuerta de vendible'
chk 'ficha de requisitos'     'y el rechazo dice QUE le falta, no solo que no se puede'
chk 'UNKNOWN_RECIPE'          'receta inexistente: rechazo propio'
chk 'params_schema'           'ver_receta devuelve la ficha entera'
# EL CASO QUE SE CALLA: ninguna respuesta puede dar a entender que algo quedo corriendo.
nochk '"status": *"queued"'   'ninguna respuesta dice que algo quedo encolado'
chk 'Ejecutar no existe todavia' 'cada respuesta declara que no ejecuta'
echo "  --- fallos: $fallos"
exit $fallos
