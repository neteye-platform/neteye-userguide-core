#!/usr/bin/env sh

# Uploads the archived userguide zips in $1 to the GitHub release hosting them.
# Zips already on the release are skipped, since archived versions never change.
# Requires curl, jq and GH_TOKEN with contents:write on the repo.
#
# One-time bootstrap from the current prod image:
#   podman create --name ug ghcr.io/witglobal/neteye-userguide-prod:latest
#   podman cp ug:/usr/share/nginx/html/archived ./archived && podman rm ug
#   GH_TOKEN=$(gh auth token) ./src/scripts/upload_archived_versions.sh ./archived

set -eu

ARCHIVED_DIR="${1:-}"
GH_REPO=${GH_REPO:-neteye-platform/neteye-userguide-core}
RELEASE_TAG=${RELEASE_TAG:-archived-docs}
API="${GITHUB_API_URL:-https://api.github.com}/repos/$GH_REPO"
UPLOADS="${GITHUB_UPLOADS_URL:-https://uploads.github.com}/repos/$GH_REPO"

if [ -z "$ARCHIVED_DIR" ]; then
    echo "Usage: $0 <dir with 4.X.zip files>"
    exit 1
fi

gh_api() {
    curl -sSf -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$@"
}

if ! release=$(gh_api "$API/releases/tags/$RELEASE_TAG" 2>/dev/null); then
    echo "Creating release $RELEASE_TAG"
    release=$(gh_api -X POST "$API/releases" -d "$(jq -n --arg tag "$RELEASE_TAG" '{
        tag_name: $tag, name: "Archived userguide versions", make_latest: "false",
        body: "Zipped userguide versions no longer served online, linked from the archived page."}')")
fi
release_id=$(echo "$release" | jq -r .id)
assets=$(gh_api "$API/releases/$release_id/assets?per_page=100")
existing=$(echo "$assets" | jq -r '.[].name')

for zip in "$ARCHIVED_DIR"/4.*.zip; do
    [ -e "$zip" ] || continue
    name=$(basename "$zip")
    if echo "$existing" | grep -qxF "$name"; then
        echo "Skipping $name, already uploaded"
        continue
    fi
    echo "Uploading $name"
    gh_api -X POST -H "Content-Type: application/zip" --data-binary "@$zip" \
        "$UPLOADS/releases/$release_id/assets?name=$name" >/dev/null
done
