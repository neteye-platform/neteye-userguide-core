#!/usr/bin/env sh

set -e

# This script is intended to execute some simple tests checking that UG is reachable as intended
# Since we are using alpine containers we have only sh and not bash
# Can be triggered with sh src/t/bash/check_reachability.sh neteye.guide "4.28"

test_url_reachability() {
    TARGET_URL=$1
    EXPECTED_CODE=$2
    echo "[i] Testing page ${TARGET_URL}"
    HTTP_STATUS=$(curl -L -s -o /dev/null -w "%{http_code}" "${TARGET_URL}")

    if [ "_${HTTP_STATUS}" = "_${EXPECTED_CODE}" ]; then
        printf "\t[+] Successfully tested page %s\n" "$TARGET_URL" | tee /tekton/results/status
    else
        printf "\t[-] Unable to contact page %s: got '%s' as http return code\n" "$TARGET_URL" "$HTTP_STATUS" | tee /tekton/results/status
        return 1
    fi
}

# Test some pages to check that all submodules (e.g. nep) are reachable
PAGES="/ /troubleshooting-userguide/troubleshooting.html /nep-userguide/doc/nep-introduction.html /satayo-userguide/doc/introduction.html /versions.json"
for PAGE in ${PAGES}; do
    URL="${BASE_URL}/${NETEYE_VERSION}${PAGE}"
    test_url_reachability "$URL" "200"
done

# Test that base path redirects properly
URL="${BASE_URL}/${NETEYE_VERSION}${PAGE}"
test_url_reachability "$URL" "200"

# If the page does not exists the user will be redirected to a "not found"
# page instead of getting 404 error
URL="${BASE_URL}/${NETEYE_VERSION}/my-nonexisting-page-which-does-not-exist.html"
test_url_reachability "$URL" "200"
