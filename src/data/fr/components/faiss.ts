// translation_of: src/data/components/faiss.ts source_hash: b202bb7e04d5a6b8
// French text for the barrel_faiss library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { faiss as en } from '../../components/faiss';

export const faiss = overlay(en, {
  lead: 'Des bindings Erlang vers la bibliothèque C++ FAISS, et le backend d’index `faiss`, optionnel, de barrel_vectordb.',
  problem: 'Certaines charges veulent les types d’index de FAISS (IVF, PQ, flat, HNSW de FAISS) plutôt que le HNSW en Erlang pur. barrel_faiss enveloppe FAISS dans un NIF pour que barrel_vectordb puisse s’en servir, et vous pouvez aussi l’appeler directement.',
  useWhen: [
    'Vous dépendez déjà des types d’index FAISS ou de leurs compromis entre mémoire et vitesse.',
    'Vous pouvez installer la bibliothèque FAISS sur chaque nœud qui ouvre le magasin.',
  ],
  notWhen: [
    'Vous voulez un build sans bibliothèque système : le backend HNSW par défaut est en Erlang pur.',
    'Vous compilez sous Windows : il n’y a pas de hooks de build pour cette plateforme.',
  ],
  external: 'bibliothèque et en-têtes FAISS, CMake 3.14 ou plus récent, C++17, OpenMP, BLAS',
  standalone: { short: 'Oui', text: 'Oui, comme bindings NIF sans dépendance Erlang. Il faut FAISS installé sur le système.' },
  install: { label: 'dépendances rebar.config', note: 'Dans l’umbrella, il ne fait pas partie du build par défaut : utilisez `rebar3 as faiss compile`.' },
  reachedThrough: ['`backend => faiss` dans la configuration d’un magasin barrel_vectordb', 'API Erlang'],
  config: [
    { title: 'Configuration d’un magasin barrel_vectordb', rows: [
      { meaning: 'Mettez `faiss`' },
      { meaning: 'Une chaîne de fabrique FAISS' },
      { def: 'aucun', meaning: 'Pour les index IVF' },
    ] },
  ],
  api: [
    { title: 'Index', rows: [
      { task: 'Créer', returns: '`{ok, Index}` ; métrique `l2` ou `inner_product`' },
      { task: 'Entraîner (IVF, PQ)', returns: '`ok`, booléen' },
      { task: 'Ajouter', returns: '`ok` ; float32 et int64, boutisme natif' },
      { task: 'Chercher' },
      { task: 'Retirer', returns: '`{ok, N}` ; pas sur HNSW' },
      { task: 'Enregistrer, charger', returns: 'binaire ou fichier' },
      { task: 'Inspecter, fermer', returns: 'entiers, `ok`' },
    ] },
  ],
  examples: [
    { title: 'Appels directs', intro: 'D’après une exécution vérifiée sur un build CMake neuf, avec FAISS installé par MacPorts. L’exécution a affiché les valeurs ci-dessous ; les instructions d’affichage sont omises du code.', outputLabel: 'Affiché par l’exécution, barrel_faiss 1.0.1' },
    { title: 'Comme backend d’un magasin de vecteurs barrel', intro: 'La même exécution, à travers barrel. La dernière ligne est la même ouverture sur un build sans le NIF.', outputLabel: 'Affiché par l’exécution' },
  ],
  limits: [
    'Demande un FAISS installé sur le système ; le build cherche dans FAISS_ROOT, /opt/local, /usr/local, /opt/homebrew et /usr.',
    'S’exécute sur des dirty schedulers. `remove_ids/2` n’est pas pris en charge sur les index HNSW.',
    'Une recherche sur un index fermé renvoie `{error, "index_closed"}`, une chaîne plutôt qu’un atome.',
  ],
  guides: [
    { label: 'Vectorielle, par mots-clés et hybride' },
  ],
});
