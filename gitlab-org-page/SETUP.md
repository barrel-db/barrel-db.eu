# Setting up the Barrel DB GitLab Group Page

## Steps

1. **Create the barrel-db group** (if not exists):
   - Go to `gitlab.enki.io`
   - New group → Name: `barrel-db`
   - URL: `gitlab.enki.io/barrel-db`

2. **Create the .gitlab project**:
   - Inside `barrel-db` group, create new project
   - Name: `.gitlab` (with the dot)
   - Visibility: Public

3. **Add the README**:
   - Copy `README.md` from this folder to the `.gitlab` project root
   - Commit and push

4. **Transfer repos** (from barrel-platform to barrel-db):
   - Go to each repo → Settings → General → Advanced → Transfer project
   - Transfer to `barrel-db` group
   - Repos to transfer:
     - barrel_vectordb
     - barrel_docdb
     - barrel_embed

5. **Update redirects** (optional):
   - GitLab keeps redirects from old URLs automatically

## Result

The group page will be visible at: `gitlab.enki.io/barrel-db`

## Update barrel-db.eu

After transfer, update links if the group URL changes:

```bash
# Current links point to:
# gitlab.enki.io/barrel-db/barrel_vectordb

# If they were under barrel-platform, grep and update:
grep -r "barrel-platform" src/
```
