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

    echo "[+] Moving to subproject $PROJECT_DIR"
    # cannot use popd because it is not compatible with sh and therefore
    # does not work on some minimale containers without bash
    cd "$PROJECT_DIR"

    if git ls-remote --exit-code --heads origin "$BRANCH_NAME"; then
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
DEFAULT_BRANCH="main"
SUBMODULE_BASE_DIR="sphinx/source"

if [ -z "$TARGET_BRANCH" ]; then
    TARGET_BRANCH="$DEFAULT_BRANCH"
fi

echo "[+] Initializing submodules"
git submodule update --init --remote

checkout_branch_if_exists "$SUBMODULE_BASE_DIR" "$TARGET_BRANCH" "$DEFAULT_BRANCH"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/nep" "$TARGET_BRANCH" "$DEFAULT_BRANCH"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/satayo" "$TARGET_BRANCH" "$DEFAULT_BRANCH"
checkout_branch_if_exists "$SUBMODULE_BASE_DIR/troubleshooting" "$TARGET_BRANCH" "$DEFAULT_BRANCH"
