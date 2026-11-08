<!-- translation_of: examples/mcp-session/README.md source_hash: 1c9443c6195b1f9f -->
# Une session MCP avec curl

Ce script dialogue avec le point d’accès MCP de barrel_server comme le
fait un agent, un message JSON-RPC à la fois : il initialise une
session, liste les outils, crée une base, écrit et lit des documents,
exécute une requête BQL et une recherche par sous-chaîne, puis termine
la session. Il affiche chaque requête et le résultat d’outil reçu.
Utilisez-le pour voir le format échangé avant de connecter un client
MCP, ou pour tester un serveur que vous avez déployé.

## Prérequis

- Un barrel_server en marche (1.13 ou plus récent). Depuis une copie du
  dépôt barrel :

  ```sh
  rebar3 as server compile
  rebar3 as server shell
  ```

  Le shell démarre barrel_server sur le port 8080, sans authentification.
- curl et jq.

## Exécuter

```sh
BARREL_URL=http://localhost:8080 ./run.sh
```

Sur un serveur avec authentification bearer, définissez aussi
`BARREL_TOKEN`. Le script supprime et recrée la base `mcp_demo` (en
REST) pour que chaque exécution parte de zéro.

## Ce que montre l’exemple

- `POST /mcp` avec `initialize` renvoie l’identifiant de session dans
  l’en-tête de réponse `mcp-session-id` ; chaque requête suivante le
  renvoie, avec `mcp-protocol-version: 2025-06-18`.
- `initialize` et `tools/list` répondent en JSON simple ; `tools/call`
  répond en server-sent events (`data: {...}`). Le script garde le JSON.
- Un résultat d’outil est un document JSON dans le contenu texte. Un
  appel en échec reste un résultat, avec `isError: true`, par exemple
  `{"error":"not_found"}`.
- `DELETE /mcp` termine la session (204).

## Notes

- `ngram_search` trouve des sous-chaînes exactes sans configuration
  supplémentaire. `search` en mode `bm25` ou `hybrid` nécessite BM25 ou
  un embedder configuré sur la base ; sur un serveur par défaut, il
  renvoie un résultat d’erreur.
- `/mcp` n’accepte que des jetons bearer (un jeton serveur ou un jeton de
  capacité), pas les requêtes signées ni mTLS.

## Sortie attendue

Les requêtes et les résultats, dans l’ordre. La sortie d’une exécution
réelle se trouve dans `expected.txt` ; l’identifiant de session et les
révisions changent à chaque exécution.
