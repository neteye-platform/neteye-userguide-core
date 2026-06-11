#!/usr/bin/env sh

set -e

# This script is intended to execute some simple tests checking that every .rst file included in a page
# matches the standard to have the .inc suffix. For more information consult https://www.neteye.guide/current/guidelines.html
# Can be triggered with sh src/t/bash/check_included_files.sh

SOURCE_DIR="./sphinx/source"

echo "[!] Check that all included files have the correct format"

RST_FILES=$(find "${SOURCE_DIR}" -type f -name "*.rst")

for file in $RST_FILES; do
    INCLUDED_FILES=$(grep ".. include:: " "$file" | awk '{print $NF}')
    for included_file in $INCLUDED_FILES; do
        if ! echo "$included_file" | grep '.inc.rst' >/dev/null 2>&1; then
            echo "[-] Included file ${included_file} in ${file} not marked as '.inc.rst':"
            echo "All files which are included in other files must have the '.inc.rst’ extension."
            echo "To fix this error please rename the included file setting the '.inc.rst' extension."
            echo "For more information about user guide guidelines, consult https://www.neteye.guide/next/guidelines.html"
            exit 1
        fi
    done
done

echo "[!] Check that all included files have the correct format completed successfully!"
