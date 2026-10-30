#!/bin/bash
# Publish Monkey Rampage to GitHub Pages (same method as Battle for Sunshine). `--bump` raises the SW cache version.
set -e
REPO=${REPO:-monkey-rampage}
cd "$(dirname "$0")/.."
V=$(grep -o "monkey-rampage-v[0-9]*" sw.js | grep -o "[0-9]*$")
[ "$1" = "--bump" ] && sed -i "s/monkey-rampage-v$V/monkey-rampage-v$((V+1))/" sw.js && sed -i "s/const VERSION = 'v$V'/const VERSION = 'v$((V+1))'/" js/main.js
OWNER=$(gh api user -q .login)
WORK=/tmp/monkey-rampage-pages; rm -rf $WORK; mkdir -p $WORK
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then gh repo clone "$OWNER/$REPO" $WORK -- -q; else
  gh repo create "$REPO" --public --description "Monkey Rampage: cartoon 3D city-smashing browser game (giant monkey vs. skyscrapers, cars, cops and choppers)"; git -C $WORK init -q -b main; git -C $WORK remote add origin "https://github.com/$OWNER/$REPO.git"; fi
find $WORK -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
mkdir -p $WORK/build
cp -r index.html style.css sw.js manifest.json README.md js vendor icons screens $WORK/
cp build/serve.mjs build/e2e.mjs build/deploy_github_pages.sh $WORK/build/
touch $WORK/.nojekyll
gh auth setup-git
cd $WORK && git add -A && git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" commit -qm "Deploy $(date '+%F %T')" && git push -q -u origin main
gh api "repos/$OWNER/$REPO/pages" >/dev/null 2>&1 || gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
echo "https://$(echo $OWNER | tr A-Z a-z).github.io/$REPO/"
