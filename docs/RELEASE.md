# Releasing and rolling back

## How a release happens

Production (the Oracle VM) deploys itself: every five minutes
`deploy/ops/autodeploy.sh` checks GitHub `main`; if it moved, it rebuilds the
site, installs it, checks `/api/health` and sends a notification. So:

> **Merging into `main` is the deploy.** Nothing else on the server needs touching.

The current redesign (v4, “Prism”) lives on the branch `redesign-v4`. It changes
only the front end (`build.py`, `src/`, `tools/`, `tests/`, `docs/`, and the
generated `dist/`).
`server/` and `deploy/` are untouched, and there are no database migrations.

## Before merging

```sh
python3 build.py            # i18n-missing.txt must stay empty
bash tests/run.sh           # every browser suite, against a local copy with a fake database
```

To look at it locally (fake database, nothing real):

```sh
python3 build.py && node tests/harness.js     # http://localhost:8899
```

## To release

```sh
git checkout main && git pull
git merge --no-ff redesign-v4 -m "Redesign v4"
git push origin main        # live within about five minutes
```

Then check `https://nicelydone.qd.je/`, one tool page, `/ar/`, and
`https://nicelydone.qd.je/api/health`. Returning visitors get the new version
on their next page load: the service worker's cache name changes with every
build, so the old cache is dropped.

## To roll back

The version before the redesign is the commit `main` pointed to before the
merge (tag it `pre-redesign-v4` before merging; otherwise it is the
first parent of the merge commit).

```sh
git checkout main && git pull
git revert -m 1 <merge-commit>      # a new commit that restores the old site
git push origin main                # the VM redeploys the old version within about five minutes
```

`git revert` keeps history intact, so the redesign can be re-merged later by
reverting the revert. Nothing needs rolling back on the server itself: no
schema, configuration or service changed.

If the auto-deploy itself is the problem, on the VM:

```sh
sudo systemctl stop nicelydone-autodeploy.timer      # stop pulling
cd /opt/nicelydone-src && sudo git reset --hard <good-commit>
sudo python3 build.py && sudo bash deploy/install-vm.sh
```

and start the timer again once `main` is in a good state.

## What changed for search engines (v3)

- No URL was removed or renamed. Added: `/tools/`, `/privacy/`, `/contact/`
  (each also under `/ar/`), all in `sitemap.xml` with `hreflang` pairs.
- Titles, descriptions, canonical links and JSON-LD of existing pages are
  unchanged, except `/about/` (its privacy sections moved to `/privacy/`, and
  its description now says what the page is). The home page's JSON-LD gained a
  `SearchAction` pointing at `/tools/?q=`.
- Share images (`src/og/`) are regenerated in the new look by `tools/og.js`.
