// translation_of: src/data/components/att-s3.ts source_hash: 27c189b23c0da9fb
// French text for the barrel_att_s3 library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { attS3 as en } from '../../components/att-s3';

export const attS3 = overlay(en, {
  lead: 'Un backend de pièces jointes pour barrel_docdb qui garde les octets des fichiers dans un bucket compatible S3 au lieu du stockage de blobs RocksDB local.',
  problem: 'Les gros fichiers remplissent les disques locaux et se partagent mal entre nœuds. Avec barrel_att_s3, le document reste dans barrel_docdb tandis que ses pièces jointes vont dans un stockage objet, avec le flux des pièces jointes, la réplication, les branches (copie côté serveur), les envois multipart et le nettoyage des envois abandonnés.',
  useWhen: [
    'Les pièces jointes sont grosses ou nombreuses, et le disque local est la limite.',
    'Vous exploitez déjà un stockage compatible S3 (RustFS et Garage sont testés en CI).',
  ],
  notWhen: [
    'La base est chiffrée et les fichiers doivent l’être aussi : les pièces jointes S3 sont stockées en clair.',
    'Vous avez besoin d’écritures conditionnelles sur Garage : il ne peut pas les garantir.',
  ],
  standalone: { short: 'Non', text: 'Non. C’est un backend que barrel_docdb charge via `att_opts`.' },
  install: { label: 'dépendances rebar.config', note: 'Absent du build par défaut de l’umbrella : utilisez `rebar3 as s3 compile`.' },
  reachedThrough: ['`att_opts` de `barrel_docdb:create_db/2`', 'REST `PUT /db/:db` avec `{"att_opts": {"backend": "s3", ...}}`', 'les appels habituels sur les pièces jointes'],
  config: [
    { rows: [
      { meaning: 'Mettre `s3`' },
      { def: 'obligatoire', meaning: 'Doit exister ; absent, il donne `{att_store_open_failed, missing_bucket}`' },
      { def: 'aucun', meaning: 'Où se trouve le stockage' },
      { def: 'aucun', meaning: 'Identifiants' },
      { meaning: 'Taille des parties en multipart' },
    ] },
    { title: 'Environnement de l’application (barrel_att_s3)', rows: [
      { meaning: 'Nettoyage des envois abandonnés ; 0 désactive' },
      { meaning: 'Âge au-delà duquel un envoi est considéré abandonné' },
    ] },
  ],
  api: [
    { title: 'Via barrel_docdb', rows: [
      { task: 'Utiliser S3 pour une base' },
      { task: 'Stocker, lire, supprimer' },
      { task: 'Écrire seulement si absent', returns: '`{error, {conflict, Info}}` s’il existe' },
      { task: 'Écrire si inchangé', returns: '`{error, conditional_writes_unsupported}` sur Garage' },
      { task: 'En flux', returns: 'descripteurs d’écriture et de lecture' },
    ] },
  ],
  examples: [
    { title: 'Des pièces jointes dans un bucket RustFS local', intro: 'D’après une exécution vérifiée contre RustFS 1.0.0 dans un conteneur. Les objets ont pour clé `<db>/<hex doc id>/<name>`.', outputLabel: 'Sortie d’une exécution sur barrel_att_s3 0.1.4 (empreinte abrégée)' },
  ],
  limits: [
    'Une branche copie chaque pièce jointe en arrière-plan ; tant que ce n’est pas fini, les lectures répondent `{error, {att_sync_pending, _}}`.',
    'Supprimer une base fermée demande à nouveau `att_opts`. Recréer une base ouverte avec de nouvelles `att_opts` ne fait rien, sans le signaler.',
    'MinIO et AWS S3 sont documentés comme pris en charge mais ne sont pas testés en CI.',
    'Les métadonnées du flux restent en local dans `<db>/attachments/feed.db`.',
  ],
  gaps: [
    'Les pièces jointes ne sont pas couvertes par le chiffrement de la base : avec `encryption => default`, l’objet dans le bucket contenait le texte en clair.',
  ],
  guides: [
    { label: 'Pièces jointes' },
    { label: 'Chiffrement au repos' },
  ],
});
