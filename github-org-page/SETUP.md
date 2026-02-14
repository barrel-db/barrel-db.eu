# GitHub Mirror Setup

## 1. Create GitHub Organization

- Go to github.com → New organization
- Name: `barrel-db`
- URL: `github.com/barrel-db`

## 2. Create Organization Profile

GitHub org profiles use a `.github` repo:

1. Create repo: `github.com/barrel-db/.github`
2. Create folder: `profile/`
3. Add `profile/README.md` (copy from `README.md` in this folder)

## 3. Create Empty Repos on GitHub

Create these repos (empty, no README):

- `github.com/barrel-db/barrel_vectordb`
- `github.com/barrel-db/barrel_docdb`
- `github.com/barrel-db/barrel_embed`

Settings for each:
- Disable Issues (or add note to use GitLab)
- Disable Wiki
- Disable Projects
- Add description: "Mirror of gitlab.enki.io/barrel-db/REPO_NAME"

## 4. Set Up Push Mirroring (GitLab → GitHub)

For each repo on GitLab:

1. Go to: Settings → Repository → Mirroring repositories
2. Click "Add new"
3. Git repository URL: `https://github.com/barrel-db/REPO_NAME.git`
4. Mirror direction: **Push**
5. Authentication method: Password
6. Password: GitHub Personal Access Token (with `repo` scope)
7. Check "Keep divergent refs"
8. Click "Mirror repository"

### Create GitHub Token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Scopes: `repo` (full control)
4. Copy token, use as password in GitLab

## 5. Verify

- Push a commit to GitLab
- Check GitHub after ~5 minutes (or click "Update now" in GitLab)
- Repo should be synced

## 6. Disable GitHub Features

For each mirrored repo on GitHub:

Settings → General:
- [ ] Issues (disable)
- [ ] Projects (disable)
- [ ] Wiki (disable)

Settings → Branches:
- Protect `main` branch (optional, prevents accidental pushes)

## Result

```
GitLab (source of truth)          GitHub (read-only mirror)
gitlab.enki.io/barrel-db    →     github.com/barrel-db
├── barrel_vectordb          →     ├── barrel_vectordb
├── barrel_docdb             →     ├── barrel_docdb
├── barrel_embed             →     ├── barrel_embed
└── barrel-db (org readme)   →     └── .github/profile/README.md
```

Auto-syncs on every push to GitLab.
