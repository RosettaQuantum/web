// Los comandos de /api-docs, en UN solo lugar.
//
// Existen aparte porque la pagina tiene dos caras y un comando no se traduce: si el
// espanol y el ingles los escriben por separado, divergen — y una promesa que falla
// solo para la mitad de los lectores falla justo en la pagina cuyo argumento entero
// es que todo se puede comprobar. Los comentarios (#) SI van en cada idioma y por eso
// no viven aca: son texto, no comando.
//
// Extraidos del original ingles por script y EVALUADOS, no copiados del fuente: el
// fuente trae \\ donde el valor lleva \, y un comando con la barra doble no corre.
export const SITE = "https://rosettaquantum.com";

export const ARRANQUE_CMD = [
  "curl -s https://rosettaquantum.com/v1/state",
  "curl -s https://rosettaquantum.com/v1/archive/PR-CLEV-001",
  "curl -s https://rosettaquantum.com/v1/archive/PR-CLEV-001 \\\n| python3 -c '\nimport sys,json,hashlib,urllib.request\nd=json.load(sys.stdin)\nraw=json.load(urllib.request.urlopen(d[\"github_raw\"]))\nmeta={k:v for k,v in raw[\"meta\"].items() if k!=\"content_hash\"}\nbody={k:v for k,v in raw.items() if k not in (\"meta\",\"storage\")}\nmine=\"sha256:\"+hashlib.sha256(\n    json.dumps({\"meta\":meta,**body},sort_keys=True,ensure_ascii=False).encode()).hexdigest()\nprint(mine); print(d[\"content_hash\"])\nprint(\"MATCH\" if mine==d[\"content_hash\"] else \"MISMATCH\")'",
];

export const ARRANQUE_AGENTES_CMD = [
  "curl -s https://rosettaquantum.com/v1/openapi.json",
  "curl -s -X POST https://rosettaquantum.com/mcp \\\n  -H 'content-type: application/json' \\\n  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'",
];

export const SELLO_FORMULA = "content_hash = sha256( json.dumps({\"meta\": meta_without_content_hash, <body>},\n                                  sort_keys=True, ensure_ascii=False) )";

export const VERIFICAR_CMD = "F=$(curl -s https://rosettaquantum.com/v1/archive/V-0012)\necho \"$F\" | jq -r .content_hash\ndiff <(curl -s \"$(echo \"$F\" | jq -r .github_raw)\") \\\n     <(curl -s \"$(echo \"$F\" | jq -r .codeberg_raw)\") && echo IDENTICAL";

export const MCP_CMD = "curl -X POST https://rosettaquantum.com/mcp -H 'content-type: application/json' \\\n  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'";
