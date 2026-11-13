#!/usr/bin/env bash
# Works out the version a release tag publishes, and writes it to GITHUB_OUTPUT.
# Every package is published together at the tag's version: the tag is the only
# record of it, as no package.json in the repo has one.
set -euo pipefail

tag="$1"
version="${tag#v}"

# Semantic versioning: MAJOR.MINOR.PATCH, with an optional pre-release such as -beta.1.
if [[ "$tag" != v* || ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Tag $tag isn't a version such as v1.2.3." >&2
  exit 1
fi

echo "Publishing every package as $version from $tag"
echo "version=$version" >> "${GITHUB_OUTPUT:-/dev/null}"
