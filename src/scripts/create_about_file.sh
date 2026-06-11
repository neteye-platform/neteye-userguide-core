#!/usr/bin/env sh
set -e

UG_HOME=$1
FILENAME="${UG_HOME}/sphinx/source/about.rst"

BUILD_DATE="$(TZ=Europe/Rome date '+%Y.%m.%d %H:%M:%S %Z')"
BUILD_NEV="$2"
BUILD_NUMBER="$3"

cp "${UG_HOME}/src/scripts/templates/about.rst" "${FILENAME}"
sed -i "s%@@BUILD_DATE@@%${BUILD_DATE}%g" "${FILENAME}"
sed -i "s%@@BUILD_NEV@@%${BUILD_NEV}%g" "${FILENAME}"
sed -i "s%@@BUILD_NUMBER@@%${BUILD_NUMBER}%g" "${FILENAME}"
