#!/usr/bin/env bash
# Replace the vendored Quiet Pro package with a build of another release.
# Usage: npm run quiet-pro:update -- <tag-or-commit>   (needs read access to Carl0010/design-system)
set -euo pipefail
REF="${1:?Pass a tag or commit of Carl0010/design-system, e.g. v0.3.0}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet https://github.com/Carl0010/design-system "$TMP/ds"
git -C "$TMP/ds" checkout --quiet "$REF"
COMMIT="$(git -C "$TMP/ds" rev-parse --short HEAD)"
(cd "$TMP/ds" && npm pack --silent --pack-destination "$TMP" >/dev/null)
TGZ="$(ls "$TMP"/carl0010-quiet-pro-*.tgz)"

rm -f vendor/carl0010-quiet-pro-*.tgz
cp "$TGZ" vendor/
npm install "./vendor/$(basename "$TGZ")"
sed -i.bak -E "s/^Current: .*/Current: $(basename "$TGZ") from $REF (commit $COMMIT)/" vendor/README.md && rm -f vendor/README.md.bak
echo "Quiet Pro updated to $REF ($COMMIT). Run the contrast tests: npm test"
