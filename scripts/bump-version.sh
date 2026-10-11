#!/bin/sh
# Stamps a new version on index.html: the app-version meta and the ?v= on
# every local css/js URL, so browsers fetch the fresh files after a deploy.
# Run by the pre-commit hook (scripts/install-hooks.sh) when the app changes.
cd "$(dirname "$0")/.." || exit 1
v=$(date +%Y%m%d%H%M%S)
sed -i -E \
  -e "s|(<meta name=\"app-version\" content=\")[^\"]*|\1$v|" \
  -e "s|((css\|js)/[a-z0-9_-]+\.(css\|js))(\?v=[0-9]+)?\"|\1?v=$v\"|g" \
  index.html
echo "app-version $v"
