#!/usr/bin/env bash

# This script is only for internal use to build and run userguide locally. It assumes that port 8080 is free and
# that test_userguide_build_container, if running, can be safely killed.

DEVELOPMENT_MODE=false
PARALLEL=false
IGNORE_WARNINGS=false
# The check on the structure to be used is done also here so that devs have the possibility to specify it or not
# when building the UG locally. The default value is set to false for compatibility reasons.
UG_NETEYE_VERSION=
CONTAINER_ENGINE="podman"
CONTAINER_NETWORK_NAME="userguide"

FEATURE="prod"
# Available features
# To add a new feature, add it here and create the corresponding index-<feature>.rst file in sphinx/source/
AVAILABLE_FEATURES=("prod")

function usage() {
    echo "
OPTIONS:
  --version-to-build, -v    NetEye UG version to build (Required)
  --feature, -f             Feature to build (Optional)
  --development, -d         Run in development mode
                            (Default: ${DEVELOPMENT_MODE})
  --container-engine        Container engine to use, usually 'docker' or 'podman' (ignored if --development)
                            (Default: ${CONTAINER_ENGINE})
  --container-network       Container network name (ignored if --development)
                            (Default: ${CONTAINER_NETWORK_NAME})
  --parallel, -p            Run the build in multiple processes (see --jobs option of sphinx-autobuild)
                            [WARNING] This option do not grant the correct build of the userguide since it is an experimental feature and
                            may ignore errors during the build process.
                            (Default: ${PARALLEL})
  --ignore-warnings, -w     Keep building sources even if encountering a warning
  --help, -h                Show this message.
  "
}

ARGS=$(getopt -a -o dnhv: -o w --long version-to-build:,feature:,development,container-engine:,container-network:,parallel,ignore-warnings,help -- "$@")
if [ $# -eq 0 ]; then
    usage
    exit 0
fi

eval set -- "${ARGS}"
while :; do
    case $1 in
    --version-to-build | -v)
        UG_NETEYE_VERSION=$2
        shift 2
        ;;
    --feature | -f)
        FEATURE=$2
        shift 2
        ;;
    --development | -d)
        DEVELOPMENT_MODE=true
        shift
        ;;
    --container-engine)
        CONTAINER_ENGINE=$2
        shift 2
        ;;
    --container-network)
        CONTAINER_NETWORK=$2
        shift 2
        ;;
    --parallel | -p)
        PARALLEL=true
        shift
        ;;
    --ignore-warnings | -w)
        IGNORE_WARNINGS=true
        shift
        ;;
    --help | -h)
        usage
        exit 0
        ;;
    # -- means the end of the arguments; drop this, and break out of the while loop
    --)
        shift
        break
        ;;
    *)
        echo >&2 Unsupported option: "$1"
        usage
        exit 0
        ;;
    esac
done

if [ -z "${UG_NETEYE_VERSION}" ]; then
    echo "NetEye Version to build is required (e.g. '--version-to-build 4.42' or '-v 4.42')"
    exit 1
fi

if [[ -n "${FEATURE}" ]]; then
    FEATURE_SUPPORTED=false

    for AVAILABLE_FEATURE in "${AVAILABLE_FEATURES[@]}"; do
        if [[ "${AVAILABLE_FEATURE}" == "${FEATURE}" ]]; then
            FEATURE_SUPPORTED=true
            break
        fi
    done

    if [[ "${FEATURE_SUPPORTED}" == false ]]; then
        echo "Feature '${FEATURE}' is not supported. Available features are: ${AVAILABLE_FEATURES[*]}"
        exit 1
    fi
fi

handle_error() {
    RETURN_CODE="$1"
    ERROR_MESSAGE="$2"

    if [ "$1" != 0 ]; then
        echo "[!] ${ERROR_MESSAGE}"
        exit "${RETURN_CODE}"
    fi
}

if [ "$PARALLEL" = "true" ]; then
    JOBS_AUTO="--jobs auto"
else
    JOBS_AUTO=""
fi

# if DEVELOPMENT_MODE create a new virtualenv if it does not exist and install requirements_dev.txt
if [ "$DEVELOPMENT_MODE" = "true" ]; then
    VENV_DIR="./ug-dev-virtualenv"

    python3 -m venv "${VENV_DIR}"
    handle_error $? "Error creating virtualenv"

    # shellcheck disable=SC1091
    source ${VENV_DIR}/bin/activate

    python3 -m pip install -r ./sphinx/requirements_dev.txt
    handle_error $? "Error installing sphinx/requirements_dev.txt"

    export UG_NETEYE_VERSION="${UG_NETEYE_VERSION}"
    export FEATURE="${FEATURE}"
    export DEVELOPMENT_MODE="${DEVELOPMENT_MODE}"

    HTML_BUILD_DIR="./sphinx/build/html"
    mkdir -p ${HTML_BUILD_DIR}
    curl -o ${HTML_BUILD_DIR}/versions.json https://neteye.guide/versions.json
    curl -o ${HTML_BUILD_DIR}/last_archived_version.json https://neteye.guide/last_archived_version.json

    # Remove -a if needed (https://github.com/sphinx-doc/sphinx-autobuild#working-on-a-sphinx-html-theme)
    sphinx-autobuild -c ./sphinx/ -b html ./sphinx/source ${HTML_BUILD_DIR}/ --watch ./sphinx/theme/ "${JOBS_AUTO}" -a
else
    "$CONTAINER_ENGINE" build -t test_userguide_build --build-arg UG_VERSION_TO_BUILD="$UG_NETEYE_VERSION" --build-arg FEATURE_TO_BUILD="$FEATURE" --build-arg BUILD_NUMBER=666 -f Dockerfile --no-cache --progress=plain --build-arg IGNORE_WARNINGS="$IGNORE_WARNINGS" .
    handle_error $? "Error building container"

    CONTAINER_NETWORK="$("$CONTAINER_ENGINE" network ls -q -f "name=${CONTAINER_NETWORK_NAME}")"
    if [ -z "${CONTAINER_NETWORK}" ]; then
        "$CONTAINER_ENGINE" network create "${CONTAINER_NETWORK_NAME}"
    fi

    handle_error $? "Error creating the network 'userguide'"

    "$CONTAINER_ENGINE" rm -f test_userguide_build_container
    handle_error $? "Error removing old container 'test_userguide_build_container'"

    "$CONTAINER_ENGINE" run --name test_userguide_build_container -it -h neteye-guide --network userguide --rm -p8080:8080 test_userguide_build
    handle_error $? "Error starting container"
fi
