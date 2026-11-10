#!/usr/bin/env sh

set -e

# This script is intended to check the security headers that nginx sets (see conf/nginx/conf.d/).
# Since we are using alpine containers we have only sh and not bash
# Can be triggered with BASE_URL=https://neteye.guide NETEYE_VERSION=4.51 sh src/t/bash/check_security_headers.sh

JIRA_HOST="https://siwuerthphoenix.atlassian.net"
# First version whose CRA compliance page has the "Report a CRA incident" button
CRA_REPORT_BUTTON_SINCE="4.51"

# Prints a test result and stores it as the Tekton task result
report() {
    printf "\t%s\n" "$1" | tee /tekton/results/status
}

# Succeeds if version $1 is equal to or later than version $2 (format MAJOR.MINOR)
version_at_least() {
    awk -v a="$1" -v b="$2" 'BEGIN {
        split(a, x, "."); split(b, y, ".")
        exit !((x[1] + 0 > y[1] + 0) || (x[1] + 0 == y[1] + 0 && x[2] + 0 >= y[2] + 0))
    }'
}

# Prints the response headers of a URL, without following redirects
get_headers() {
    curl -s -o /dev/null -D - "$1" | tr -d '\r'
}

# Prints the values of all the headers with the given name (case-insensitive)
header_values() {
    printf "%s\n" "$1" | grep -i "^$2:" | cut -d ':' -f 2- || true
}

assert_header_present() {
    if [ -z "$(header_values "$1" "$2")" ]; then
        report "[-] Header $2 is missing on $3"
        return 1
    fi
    report "[+] Header $2 is present on $3"
}

# The browser enforces every Content-Security-Policy header it gets, so a second one (for example
# from a deployment config map) silently cancels the exceptions of the first one.
assert_single_csp() {
    COUNT=$(header_values "$1" "Content-Security-Policy" | grep -c . || true)
    if [ "$COUNT" -ne 1 ]; then
        report "[-] Expected exactly one Content-Security-Policy header on $2, got ${COUNT}"
        return 1
    fi
    report "[+] Exactly one Content-Security-Policy header on $2"
}

# Pages without an exception must use the default CSP, without the Jira host
URL="${BASE_URL}/${NETEYE_VERSION}/index.html"
echo "[i] Testing security headers on ${URL}"
HEADERS=$(get_headers "$URL")
assert_header_present "$HEADERS" "Strict-Transport-Security" "$URL"
assert_single_csp "$HEADERS" "$URL"
if header_values "$HEADERS" "Content-Security-Policy" | grep -q "$JIRA_HOST"; then
    report "[-] The Content-Security-Policy on ${URL} must not allow ${JIRA_HOST}"
    exit 1
fi

# Locations with their own add_header must keep the server-level headers
URL="${BASE_URL}/versions.json"
echo "[i] Testing security headers on ${URL}"
HEADERS=$(get_headers "$URL")
assert_header_present "$HEADERS" "Strict-Transport-Security" "$URL"
assert_header_present "$HEADERS" "Access-Control-Allow-Origin" "$URL"

# The CRA compliance page must allow the Jira Issue Collector (script and form iframe)
URL="${BASE_URL}/${NETEYE_VERSION}/security-policy/cra-compliance.html"
echo "[i] Testing security headers on ${URL}"
HEADERS=$(get_headers "$URL")
if ! printf "%s\n" "$HEADERS" | head -n 1 | grep -q " 200"; then
    if version_at_least "$NETEYE_VERSION" "$CRA_REPORT_BUTTON_SINCE"; then
        report "[-] ${URL} must exist from version ${CRA_REPORT_BUTTON_SINCE}: got '$(printf "%s\n" "$HEADERS" | head -n 1)'"
        exit 1
    fi
    report "[i] Skipped: ${URL} does not exist in this version"
    exit 0
fi
assert_header_present "$HEADERS" "Strict-Transport-Security" "$URL"
assert_single_csp "$HEADERS" "$URL"
CSP=$(header_values "$HEADERS" "Content-Security-Policy")
for DIRECTIVE in script-src frame-src; do
    if ! printf "%s\n" "$CSP" | tr ';' '\n' | grep "^ *${DIRECTIVE} " | grep -q "$JIRA_HOST"; then
        report "[-] The ${DIRECTIVE} directive on ${URL} must allow ${JIRA_HOST}"
        exit 1
    fi
done
report "[+] The Content-Security-Policy on ${URL} allows the Jira Issue Collector"
