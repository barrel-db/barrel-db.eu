---
translation_of: src/content/synced/architecture/replication-proofs.md
source_hash: "86d764b690a5dffe"
title: "Preuves de réplication"
description: "Cette page énonce les propriétés sur lesquelles repose le protocole de réplication des documents et explique pourquoi chacune tient. Elle couvre l’état par document de barrel_live (apps/barrel_docdb/src/barrel_live.erl) et les règles qui l’entourent. Lisez-la quand vous modifiez la fusion, le choix de ce qu’une écriture remplace, la résolution automatique, l’éviction ou le chemin de mise à niveau."
source: "docs/architecture/replication-proofs.md"
---

Cette page énonce les propriétés sur lesquelles repose le protocole de réplication des documents et explique pourquoi chacune tient. Elle couvre l’état par document de `barrel_live` (`apps/barrel_docdb/src/barrel_live.erl`) et les règles qui l’entourent. Lisez-la quand vous modifiez la fusion, la façon dont une écriture choisit ce qu’elle remplace, la résolution automatique, l’éviction ou le chemin de mise à niveau. Le contrôle exécutable est `barrel_live_SUITE` ; chaque section nomme les tests qui l’exercent.

## Modèle

Un **token** est `(HLC, writer)`, ordonné par HLC puis par writer. Le writer d’une écriture utilisateur est l’identifiant d’écrivain de la base, émis à chaque ouverture. Le writer d’une résolution automatique est `auto:<hash>`.

Un **état** `S` a trois parties :

- `live` : les versions courantes, chacune avec un indicateur de suppression, un vecteur `vv` (pour les anciens pairs) et, pour une résolution automatique, son `base` et le hash de son `result`.
- `obs` : par writer, la plus haute HLC de ce writer que cet état a traitée. Seules les écritures du writer lui-même l’augmentent.
- `cloud` : les tokens exacts que cet état a vus (versions d’anciens pairs, résolutions automatiques, versions évincées et converties).

`seen(S, t)` est vrai quand `t` est dans `cloud`, ou quand `obs[writer(t)] >= hlc(t)`.

**Invariant I1.** Tout token live est vu.

**Invariant I2 (clôture).** Si `obs[w] >= h`, tout token du writer `w` de HLC au plus `h` qui a jamais été écrit a été traité par `S` : il est live dans `S`, ou une écriture dont l’effet a atteint `S` l’a remplacé.

I2 tient parce que :

1. Un seul processus writer écrit toutes les versions d’une base (vérifié à l’exécution : `alloc_hlc/1` échoue en dehors de lui).
2. Les HLC d’un writer croissent strictement, et chaque écriture prend un token supérieur à tous les tokens live et à la marque propre du writer (`author/4` vérifie les deux).
3. Un identifiant de writer ne sert qu’à une seule ouverture : un crash ou une copie restaurée ne peut donc pas écrire sous un identifiant dont il a perdu les versions antérieures.
4. Seule l’écriture propre du writer augmente `obs[w]`. Les arrivées d’anciens pairs, la conversion et les résolutions automatiques ajoutent seulement des tokens exacts à `cloud`.

La règle 4 est celle que le contre-exemple de relais de la troisième revue cassait (un ancien pair qui relayait `a2` augmentait `obs[a]` et avalait `a1`). Elle est fixée par `relayed_version_keeps_sibling` et `conversion_keeps_unseen_sibling`, dont les contrôles négatifs augmentent la marque et perdent l’écriture.

## T1. La fusion est un demi-treillis supérieur

`merge/2` garde une version que les deux côtés détiennent, ou une version que l’autre côté n’a jamais vue ; les contextes se joignent par union (`cloud`) et par maximum point à point (`obs`) ; les informations d’un token détenu des deux côtés se joignent point à point (`vv` au maximum, `base` par union, une base absente valant le minimum).

C’est la jointure `DotFun` du cadre des CRDT causaux avec des valeurs en treillis (Almeida, Shoker, Baquero 2018, section 7.4). Ses lois tiennent sur les états dont les contextes sont causalement cohérents, ce que donnent I1 et I2. Les écarts par rapport à l’article sont que les dots sont des tokens HLC compactés par I2 plutôt que par contiguïté de compteur, et que `cloud` ne se compacte jamais ; aucun des deux ne change les équations ensemblistes.

Contrôle : `join_laws_on_reachable_states` vérifie la commutativité, l’idempotence et l’associativité sur 373 438 triplets d’états issus d’une même exécution (un token ne nomme une seule écriture qu’au sein d’une exécution).

## T2. Clôture

Argumentée ci-dessus (I2). Contrôle : les deux scénarios de relais et de conversion avec leurs contrôles négatifs, et chaque exécution de recherche (une clôture cassée se manifeste par une écriture perdue).

## T3. Un document qui existe a toujours une version live

Prenez le token le plus haut `p` dans `live(A) ∪ live(B)`, par exemple `p ∈ live(A)`. La fusion ne supprime `p` que si `p` est vu par `B` et n’y est pas live. Quelque chose dans l’historique de `B` l’a retiré, et les seules suppressions possibles sont :

- une écriture utilisateur, dont le token est au-dessus de tout token live, donc au-dessus de `p` ;
- une résolution automatique, dont le token est au-dessus de tout ce qu’elle remplace (HLC = la plus haute de sa base plus la taille de la base, donc strictement au-dessus de toute entrée, autres résolutions comprises) ;
- l’éviction, qui ne retire jamais la version gagnante, donc une version au-dessus de `p` était live.

Dans chaque cas, un token au-dessus de `p` était live dans `B`, et par le même argument appliqué à ce token, un token au-dessus de `p` est encore live dans `B`. Cela contredit le fait que `p` soit le plus haut. Les arrivées d’anciens pairs et la conversion ne retirent rien.

Contrôle : `empty` est vérifié dans chaque exécution de recherche ; `auto_sorts_above_replaced` fixe la règle `+ size of base`, et son contrôle négatif (`+ 1`) classe une résolution en dessous de ce qu’elle a remplacé.

## T4. Convergence

Une fois les écritures arrêtées, la fusion sur un ensemble connexe de chemins de réplication atteint la jointure de tous les états (T1). Avec un résolveur, chaque résolution couvre strictement plus d’écritures originales que toute version automatique qu’elle remplace (T10) : les étapes de résolution sont donc en nombre fini et le point fixe est atteint. L’éviction retire des versions mais est déterministe sur l’état, elle ne casse donc pas la convergence.

Contrôle : `diverge` et `stuck` dans chaque exécution de recherche, qui amène toutes les paires à un point fixe.

## T5. Une écriture ne retire que ce qu’elle a observé

`replaces/3` renvoie, par ordre de priorité :

1. l’ensemble observé explicite, intersecté avec `live` ;
2. quand la version gagnante est une suppression, toutes les suppressions live, après vérification de `Rev` s’il est fourni (la lecture a montré un document supprimé, qui a observé toutes les suppressions) ;
3. sinon `[Rev]`, et seulement si `Rev` est la version gagnante.

`author/4` retire exactement cette liste.

Exceptions :

- l’éviction ;
- l’appel de compatibilité `resolve_conflict(Db, Id, BaseRev, Resolution)`, qui remplace toutes les versions courantes et peut retirer une version arrivée après la lecture.

Contrôle : `edit_rules`.

## T6. Un stub fusionne comme le document supprimé

Un stub stocke les mêmes `live`, `obs` et `cloud`, et ne laisse tomber que les corps, l’historique et les entrées d’index, qui ne font pas partie de l’état. `digest/1` et `merge/2` ne lisent que l’état, ils ne peuvent donc pas distinguer les deux. (Les stubs arrivent avec l’état du document ; la propriété y tient par construction.)

## T7. Purge désactivée : une version remplacée ne revient jamais

Un token remplacé est vu par la réplique qui l’a remplacé. L’ensemble vu ne fait que croître : la fusion unit les contextes, les écritures et les évictions y ajoutent, et la conversion n’a lieu qu’une fois par document. Une fusion ne garde jamais un token que l’autre côté a vu et retiré, et l’arrivée d’un token déjà vu depuis un ancien pair est ignorée. Donc dès qu’une réplique remplace `t`, toute réplique qui fusionne ensuite avec elle, directement ou par d’autres, retire `t` et ne l’admet plus jamais, quels que soient le délai, la duplication ou le réordonnancement des états.

Un crash qui annule des écritures non synchronisées peut perdre un remplacement en même temps que l’écriture qui l’a produit. Ce remplacement n’a atteint personne : personne n’a donc vu `t` remplacé. S’il a atteint un pair, la fusion suivante retire `t` à nouveau.

Contrôle : `resurrected` dans chaque exécution de recherche (livraisons tardives d’états passés comprises) ; `pre_upgrade_delete_stays_deleted` et son contrôle négatif (pas d’amorçage de conversion).

## T8. Purge activée

T7 tient pour tout ce qui est plus récent que `tombstone_purge_after`. Une réplique, une sauvegarde, un état stocké ou un message plus ancien que ce délai peut faire revenir un document purgé. C’est le relâchement documenté, comme le `gc_grace_seconds` de Cassandra ; il n’y a rien de plus à prouver.

## T9. Filtres

Un état sans version live passe tous les filtres ; sinon, il passe quand un corps live correspond. Une réplique reçoit chaque document correspondant et chaque suppression qui ne laisse aucune version live, pour un document qu’elle détient, à condition qu’un chemin de tâches de réplication transporte le document. Comme le contexte est par document, ne pas recevoir un document ne le marque jamais comme vu : un changement de filtre ne peut donc pas faire sauter à une réplique un document qui lui correspond plus tard (le nouveau périmètre est rejoué depuis le début). Vérifié dans les modèles Python de la conception simplifiée ; le contrôle Erlang gagnera des cas de filtre quand `passes/2` arrivera.

## T10. Résolution automatique

La base d’une résolution est l’union des bases de ses entrées (une écriture utilisateur se couvre elle-même). Son token est calculé à partir de la base et du résultat.

- **Une fonction donne une version.** Une fonction indépendante de l’ordre donne le même résultat pour la même base : chaque réplique qui résout les mêmes écritures originales, quel que soit le regroupement, écrit donc le même token.
- **Elle termine.** L’arrêt sans remplacement interdit de remplacer une version automatique de même base et de résultat différent. Une version automatique n’est donc remplacée que par une version couvrant strictement plus d’écritures originales, ou par elle-même. Les bases sont des sous-ensembles d’un ensemble fini d’écritures.
- **Elle ne vide jamais un document :** T3, avec la règle `+ size of base`.
- **Elle ne perd aucune écriture utilisateur :** une résolution ne remplace que les versions live qu’on lui a données, qu’elle couvre toutes.
- **Des fonctions différentes** sur des répliques différentes terminent toujours, ne vident jamais le document et ne perdent aucune écriture, mais le résultat qui survit dépend de l’ordre de synchronisation. C’est une erreur de configuration, documentée comme telle.

Contrôle :

- `overlapping_auto_one_version` ; son contrôle négatif (une résolution nommée par l’horloge propre du résolveur) laisse deux versions ;
- `different_functions_never_empty` ; son contrôle négatif (pas d’arrêt) vide le document ;
- `search_resolver`.

## Ce que le contrôle couvre et ne couvre pas

`barrel_live_SUITE` exécute des recherches exhaustives bornées sur un document : une ligne de trois répliques et un triangle, jusqu’à trois écritures utilisateur (modification, modification avec ensemble observé, suppression), une rotation de writer, la livraison tardive d’états passés, et le résolveur activé ou non. Chaque recherche va jusqu’au bout dans ses bornes. `search_negative_control` montre que la recherche détecte une fusion qui ignore le contexte.

Non couvert ici :

- plusieurs documents, l’éviction dans la recherche et les anciens pairs dans la recherche (ils sont couverts par des scénarios dirigés) ;
- les filtres, les stubs et la purge, qui arrivent plus tard ;
- le décalage d’horloge et la vivacité sous écritures continues.

Les vérifications mécanisées se trouvent dans `proofs/` (voir son README) : TLC explore chaque état atteignable de trois répliques, crashs avec annulation et résolution automatique compris ; Ivy prouve la clôture (T2), T5 et T7 comme invariants inductifs pour un nombre quelconque de répliques et de writers ; Lean prouve les lois de jointure (T1), T7 pour une fusion et T6. Chacun a des contrôles négatifs qui doivent échouer.
