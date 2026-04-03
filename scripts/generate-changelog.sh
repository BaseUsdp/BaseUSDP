#!/bin/bash
set -e
echo "# Changelog"
echo ""
TAGS=$(git tag --sort=-version:refname)
PREV=""
for TAG in $TAGS; do
  if [ -n "$PREV" ]; then
    echo "## $PREV"
    git log --pretty=format:"- %s" "$TAG..$PREV" --no-merges
    echo ""
  fi
  PREV=$TAG
done
