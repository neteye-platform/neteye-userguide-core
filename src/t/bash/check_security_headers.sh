#!/usr/bin/env sh

set -e

# Checks the security headers set by nginx
# Can be triggered with BASE_URL=https://neteye.guide NETEYE_VERSION=4.51 sh src/t/bash/check_security_headers.sh

JIRA_HOST="https://siwuerthphoenix.atlassian.net"
CRA_REPORT_BUTTON_SINCE="4.51"

report() {
    printf "\t%s\n" "$1" | tee /tekton/results/status
}

# Succeeds if version $1 >= $2 (MAJOR.MINOR)
version_at_least() {
    awk -v a="$1" -v b="$2" 'BEGIN {
        split(a, x, "."); split(b, y, ".")
        exit !((x[1] + 0 > y[1] + 0) || (x[1] + 0 == y[1] + 0 && x[2] + 0 >= y[2] + 0))
    }'
}

get_headers() {
    curl -s -o /dev/null -D - "$1" | tr -d '\r'
}

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

# Browsers enforce every CSP header: a second one cancels the exceptions
assert_single_csp() {
    COUNT=$(header_values "$1" "Content-Security-Policy" | grep -c . || true)
    if [ "$COUNT" -ne 1 ]; then
        report "[-] Expected exactly one Content-Security-Policy header on $2, got ${COUNT}"
        return 1
    fi
    report "[+] Exactly one Content-Security-Policy header on $2"
}

URL="${BASE_URL}/${NETEYE_VERSION}/index.html"
echo "[i] Testing security headers on ${URL}"
HEADERS=$(get_headers "$URL")
assert_header_present "$HEADERS" "Strict-Transport-Security" "$URL"
assert_single_csp "$HEADERS" "$URL"
if header_values "$HEADERS" "Content-Security-Policy" | grep -q "$JIRA_HOST"; then
    report "[-] The Content-Security-Policy on ${URL} must not allow ${JIRA_HOST}"
    exit 1
fi

URL="${BASE_URL}/versions.json"
echo "[i] Testing security headers on ${URL}"
HEADERS=$(get_headers "$URL")
assert_header_present "$HEADERS" "Strict-Transport-Security" "$URL"
assert_header_present "$HEADERS" "Access-Control-Allow-Origin" "$URL"

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
