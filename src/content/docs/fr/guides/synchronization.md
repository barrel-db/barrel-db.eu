---
title: Synchronisation
description: Repliquez documents et pieces jointes entre bases de donnees avec un protocole a vecteurs de version, dans la meme VM ou via HTTP.
---

Barrel replique les documents entre bases de donnees avec un protocole a vecteurs
de version : ordre causal issu d'une horloge logique hybride (HLC), gagnants
deterministes, livraison idempotente, et checkpoints pour la reprise. La
replication s'execute dans la meme VM ou via HTTP contre un `barrel_server`. Lisez
ceci quand vous devez copier ou garder deux bases de donnees synchronisees,
repliquer un sous-ensemble avec des canaux, ou deplacer des pieces jointes avec
les documents.

## Ce que c'est

La replication vit dans `barrel_docdb` (`barrel_rep`). Une execution :

1. Lit le checkpoint (un document local des deux cotes) pour trouver le dernier
   HLC expedie.
2. Recupere les changements depuis la source depuis ce HLC, le filtre etant
   applique a la source.
3. Compare les jetons de version offerts avec la cible en un aller-retour.
4. `put_version` des documents manquants sur la cible (idempotent, ainsi une
   livraison au-moins-une-fois est sure).
5. Checkpoint par lot, puis execute la phase des pieces jointes (voir ci-dessous).

Les deux cotes convergent vers le meme gagnant, le meme corps et le meme etat de
suppression pour chaque document, quel que soit l'entrelacement des ecritures. Les
conflits sont enregistres la ou la concurrence a ete observee et se resolvent en
ecrivant une version supplantante.

Les transports implementent le comportement `barrel_rep_transport`. Deux sont
livres aujourd'hui : `barrel_rep_transport_local` (meme VM, noms de bases de
donnees) et `barrel_rep_transport_http` (client hackney parlant le protocole
`/db/:db/_sync/*` servi par `barrel_server`).

## Quand l'utiliser

- Copier une base de donnees vers une autre base de donnees, dans la meme VM ou
  sur un autre noeud.
- Garder des repliques coherentes a terme, une fois par execution ou en continu.
- Repliquer un sous-ensemble de documents avec un filtre de canal, de chemin ou de
  requete.
- Deplacer les blobs des pieces jointes avec leurs documents, adresses par
  contenu.

## Comment (meme VM)

```erlang
{ok, _} = barrel_docdb:create_db(<<"source">>),
{ok, _} = barrel_docdb:create_db(<<"target">>),
{ok, _} = barrel_docdb:put_doc(<<"source">>, #{<<"id">> => <<"a">>, <<"v">> => 1}),

{ok, Result} = barrel_rep:replicate(<<"source">>, <<"target">>),
#{docs_written := N, att_sync := _} = Result.
```

Relancez-le plus tard pour recuperer les nouveaux changements ; il reprend depuis
le checkpoint.

## Comment (via HTTP)

Le cote distant est une URL sous un `barrel_server` en cours d'execution.
Construisez un endpoint, puis passez le transport correspondant :

```erlang
Endpoint = barrel_rep_transport_http:endpoint(
    <<"http://edge-1.example.com:8080/db/inventory">>),

%% push
{ok, _} = barrel_rep:replicate(<<"inventory">>, Endpoint,
    #{target_transport => barrel_rep_transport_http}),

%% pull
{ok, _} = barrel_rep:replicate(Endpoint, <<"inventory">>,
    #{source_transport => barrel_rep_transport_http}).
```

`endpoint/1` normalise l'URL (schema et hote en minuscules, sans barre oblique
finale). L'URL normalisee est l'identite de replication : changer son texte
demarre un checkpoint neuf, les identifiants et le reglage non. La map d'endpoint
prend aussi `pool`, `connect_timeout`, `recv_timeout`, et `headers`.

## Comment (authentification)

Protegez un serveur avec des jetons Bearer statiques ; une liste accepte les
anciens et les nouveaux pendant une rotation. `/health` reste ouvert, tout le
reste exige le jeton :

```erlang
%% server side (app env, before barrel_server starts)
application:set_env(barrel_server, auth, #{tokens => [<<"s3cret">>]}).
```

Donnez au client son jeton sur l'endpoint, ou indexe par origine dans l'app env
pour que les configs de taches persistees restent sans secret :

```erlang
Authed = Endpoint#{auth => #{token => <<"s3cret">>}},
%% or
application:set_env(barrel_docdb, sync_auth,
                    #{<<"http://edge-1.example.com:8080">> => <<"s3cret">>}).
```

## Comment (replication selective)

Les filtres s'appliquent a la source. Les filtres de chemin et de requete se
composent avec AND :

```erlang
{ok, _} = barrel_rep:replicate(<<"source">>, <<"target">>, #{
    filter => #{
        paths => [<<"users/#">>],
        query => #{where => [{path, [<<"status">>], <<"active">>}]}
    }
}).
```

Les canaux sont l'alternative indexee : des ensembles de motifs nommes declares a
la creation de la base de donnees, materialises en un flux par canal au moment de
l'ecriture, ainsi un pull filtre est un balayage borne au lieu d'un parcours du
flux complet :

```erlang
{ok, _} = barrel_docdb:create_db(<<"source">>, #{
    channels => #{<<"mobile">> => [<<"type/task">>, <<"owner/+">>]}
}),
{ok, _} = barrel_rep:replicate(<<"source">>, <<"target">>, #{
    filter => #{channel => <<"mobile">>}
}).
```

Notes sur les canaux :

- Les motifs sont de style MQTT (`+` un segment, `#` final pour le reste).
- Les canaux sont fixes a la creation et indexent les ecritures faites apres la
  creation.
- Un document qui cesse de correspondre cesse d'etre envoye ; les repliques
  gardent leur derniere copie (pas de suppression cote cible). Une replique neuve
  ne voit jamais les documents partis.
- Une replication filtree garde son propre checkpoint (le filtre rejoint l'id de
  replication).

## Pieces jointes

La synchronisation des pieces jointes accompagne chaque execution
(`attachments => true` par defaut). C'est une deuxieme phase apres la boucle des
documents : le flux de pieces jointes de la source est compare par digest a la
cible, seul le contenu manquant est transfere, et les ecritures convergent selon
"dernier ecrit gagnant" sur leur HLC d'origine. Le resultat atterrit sous
`att_sync` dans le resultat de replication :

```erlang
{ok, #{att_sync := #{atts_written := _, atts_skipped := _}}} =
    barrel_rep:replicate(<<"source">>, Endpoint,
        #{target_transport => barrel_rep_transport_http}).
```

Notes :

- Les blobs sont diffuses par morceaux dans les deux sens via HTTP ; rien ne
  bufferise un blob entier. Les pulls n'ont pas de plafond de taille. Les pushes
  sont bornes par l'env `{barrel_server, max_body, Bytes}` du serveur (1 GiB par
  defaut, `infinity` accepte) ; un push plus grand recoit un 413, echoue pour
  cette piece jointe seulement, et l'execution le rapporte dans
  `att_write_failures`.
- Il n'y a pas d'ordre entre les documents et leurs pieces jointes : un document
  peut arriver avant son blob (les lectures renvoient 404 jusqu'a ce que la phase
  des pieces jointes atterrisse).
- Les pieces jointes ecrites avant cette fonctionnalite ne se synchronisent pas
  tant qu'elles ne sont pas reecrites, ou synthetisez les lignes de flux une fois
  avec `barrel_docdb:rebuild_attachment_feed/1`.
- Coupez la phase avec `attachments => false` ; elle se degrade en
  `att_sync => skipped` d'elle-meme quand un cote ne peut pas suivre les pieces
  jointes.

## Replication continue (taches)

Le gestionnaire de taches (`barrel_rep_tasks`) persiste les replications a travers
les redemarrages. Les extremites distantes sont des URLs ; le transport HTTP est
choisi automatiquement :

```erlang
{ok, TaskId} = barrel_rep_tasks:start_task(#{
    source => <<"inventory">>,
    target => <<"http://edge-1.example.com:8080/db/inventory">>,
    mode => continuous,          %% or one_shot
    direction => push,           %% push | pull | both
    filter => #{channel => <<"mobile">>}
}),
{ok, #{status := running}} = barrel_rep_tasks:get_task(TaskId),
ok = barrel_rep_tasks:stop_task(TaskId).
```

Comportement continu :

- Les sources locales sont pilotees par evenements : la tache se reveille sur le
  flux de changements et draine a travers son filtre, ainsi la convergence locale
  est de quelques dizaines de millisecondes.
- Les sources distantes interrogent de maniere adaptative, 500 ms apres des
  donnees et se repliant jusqu'a 15 s a l'inactivite.
- Les erreurs transitoires ne tuent pas une tache continue : elle se replie (1 s a
  60 s, avec jitter), enregistre `last_error` sur le document de tache, et reste
  `running`. Les taches one-shot echouent rapidement.
- Les documents de tache stockent les endpoints uniquement comme URLs ; les jetons
  viennent de `sync_auth`.

## Horloges

Chaque echange sur le reseau porte un en-tete `x-barrel-hlc` et les deux cotes le
replient dans leur horloge, en plus de la poignee de main explicite au debut de
chaque execution. Un pair trop en avance est rejete avec `{error, clock_skew}`
(409 sur le reseau). Pour coupler les horloges a la main :

```erlang
{ok, _Merged} = barrel_docdb:sync_hlc(RemoteHlc).
```

## Clients navigateur

Le meme protocole `/db/:db/_sync/*` pilote `barrel-lite`, le client navigateur
TypeScript : il garde un store OPFS offline-first, estampille les mutations
locales avec son propre id de source, et pousse et tire via ce protocole (polling
adaptatif, pas de SSE). Activez CORS et emettez-lui un jeton de capacite. Voir
[barrel-lite](/fr/docs/guides/barrel-lite).

## Ce qui n'est pas encore couvert

- **Service TLS.** `barrel_server` ecoute en HTTP simple ; le client peut
  atteindre des serveurs https. Placez un terminateur TLS devant pour l'instant.
- **Vecteurs.** Les index vectoriels ne sont pas expedies ; avec le mode
  enregistrement le texte et les metadonnees se repliquent comme des documents et
  l'index se reconstruit localement. La synchronisation de vecteurs quantifies est
  prevue avec le client TypeScript.
- **Facade.** `barrel` (la facade embarquable) n'expose pas la replication ;
  appelez `barrel_rep` et `barrel_rep_tasks` sur le nom docdb sous-jacent.
- **Provenance.** L'acteur/session/source qu'une ecriture porte (voir
  [audit-provenance](/fr/docs/guides/audit-provenance)) ne voyage pas sur le
  reseau. Les arrivees repliquees sont attribuees `cause: replicated` avec
  l'identite de la base de donnees d'origine ; l'agent agissant reste sur la piste
  de l'origine.
