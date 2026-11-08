#!/usr/bin/env bash
# Works out which package a release tag is for, and writes its directory to
# GITHUB_OUTPUT. A tag named for a package must match that package's version.
# Any other tag publishes the data package, as every release did before there
# were two packages.
set -euo pipefail

tag="$1"
root="$(cd "$(dirname "$0")/../.." && pwd)"

package="usa-club-rugby-data"
expected=""
for candidate in usa-club-rugby-components usa-club-rugby-data; do
  if [[ "$tag" == "$candidate-v"* ]]; then
    package="$candidate"
    expected="${tag#"$candidate-v"}"
  fi
done

directory="packages/$package"
if [[ -n "$expected" ]]; then
  actual="$(node -p "require('$root/$directory/package.json').version")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Tag $tag doesn't match $package's version, $actual." >&2
    exit 1
  fi
fi

echo "Publishing $package from $tag"
echo "directory=$directory" >> "${GITHUB_OUTPUT:-/dev/null}"
