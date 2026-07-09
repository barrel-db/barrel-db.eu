---
title: Vecteurs de version
description: Comment Barrel versionne les ecritures et resout les conflits, pour que la synchronisation converge sans coordinateur.
---

Barrel utilise des horloges logiques hybrides et des vecteurs de version au lieu
d'un arbre de revisions. Lisez ceci quand vous synchronisez ou repliquez des
bases de donnees, ou quand vous ecrivez depuis plus d'un endroit, et que vous
voulez savoir comment les modifications concurrentes sont resolues.

## Chaque ecriture est une version

Chaque ecriture recoit un jeton de version de la forme `<hex(hlc)>@<author>` : un
horodatage d'horloge logique hybride, plus l'id de la base de donnees qui l'a
produite. Vous voyez ce jeton comme le `<<"_rev">>` d'un document. Ce n'est pas un
arbre de revisions, et il n'y a pas de chaine parente a parcourir.

## Les vecteurs de version suivent la causalite

Chaque document porte un vecteur de version : la plus haute horloge qu'il a vue de
chaque auteur. Quand deux bases de donnees se synchronisent, la cible compare les
vecteurs par inclusion pour decider, par document, ce qui lui manque. C'est ainsi
que la synchronisation reste incrementale et sans coordinateur : aucun noeud n'a a
etre le primaire.

## Les conflits sont gardes, pas perdus

Quand deux ecritures sont reellement concurrentes (ni l'un ni l'autre vecteur de
version ne contient l'autre), Barrel choisit un gagnant deterministe selon la
regle "dernier ecrit gagnant" et **conserve la version perdante comme un frere
de conflit**. Rien n'est abandonne silencieusement. Vous resolvez un conflit de
l'une des deux facons suivantes :

- configurer une fonction de fusion quand vous ouvrez la base de donnees, que
  Barrel appelle pour produire automatiquement la valeur resolue, ou
- ecrire a nouveau : une ecriture ulterieure qui supplante les deux versions efface
  le conflit.

Les versions perdantes restent dans l'historique retenu, vous pouvez donc
toujours voir ce qui etait concurrent. Voir
[Audit et provenance](/fr/docs/guides/audit-provenance) pour lire les versions
passees.

## Pourquoi pas un simple dernier ecrit gagnant ?

Une base de donnees purement "dernier ecrit gagnant" jette une ecriture des que
deux repliques modifient le meme document, et elle ne peut pas distinguer un vrai
conflit d'un renvoi perime. Les vecteurs de version permettent a Barrel de faire
la difference, de garder le perdant pour que vous l'inspectiez, et de faire
converger chaque replique vers le meme gagnant et le meme corps. Voir
[Synchronisation](/fr/docs/guides/synchronization) pour voir comment cela se joue
sur le reseau.
