#!/usr/bin/env sh

# This script is used to archive the versions of the USERGUIDE which is not required anymore.

set -e

NGINX_BASE_DIR=/usr/share/nginx
UG_ALL_DIR="$NGINX_BASE_DIR"/all
UG_TARGET_DIR="$NGINX_BASE_DIR"/html
UG_ARCHIVED_DIR="$UG_TARGET_DIR"/archived
NETEYE_VERSION_RE='^4\.[0-9]+$'
LATEST_NETEYE_MINOR=$(jq -r '.[] | select(.released == true) | .version' "$UG_HOME"/versions.json | sort -V | tail -n 1 | cut -d'.' -f2)
ARCHIVE_MINOR_VERSION_LESSTHAN_EQUAL_TO=$((LATEST_NETEYE_MINOR - ARCHIVE_LAST_N_MINOR))
LAST_ARCHIVED_VERSION_JSON_PATH="$UG_TARGET_DIR"/last_archived_version.json

echo "Archiving versions older than $ARCHIVE_MINOR_VERSION_LESSTHAN_EQUAL_TO"

# Check if the directory exists, if not create it
if [ ! -d $UG_ARCHIVED_DIR ]; then
    mkdir -p $UG_ARCHIVED_DIR
fi

cd $UG_ALL_DIR || exit

for dir in "$UG_ALL_DIR"/*/; do
    # If the directory is not a version directory, skip it
    if ! basename "$dir" | grep -qE "$NETEYE_VERSION_RE"; then
        echo "Moving $dir to $UG_TARGET_DIR"
        cp -r "$dir" $UG_TARGET_DIR
        continue
    fi

    CURR_VERSION=$(basename "$dir")
    CURR_MINOR=$(echo "$CURR_VERSION" | cut -d'.' -f2)

    if [ "$CURR_MINOR" -le "$ARCHIVE_MINOR_VERSION_LESSTHAN_EQUAL_TO" ]; then
        echo "Archiving $dir"
        (cd "$(dirname "$dir")" && zip --filesync --recurse-paths "$UG_ARCHIVED_DIR"/"$CURR_VERSION".zip "$(basename "$dir")")
    else
        echo "Linking $dir to $UG_TARGET_DIR"
        ln -s "$dir" $UG_TARGET_DIR
    fi
done

# We also save the last archived version in /usr/share/nginx/html/last_archived_version.json
echo "{\"last_archived_version\": \"4.$ARCHIVE_MINOR_VERSION_LESSTHAN_EQUAL_TO\"}" >"$LAST_ARCHIVED_VERSION_JSON_PATH"
