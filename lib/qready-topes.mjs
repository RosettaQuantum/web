// Los topes del alta de Q-Ready Verified (24-nov-2026), en un módulo PURO: los usa lib/qready-verificado.mjs
// (que abre sockets) y los lee api.js para la descripción de las herramientas MCP sin importar sockets.
// Por qué existen: ver iniciarPedido() en lib/qready-verificado.mjs.
export const TOPES_ALTA = Object.freeze({ dominio_hora: 3, origen_minuto: 5, origen_hora: 10 });
export const VIGENCIA_TOKEN_HORAS = 72;
