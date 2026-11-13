#!/usr/bin/env sh

# Uploads the archived userguide zips in $1 to the GitHub release hosting them.
# Zips already on the release are skipped, since archived versions never change.
# Requires gh authenticated with write access (e.g. GH_TOKEN).
#
# One-time bootstrap from the current prod image:
#   podman create --name ug ghcr.io/witglobal/neteye-userguide-prod:latest
#   podman cp ug:/usr/share/nginx/html/archived ./archived && podman rm ug
#   ./src/scripts/upload_archived_versions.sh ./archived

set -e

ARCHIVED_DIR="$1"
GH_REPO=${GH_REPO:-neteye-platform/neteye-userguide-core}
RELEASE_TAG=${RELEASE_TAG:-archived-docs}
export GH_REPO

if [ -z "$ARCHIVED_DIR" ]; then
    echo "Usage: $0 <dir with 4.X.zip files>"
    exit 1
fi

if ! gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
    echo "Creating release $RELEASE_TAG"
    gh release create "$RELEASE_TAG" --latest=false --title "Archived userguide versions" \
        --notes "Zipped userguide versions no longer served online, linked from the archived page."
fi

existing=$(gh release view "$RELEASE_TAG" --json assets --jq '.assets[].name')

for zip in "$ARCHIVED_DIR"/4.*.zip; do
    [ -e "$zip" ] || continue
    name=$(basename "$zip")
    if echo "$existing" | grep -qxF "$name"; then
        echo "Skipping $name, already uploaded"
        continue
    fi
    echo "Uploading $name"
    gh release upload "$RELEASE_TAG" "$zip"
done
