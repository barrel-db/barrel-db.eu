---
title: barrel-lite (client navigateur)
description: Un client TypeScript qui garde un store de documents offline-first dans le navigateur et le synchronise avec un barrel_server.
---

`barrel-lite` est un client TypeScript qui garde un store de documents local
offline-first dans le navigateur et le synchronise avec un `barrel_server` via le
protocole `/db/:db/_sync/*`. C'est un client de protocole, pas un portage WASM :
il reimplemente les codecs HLC, version et vecteur de version octet pour octet,
estampille les mutations locales avec son propre id de source, et traite les
donnees locales comme un cache (Safari les evince) avec la synchronisation comme
histoire de durabilite. Lisez ceci quand vous voulez qu'une application web lise
et ecrive une base de donnees barrel hors ligne et converge avec le serveur. Le
paquet vit dans l'umbrella a `clients/barrel-lite`.

## Quand l'utiliser

- Une application web a besoin de lectures et d'ecritures locales qui continuent
  de fonctionner hors ligne.
- Vous voulez que les changements convergent avec le serveur (et les autres
  onglets) automatiquement.
- Vous depassez un seul onglet : un writer par origine, les autres suivent.

## Configuration du serveur

Le navigateur a besoin de deux choses que le serveur n'active pas par defaut :
CORS, et un jeton qu'il peut reellement expedier. Configurez les deux dans l'app
env de `barrel_server`.

```erlang
{barrel_server, [
    {cors, #{origins => '*',              %% or a list of origins
             expose => [<<"x-barrel-hlc">>]}},   %% default; needed for the clock
    {auth, #{tokens => [<<"global-token">>]}}
]}
```

Un navigateur ne peut pas expedier le jeton global. Emettez plutot un jeton de
capacite par espace (voir [espaces](/fr/docs/server/spaces)) ; il authentifie
seulement les routes `/db` et `/handoffs` de cet espace, avec `read` couvrant la
branche pull et `write` la branche push.

```console
$ curl -XPOST host:8080/spaces -H 'authorization: Bearer global-token' \
    -H 'content-type: application/json' -d '{"label":"app"}'
# {"space":"sp_...", ...}
$ curl -XPOST host:8080/spaces/sp_.../grants -H 'authorization: Bearer global-token' \
    -H 'content-type: application/json' -d '{"rights":["read","write"]}'
# {"token":"bsp_...", ...}
```

## Comment (ouvrir, lire, ecrire)

```ts
import { Database } from "barrel-lite";

const db = await Database.open("notes", {
  remote: { url: "https://edge.example:8080", db: "sp_...", token: "bsp_..." },
  multiTab: true,
});

await db.put({ id: "n1", title: "hello" });
const doc = await db.get("n1");     // { id: "n1", title: "hello" }
await db.remove("n1");
```

`db` utilise le stockage OPFS et l'id d'espace comme nom de base de donnees. Les
ecritures sont locales et immediates ; elles atteignent le serveur au prochain
push.

## Comment (synchroniser)

```ts
await db.push();                    // send local writes
await db.pull();                    // apply server changes
await db.sync();                    // push then pull (docs + attachments)

const handle = db.liveSync();               // adaptive polling
const live = db.liveSync({ continuous: true }); // hold an SSE stream
handle.stop();
```

`continuous: true` ouvre un flux `GET /db/:db/changes?feed=continuous` et retire a
nouveau a chaque changement, retombant sur le polling si le flux tombe. Le flux a
besoin du mode continu du serveur (integre dans `barrel_server`).

Tirez avec un filtre pour tenir un sous-ensemble (le filtre rejoint l'identite de
synchronisation, il garde donc son propre curseur) :

```ts
await db.pull({ filter: { query: { where: [["path", ["type"], "note"]] } } });
await db.pull({ filter: { channel: "mobile" } });   // a declared channel
```

## Comment (interroger)

Interrogez l'ensemble synchronise localement avec BQL ; le meme texte s'execute
sur le serveur. L'executeur local correspond au sous-ensemble de documents du
serveur (SELECT/WHERE/ORDER BY/LIMIT/OFFSET, chemins, UNNEST,
IN/LIKE/IS NULL/IS MISSING/BETWEEN/CONTAINS).

```ts
const rows = await db.query(
  "SELECT name, price FROM db WHERE kind = 'fruit' ORDER BY price DESC LIMIT 10",
);
const scoped = await db.query("SELECT * FROM db WHERE org = $org", {
  params: { org: "acme" },
});
```

La recherche vectorielle et par mot-cle (`vector_top_k`, `bm25_top_k`,
`hybrid_top_k`) et `SUBSCRIBE` ont besoin du serveur ; ils levent
`BqlServerOnlyError` localement. Envoyez celles-ci, ou n'importe quelle requete
lourde ou globale, au serveur :

```ts
const { rows, meta } = await db.queryRemote(
  "SELECT * FROM bm25_top_k('outage', k => 20) AS s",
);
```

## Comment (recherche vectorielle)

Tirez l'embedding de chaque document vers le navigateur et classez l'ensemble
synchronise par cosinus par rapport a un vecteur de requete que vous fournissez.
Les vecteurs empruntent une passe dediee (ils ne voyagent jamais sur le flux de
documents), tirez-les donc apres une synchronisation ou repliez-les dans
`liveSync`.

```ts
await db.syncEmbeddings();          // pull vectors for the docs you hold
db.liveSync({ vectors: true });     // or pull them each live cycle

const hits = await db.searchLocal(queryVector, { k: 10 });
//   [{ id, score, doc }], sorted by descending cosine

const filtered = await db.searchLocal(queryVector, {
  k: 10,
  filter: "kind = 'note'",          // a BQL WHERE narrows candidates first
});
```

`searchLocal` classe les vecteurs `emb` par document que vous avez synchronises.
C'est un corpus different de l'index ANN du serveur, qui est lie a la dimension du
modele d'embedding ; atteignez-le avec `db.searchVector` / `db.searchText` :

```ts
const vhits = await db.searchVector(queryVector, { k: 10 }); // server ANN
const thits = await db.searchText("outage", { k: 10, mode: "bm25" });
```

Aucun modele n'est fourni. Pour calculer l'embedding de texte dans le navigateur,
chargez vous-meme un modele (par exemple transformers.js) et passez le
`Float32Array` a `searchLocal` ; sa dimension doit correspondre aux vecteurs
stockes. Voir `examples/vector-search.html`.

## Comment (pieces jointes)

Les pieces jointes sont des blobs adresses par contenu synchronises sur leur
propre flux, correles a un document par leur nom.

```ts
await db.putAttachment("doc1", "photo.jpg", bytes, { contentType: "image/jpeg" });
const got = await db.getAttachment("doc1", "photo.jpg"); // { bytes, info }
const info = await db.getAttachmentInfo("doc1", "photo.jpg"); // digest/length/type
await db.removeAttachment("doc1", "photo.jpg");
await db.gcAttachments(); // reclaim unreferenced blobs
```

Les blobs sont diffuses sur les endpoints `_sync/att*`, dedupliques par digest
SHA-256, et resolus "dernier ecrit gagnant" sur un horodatage d'origine (pas de
vecteurs de version). Un serveur sans flux de pieces jointes degrade la phase en
sautee.

## Comment (evenements)

```ts
db.onChange((c) => render(c.id, c.deleted, c.source));   // local | remote
db.onStatus((s) => setBadge(s.state));   // idle | syncing | live | error
```

Les deux se declenchent sur chaque onglet, que cet onglet soit le leader ou un
suiveur, ainsi le code d'UI est identique des deux cotes.

## Comment (conflits)

Les modifications concurrentes se resolvent "dernier ecrit gagnant" sur le HLC,
la meme regle qu'utilise le serveur, ainsi chaque replique converge vers le meme
gagnant. Pour etre averti quand une modification locale a perdu :

```ts
const db = await Database.open("notes", {
  remote,
  onConflict: (e) => console.warn("dropped local edit", e.id, "->", e.winner),
});
```

Le corps perdant n'est pas garde localement (le serveur le retient comme un frere
de conflit) ; le gagnant arrive au prochain pull.

## Notes

- Le stockage est un cache. Tout ce qui n'est pas encore flushe est perdu a un
  crash, et le navigateur peut evincer tout le store ; la copie du serveur est la
  source de verite. Un flush precede toujours un push, ainsi tout ce que le serveur
  a appris est aussi sur le disque localement.
- Multi-onglet : un onglet tient un Web Lock et possede le store et la
  synchronisation ; les autres onglets lui relaient les lectures et ecritures via
  BroadcastChannel et recoivent les evenements de changement et de statut. Quand
  l'onglet leader se ferme, l'onglet suivant est promu et recharge le store.
- Le client garde ses checkpoints lui-meme, ainsi un deploiement pull-only n'a
  besoin que d'une autorisation `read`. Il n'ecrit jamais de checkpoints cote
  serveur.
- La synchronisation en direct interroge `_sync/changes` (500 ms apres une
  activite, se repliant jusqu'a 30 s a l'inactivite ; une ecriture locale le
  reveille). Le polling est le plancher ; `continuous: true` ajoute un flux SSE
  base sur fetch (qui porte le bearer) qui reveille le poller et se degrade en
  polling a une chute.
- Le client frappe et persiste son propre id de source de 16 hex. Ne videz pas le
  stockage du navigateur en attendant un etat vierge en cours de synchronisation :
  un nouvel id de source change la paternite des ecritures futures.
- Le BQL local correspond au sous-ensemble de documents du serveur, avec deux
  divergences documentees : JSON confond `1` et `1.0` (le serveur adosse a CBOR
  les garde distincts), et ORDER BY sur des types mixtes suit un ordre total fixe
  (nombre, puis booleen/null, puis objet, puis tableau, puis chaine).
- La recherche vectorielle s'execute dans le navigateur : `searchLocal` classe les
  vecteurs par document synchronises par cosinus en force brute (tirez-les avec
  `syncEmbeddings`). Les requetes de texte et ANN sont deleguees au serveur via
  `searchText` / `searchVector`. Voir la section "Comment (recherche vectorielle)
 " ci-dessus.
- La synchronisation en direct interroge par defaut ; `continuous: true` tient un
  seul flux SSE par base de donnees (leader uniquement) et consomme une des
  connexions HTTP de l'origine.
