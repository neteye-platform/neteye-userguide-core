#!/usr/bin/env sh

set -e

UG_HOME="$1"
UG_NETEYE_VERSION="$2"
FEATURE="$3"
IGNORE_WARNINGS="$4"

UG_VENV="/tmp/ug-virtualenv"
python3 -m venv ${UG_VENV}

# shellcheck disable=SC1091
. ${UG_VENV}/bin/activate
python3 -m pip install -r "${UG_HOME}/sphinx/requirements.txt"

# Configure the environment UG_NETEYE_VERSION so that sphinx/conf.py can understand which neteye version it's building
# and consequently set the sphinx variables related to the neteye version, so that they can be dynamically used in the
# User Guide.
export UG_NETEYE_VERSION="${UG_NETEYE_VERSION}"
export FEATURE="${FEATURE}"

# Build the UG looking for broken links, fail in case of any error
# TODO: The link check should be a separate pipeline, since it's not a blocking issue for the UG build.
# sphinx-build -c "${UG_HOME}/sphinx/" -b linkcheck "${UG_HOME}"/sphinx/source "$UG_HOME"/sphinx/build/linkcheck/

# Build the UG, fail in case of any warning
WARN="-W"
if [ "${IGNORE_WARNINGS}" = "true" ]; then
    WARN=""
fi

sphinx-build -c "${UG_HOME}/sphinx/" ${WARN} -b html "${UG_HOME}"/sphinx/source "$UG_HOME"/sphinx/build/html/
