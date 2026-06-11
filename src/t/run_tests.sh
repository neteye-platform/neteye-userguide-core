#!/usr/bin/env sh

set -e

export BASE_URL="$1"
export NETEYE_VERSION="$2"

find src/t/bash/ -type f | while IFS= read -r TEST_FILE; do
    echo "[i] Running test ${TEST_FILE}..."
    sh "$TEST_FILE"
    echo "[i] Test $TEST_FILE successfully completed!"
done
