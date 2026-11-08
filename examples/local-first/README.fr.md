<!-- translation_of: examples/local-first/README.md source_hash: b381e9c50e8ec58d -->
# Local-first avec barrel-lite

Ce projet fait tourner deux clients TypeScript, un téléphone et un
portable, chacun avec sa propre copie locale d’une même base,
synchronisée avec un barrel_server. Le téléphone écrit et lit en local,
se synchronise, passe hors ligne et continue de modifier, pendant que le
portable modifie le même document. De retour en ligne, les deux versions
sont conservées sous forme de conflit ; le téléphone le résout une fois
et la résolution atteint le portable et le serveur. Utilisez-le quand
une application doit continuer de fonctionner sans réseau.

## Prérequis

- Node 22.6 ou plus récent (cette exécution a utilisé Node 22.19).
  `main.ts` s’exécute avec le retrait des types de Node, sans étape de build.
- Un barrel_server en marche (1.13 ou plus récent) sur `BARREL_URL`, par
  défaut `http://localhost:8080`, sans authentification. Voir le
  démarrage rapide du serveur.
- barrel-lite, compilé depuis le dépôt barrel. Il n’est pas encore sur npm :

  ```sh
  cd /path/to/barrel/clients/barrel-lite
  npm install && npm run build
  cd -
  npm install
  npm install --no-save /path/to/barrel/clients/barrel-lite
  ```

## Exécuter

```sh
BARREL_URL=http://localhost:8080 ./run.sh
```

`run.sh` vérifie les types de `main.ts` avec `tsc --noEmit`, puis
l’exécute. Le programme supprime et recrée la base `lf_groceries` sur le
serveur pour que chaque exécution parte de zéro.

## Ce que montre l’exemple

- `Database.open(name, {remote, storage})` : dans Node, le stockage local
  est `MemoryAdapter` ; dans un navigateur, c’est OPFS par défaut.
- `put` et `get` travaillent sur la copie locale, sans requête.
- `sync()` envoie les changements locaux, puis récupère ceux du serveur.
- Le hors ligne est simulé avec l’option `remote.fetch` : un fetch qui
  échoue fait lever par `sync()` une `SyncError` de code `network` ; les
  écritures locales attendent et partent à la synchronisation suivante.
- Deux modifications concurrentes d’un document sont toutes deux
  conservées : `get` renvoie l’une, `conflicts` renvoie l’autre. `resolve`
  remplace les deux, ici et, après un envoi, partout.
- `query` exécute du BQL en local sur la copie synchronisée.

## Notes

- Les données locales dans `MemoryAdapter` disparaissent à la fin du
  processus. Dans un navigateur, OPFS les conserve, écrites toutes les
  200 ms ; c’est la synchronisation qui les rend durables.
- Les exécutions dans le navigateur (OPFS, plusieurs onglets) sont
  couvertes par la suite Playwright de barrel-lite, pas par cet exemple.

## Sortie attendue

Une ligne par étape. La sortie d’une exécution réelle se trouve dans
`expected.txt`.
