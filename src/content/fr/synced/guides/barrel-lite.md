---
translation_of: src/content/synced/guides/barrel-lite.md
source_hash: "411b933662048965"
title: "barrel-lite (client navigateur)"
description: "barrel-lite est un client TypeScript qui garde dans le navigateur un stockage local de documents offline-first et le synchronise avec un barrel_server via le protocole /db/:db/_sync/*. C’est un client du protocole, pas un portage WASM : il réimplémente octet pour octet les codecs HLC, de version et de vecteur de versions, et traite les données locales comme un cache dont la durabilité vient de la synchronisation."
source: "docs/guides/barrel-lite.md"
---

`barrel-lite` est un client TypeScript qui garde dans le navigateur un stockage
local de documents offline-first et le synchronise avec un `barrel_server` via
le protocole `/db/:db/_sync/*`. C’est un client du protocole, pas un portage
WASM : il réimplémente octet pour octet les codecs HLC, de version et de vecteur
de versions, horodate les modifications locales avec son propre identifiant de
source, et traite les données locales comme un cache (Safari les évince) dont la
durabilité vient de la synchronisation. Lisez ce guide si vous voulez qu’une
application web lise et écrive une base barrel hors ligne et converge avec le
serveur. Le paquet se trouve dans l’umbrella sous `clients/barrel-lite`.

## Quand l’utiliser

- Une application web a besoin de lectures et d’écritures locales qui
  continuent de fonctionner hors ligne.
- Vous voulez que les changements convergent automatiquement avec le serveur
  (et les autres onglets).
- Vous dépassez un seul onglet : un seul écrivain par origine, les autres
  suivent.

## Configuration du serveur

Le navigateur a besoin de deux choses que le serveur n’active pas par défaut :
CORS, et un jeton qu’il peut réellement embarquer. Configurez les deux dans
l’environnement de l’application `barrel_server`.

```erlang
{barrel_server, [
    {cors, #{origins => '*',              %% ou une liste d'origines
             expose => [<<"x-barrel-hlc">>]}},   %% par défaut ; nécessaire pour l'horloge
    {auth, #{tokens => [<<"global-token">>]}}
]}
```

Un navigateur ne peut pas embarquer le jeton global. Émettez plutôt un jeton de
capacité par espace (voir [spaces](/fr/docs/guides/spaces)) ; il n’authentifie
que les routes `/db` et `/handoffs` de cet espace, `read` couvrant le sens pull
et `write` le sens push.

```console
$ curl -XPOST host:8080/spaces -H 'authorization: Bearer global-token' \
    -H 'content-type: application/json' -d '{"label":"app"}'
# {"space":"sp_...", ...}
$ curl -XPOST host:8080/spaces/sp_.../grants -H 'authorization: Bearer global-token' \
    -H 'content-type: application/json' -d '{"rights":["read","write"]}'
# {"token":"bsp_...", ...}
```

## Comment faire (ouvrir, lire, écrire)

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

`db` utilise le stockage OPFS et l’id de l’espace comme nom de base. Les
écritures sont locales et immédiates ; elles atteignent le serveur au prochain
push.

## Comment faire (synchroniser)

```ts
await db.push();                    // envoyer les écritures locales
await db.pull();                    // appliquer les changements du serveur
await db.sync();                    // push puis pull (docs + pièces jointes)

const handle = db.liveSync();               // polling adaptatif
const live = db.liveSync({ continuous: true }); // garder un flux SSE ouvert
handle.stop();
```

`continuous: true` ouvre un flux `GET /db/:db/changes?feed=continuous` et refait
un pull à chaque changement, en revenant au polling si le flux tombe. Le flux
nécessite le mode continu du serveur (intégré à `barrel_server`).

Faites un pull avec un filtre pour ne garder qu’un sous-ensemble (le filtre fait
partie de l’identité de synchronisation, il garde donc son propre curseur) :

```ts
await db.pull({ filter: { query: { where: [["path", ["type"], "note"]] } } });
await db.pull({ filter: { channel: "mobile" } });   // un canal déclaré
```

## Comment faire (interroger)

Interrogez localement l’ensemble synchronisé avec BQL ; le même texte s’exécute
sur le serveur. L’exécuteur local correspond au sous-ensemble documents du
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

La recherche vectorielle et par mots-clés (`vector_top_k`, `bm25_top_k`,
`hybrid_top_k`) et `SUBSCRIBE` nécessitent le serveur ; en local elles lèvent
`BqlServerOnlyError`. Envoyez-les au serveur, comme toute requête lourde ou
globale :

```ts
const { rows, meta } = await db.queryRemote(
  "SELECT * FROM bm25_top_k('outage', k => 20) AS s",
);
```

## Comment faire (recherche vectorielle)

Récupérez l’embedding de chaque document dans le navigateur et classez
l’ensemble synchronisé par cosinus face à un vecteur de requête que vous
fournissez. Les vecteurs passent par une passe dédiée (ils ne voyagent jamais
sur le flux de documents) : récupérez-les après une synchronisation ou intégrez-les
à `liveSync`.

```ts
await db.syncEmbeddings();          // récupérer les vecteurs des docs que vous détenez
db.liveSync({ vectors: true });     // ou les récupérer à chaque cycle live

const hits = await db.searchLocal(queryVector, { k: 10 });
//   [{ id, score, doc }], triés par cosinus décroissant

const filtered = await db.searchLocal(queryVector, {
  k: 10,
  filter: "kind = 'note'",          // un WHERE BQL restreint d'abord les candidats
});
```

`searchLocal` classe les vecteurs `emb` par document que vous avez
synchronisés. C’est un corpus différent de l’index ANN du serveur, qui est lié à
la dimension du modèle d’embedding ; atteignez celui-ci avec `db.searchVector` /
`db.searchText` :

```ts
const vhits = await db.searchVector(queryVector, { k: 10 }); // ANN du serveur
const thits = await db.searchText("outage", { k: 10, mode: "bm25" });
```

Aucun modèle n’est fourni. Pour vectoriser du texte dans le navigateur, chargez
vous-même un modèle (par exemple transformers.js) et passez le `Float32Array` à
`searchLocal` ; sa dimension doit correspondre à celle des vecteurs stockés. Voir
`examples/vector-search.html`.

## Comment faire (pièces jointes)

Les pièces jointes sont des blobs adressés par contenu, synchronisés sur leur
propre flux et rattachés à un document par leur nom.

```ts
await db.putAttachment("doc1", "photo.jpg", bytes, { contentType: "image/jpeg" });
const got = await db.getAttachment("doc1", "photo.jpg"); // { bytes, info }
const info = await db.getAttachmentInfo("doc1", "photo.jpg"); // digest/length/type
await db.removeAttachment("doc1", "photo.jpg");
await db.gcAttachments(); // récupérer les blobs non référencés
```

Les blobs transitent en flux par les points d’accès `_sync/att*`, sont
dédupliqués par empreinte SHA-256 et se résolvent en last-write-wins sur un
horodatage d’origine (pas de vecteurs de versions). Face à un serveur sans flux
de pièces jointes, la phase est simplement ignorée.

## Comment faire (événements)

```ts
db.onChange((c) => render(c.id, c.deleted, c.source));   // local | remote
db.onStatus((s) => setBadge(s.state));   // idle | syncing | live | error
```

Les deux se déclenchent dans chaque onglet, qu’il soit leader ou suiveur : le
code d’interface est identique des deux côtés.

## Comment faire (conflits)

Quand l’appareil et une autre réplique modifient le même document avant de se
synchroniser, les deux versions sont conservées, sur l’appareil et sur le
serveur. Chaque réplique affiche le même gagnant (la version la plus haute), et
l’autre version est un conflit que vous pouvez lire et résoudre :

```ts
const db = await Database.open("notes", {
  remote,
  onConflict: (e) => console.warn("local edit is now a conflict", e.id),
});

await db.sync();
const current = await db.get("note");          // le gagnant
const others = await db.conflicts("note");     // [{version, deleted, body}]
if (others.length > 0) {
  await db.resolve("note", { text: mergeTexts(current, others) });
  await db.push();                             // remplace les deux partout
}
```

- `put` remplace le gagnant et laisse les conflits en place ; `resolve` remplace
  le gagnant et chaque conflit (passez `null` pour résoudre en suppression).
- Un serveur configuré avec un `conflict_resolver` résout lui-même les conflits ;
  la résolution arrive au pull suivant.
- Face à un serveur antérieur à la synchronisation d’état complet, le client
  revient à une version à la fois : une modification locale qui perd n’est alors
  pas conservée localement (le serveur la garde), comme avant.

## Notes

- Le stockage est un cache. Tout ce qui n’a pas encore été écrit sur disque est
  perdu en cas de crash, et le navigateur peut évincer tout le stockage ; la
  copie du serveur fait foi. Une écriture sur disque précède toujours un push :
  tout ce qui a été transmis au serveur est aussi sur le disque local.
- Multi-onglets : un onglet détient un Web Lock et possède le stockage et la
  synchronisation ; les autres onglets lui délèguent lectures et écritures via
  BroadcastChannel et reçoivent les événements de changement et de statut. Quand
  l’onglet leader se ferme, l’onglet suivant est promu et recharge le stockage.
- Le client garde lui-même ses checkpoints : un déploiement en pull seul n’a
  besoin que d’un accès `read`. Il n’écrit jamais de checkpoints côté serveur.
- La synchronisation live interroge `_sync/changes` (500 ms après une activité,
  en ralentissant jusqu’à 30 s au repos ; une écriture locale la réveille). Le
  polling est le minimum ; `continuous: true` ajoute un flux SSE basé sur fetch
  (qui transporte le bearer) qui réveille le poller et revient au polling s’il
  tombe.
- Le client génère et conserve son propre identifiant de source de 16 caractères
  hexadécimaux. N’effacez pas le stockage du navigateur en pleine
  synchronisation en espérant repartir de zéro : un nouvel identifiant de source
  change l’auteur des écritures futures.
- Le BQL local correspond au sous-ensemble documents du serveur, avec deux
  divergences documentées : JSON confond `1` et `1.0` (le serveur, adossé à
  CBOR, les distingue), et ORDER BY sur des types mélangés suit un ordre total
  fixe (nombre, puis booléen/null, puis objet, puis tableau, puis chaîne).
- La recherche vectorielle s’exécute dans le navigateur : `searchLocal` classe
  les vecteurs par document synchronisés par cosinus en force brute
  (récupérez-les avec `syncEmbeddings`). Les requêtes textuelles et ANN sont
  déléguées au serveur via `searchText` / `searchVector`. Voir la section
  « Comment faire (recherche vectorielle) » ci-dessus.
- La synchronisation live fait du polling par défaut ; `continuous: true` garde
  un flux SSE par base (leader seulement) et consomme une des connexions HTTP de
  l’origine.
