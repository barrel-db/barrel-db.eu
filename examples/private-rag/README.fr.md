<!-- translation_of: examples/private-rag/README.md source_hash: 7426a123d6331530 -->
# Recherche privée dans vos connaissances

Ce projet construit la partie recherche d’une application RAG sur votre
propre machine. Il ingère dix articles de support dans une base en mode
enregistrement (chaque article reçoit son embedding et est indexé pour
la recherche par mots-clés dans la même écriture), lance une recherche
par mots-clés et une recherche hybride pour une question de client, peut
reclasser les passages avec un cross-encoder, et affiche le prompt que
votre application enverrait à son LLM. Rien n’appelle de LLM et, avec
l’embedder par défaut, rien ne quitte la machine.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake pour les dépendances natives (la première
  compilation prend quelques minutes).
- Pour `EMBEDDER=ollama` : Ollama sur localhost, avec
  `ollama pull nomic-embed-text`.
- Pour `RERANK=1` : un virtualenv Python avec `transformers` et `torch`
  (le modèle est téléchargé à la première utilisation).

## Exécuter

```sh
./run.sh                       # offline, deterministic
EMBEDDER=ollama ./run.sh       # real embeddings from Ollama
RERANK=1 RERANK_VENV=/path/to/venv ./run.sh
```

`run.sh` compile le projet, supprime `./data`, puis exécute
`private_rag:main/0` une fois.

## Ce que montre l’exemple

- `barrel:open/2` avec une politique `embedding` : les `fields` reçoivent
  un embedding, les `metadata_fields` sont conservés avec chaque vecteur
  pour filtrer.
- `barrel:put_docs/2` écrit l’article et son vecteur ensemble.
- `barrel:search_bm25/3` pour les mots-clés, et `hybrid_top_k` en BQL
  (vecteur et BM25, fusionnés par rang) filtré sur `area`.
- `barrel_rerank:rerank/3` réordonne les passages selon un score de
  cross-encoder (logits bruts, plus haut est meilleur).
- Le prompt : une consigne, les meilleurs passages avec leurs
  identifiants, la question.

## À propos des embedders

`EMBEDDER=hash` (par défaut) utilise `hash_embed`, un fournisseur
déterministe écrit pour cet exemple : il hache les mots sur 64
dimensions. Il trouve les passages qui partagent des mots avec la
question et ne comprend pas le sens, ses scores ne disent donc rien de
la qualité de la recherche. Il est là pour que l’exécution n’ait besoin
d’aucun modèle et donne la même sortie à chaque fois. `EMBEDDER=ollama`
utilise `nomic-embed-text` (768 dimensions) pour une vraie recherche
sémantique.

## Sortie attendue

`expected.txt` provient de l’exécution par défaut, `EMBEDDER=hash` sans
reclassement : le nombre d’articles, les résultats par mots-clés et
hybrides avec leurs scores, et le prompt. Avec Ollama ou le
reclassement, l’ordre et les scores changent. Les deux options ont été
exécutées une fois à la main (Ollama avec `nomic-embed-text`, le
reclassement avec `cross-encoder/ms-marco-MiniLM-L-6-v2`) ; elles ne font
pas partie de la vérification automatique, qui doit tourner hors ligne.
