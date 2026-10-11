#!/bin/sh
# Installs the pre-commit hook that bumps the app version whenever a commit
# touches index.html, css/ or js/. Run once per clone.
cd "$(dirname "$0")/.." || exit 1
cat > .git/hooks/pre-commit <<'HOOK'
#!/bin/sh
if git diff --cached --name-only | grep -qE '^(index\.html|css/|js/)'; then
  sh scripts/bump-version.sh >/dev/null && git add index.html
fi
HOOK
chmod +x .git/hooks/pre-commit
echo "pre-commit hook installed"
