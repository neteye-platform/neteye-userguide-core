#!/bin/sh
set -e

# Userguide is composed by one "parent" project with several nested submodules
# neteye_userguide_core
#   |----> neteye_userguide_content
#             |----> nep-documentation
#                  > satayo-userguide
#                  > troubleshooting-userguide
#
# This script inits all submodules, then enter each submodule and checkout required branch.
# We assume that specified branch exists in all submodules (e.g. it is required to always create
# maint branches), if the expected branch does not exists we checkout latest master.

checkout_branch_if_exists() {
    PROJECT_DIR="$1"
    BRANCH_NAME="$2"
    DEFAULT_BRANCH="$3"
    REPO_NAME="$4"

    echo "[+] Moving to subproject $PROJECT_DIR"
    # cannot use popd because it is not compatible with sh and therefore
    # does not work on some minimale containers without bash
    cd "$PROJECT_DIR"

    # When this submodule is the one under test in a pull request from a fork, BRANCH_NAME only
    # exists on the fork, not on the submodule's own origin remote (a different owner/repo), so it
    # has to be fetched from SOURCE_URL directly instead of checked out from origin.
    if [ -n "$SOURCE_URL" ] && [ "$REPO_NAME" = "$SOURCE_REPO_NAME" ]; then
        echo "[i] Fetching $BRANCH_NAME from fork $SOURCE_URL"
        if git fetch "$SOURCE_URL" "$BRANCH_NAME"; then
            git checkout FETCH_HEAD
        else
            echo "[i] Branch $BRANCH_NAME does not exist on $SOURCE_URL, checking out branch $DEFAULT_BRANCH"
            git checkout "$DEFAULT_BRANCH"
        fi
        git submodule update --init --recursive --remote
    elif git ls-remote --exit-code --heads origin "$BRANCH_NAME"; then
        echo "[i] Checking out branch $BRANCH_NAME in directory $(pwd)"
        git checkout "$BRANCH_NAME"
        git submodule update --init --recursive --remote
    else
        echo "[i] Branch $BRANCH_NAME does not exists, checking out branch $DEFAULT_BRANCH"
        git checkout "$DEFAULT_BRANCH"
        git submodule update --init --recursive --remote
    fi
    cd -
    echo "[+] Done"
}

TARGET_BRANCH="$1"
SOURCE_REPO_NAME="$2"
SOURCE_URL="$3"
DEFAULT_BRANCH="main"
SUBMODULE_BASE_DIR="sphinx/source"

if [ -z "$TARGET_BRANCH" ]; then
    TARGET_BRANCH="$DEFAULT_BRANCH"
fi

echo "[+] Initializing submodules"

# .gitmodules uses a relative URL for sphinx/source, which git resolves against whatever
# remote this repo itself was cloned from. When cloned from a fork (a PR against this repo
# alone, without also forking neteye-userguide-content), that resolves to a submodule repo
# that doesn't exist under the fork owner, so force the real upstream URL here instead.
git config submodule."sphinx/source".url "https://github.com/neteye-platform/neteye-userguide-content.git"
git submodule update --init --remote

checkout_branch_if_exists "$SUBMODULE_BASE_DIR" "$TARGET_BRANCH" "$DEFAULT_BRANCH" "neteye-userguide-content"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/nep" "$TARGET_BRANCH" "$DEFAULT_BRANCH" "nep-documentation"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/satayo" "$TARGET_BRANCH" "$DEFAULT_BRANCH" "satayo-userguide"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/troubleshooting" "$TARGET_BRANCH" "$DEFAULT_BRANCH" "troubleshooting-userguide"
