# This dockerfile builds a lightweight container which expose the Userguide
# The container is unprivileged and use unprivileged ports (8080)
# to be compliant with OpenShift (and security) best practices
#
# You can build and run the container with following command:
# `docker build -t test_ug --build-arg UG_VERSION_TO_BUILD=4.28 -f Dockerfile --no-cache --progress=plain .`
# You can avoid call to api.neteye.cloud (e.g. in case of connection issues):
# adding the parameter `--build-arg VERSIONS_FILE_PATH=versions.json` having `versions.json` in the root of this project
# If not specified https://api.neteye.cloud/config/v1/versions.json will be downloaded.
#
# Docker image can be run with
#  docker run --rm -it --name test -p8080:8080 test_ug

ARG UG_HOME="/tmp/ug"
ARG UG_VERSION_TO_BUILD
ARG VERSIONS_FILE_PATH
ARG FEATURE_TO_BUILD
ARG BUILD_NUMBER
ARG IGNORE_WARNINGS


# Use a build container to compile in order to have all required tools
# but do not bring them in the final image to reduce space usage
FROM python:3.14.6-alpine3.23@sha256:02da11a8d221ca167aa07de20b3cd7104c1f01227f4b02b1fa13cf6517280a81 AS ug_builder
ARG UG_HOME
ARG UG_VERSION_TO_BUILD
ARG VERSIONS_FILE_PATH
ARG FEATURE_TO_BUILD
ARG BUILD_NUMBER
ARG IGNORE_WARNINGS

RUN apk add --no-cache curl=8.19.0-r0 grep=3.12-r0 jq=1.8.1-r0

COPY ./ $UG_HOME

# Generate about.html file, which is an hidden file used for check
RUN $UG_HOME/src/scripts/create_about_file.sh $UG_HOME $UG_VERSION_TO_BUILD $BUILD_NUMBER

# Get from internal endpoint only the to be built version dependencies graph images of NetEye parallel procedures
# hadolint ignore=DL4006
RUN mkdir -p /tmp/deps-graph-images/ && \
    curl -sk https://neteye-userguide-deps-graph.apps.rdopenshift.si.wp.lan/ | grep -oP "href=\"\K${UG_VERSION_TO_BUILD}-dependencies-[^\"]+\.svg" | xargs -I {} curl -sk https://neteye-userguide-deps-graph.apps.rdopenshift.si.wp.lan/\{\} -o /tmp/deps-graph-images/{} && \
    # Make available the dependencies graph images in the sphinx source and remove version from filename
    for f in /tmp/deps-graph-images/*; do \
    filename="$(basename "$f")"; \
    mv "$f" "$UG_HOME/sphinx/source/img/${filename#"$UG_VERSION_TO_BUILD-"}"; \
    done

# Compile NetEye Userguide
RUN $UG_HOME/src/scripts/build_neteye_userguide.sh $UG_HOME $UG_VERSION_TO_BUILD $FEATURE_TO_BUILD $IGNORE_WARNINGS


ENV VERSIONS_JSON=${VERSIONS_FILE_PATH:-"https://api.neteye.cloud/config/v1/versions.json"}
# this is actually a URL and ADD must be used
# hadolint ignore=DL3020
ADD "$VERSIONS_JSON" "$UG_HOME/versions.json"

# Create NginX rules for current and next version
COPY conf/nginx/conf.d/  /tmp/nginx/conf.d/
RUN $UG_HOME/src/scripts/create_nginx_rules.sh "$UG_HOME/versions.json"

###############################################################################
# Use the previous docker image as cache to retrieve non-rebuilt stages
# Is initially created using Dockerfile.migration (which converts legacy centos7 image to unprivileged image)
# and then this image is periodically updated in order to cache unchanged UG versions.
# hadolint ignore=DL3007
FROM docker-si.wuerth-phoenix.com/neteye-userguide-unprivileged-prod:latest AS previous_ug

################################################################################
# Archive old versions of the Userguide
FROM alpine:3.24.0@sha256:a2d49ea686c2adfe3c992e47dc3b5e7fa6e6b5055609400dc2acaeb241c829f4 AS ug_version_archiver
ARG UG_HOME
ARG UG_VERSION_TO_BUILD
ARG ARCHIVE_LAST_N_MINOR=12

COPY --from=previous_ug /usr/share/nginx/all /usr/share/nginx/all
RUN rm -rf /usr/share/nginx/all/$UG_VERSION_TO_BUILD/*
# We copy the archived versions from the previous image to not have to rebuild them
COPY --from=previous_ug /usr/share/nginx/html/archived /usr/share/nginx/html/archived
COPY --from=ug_builder $UG_HOME/sphinx/build/html/ /usr/share/nginx/all/$UG_VERSION_TO_BUILD/

# Now we have all the versions in /usr/share/nginx/all. We want to zip every
# version older than the last $ARCHIVE_LAST_N_MINOR minor versions and store it
# in /usr/share/nginx/html, the other ones we can create a symlink to the
# /usr/share/nginx/all/

RUN apk add jq=1.8.1-r0 zip=3.0-r13 --no-cache
COPY ./src/scripts/archive_ug_version.sh $UG_HOME/src/scripts/archive_ug_versions.sh
COPY --from=ug_builder "$UG_HOME/versions.json"  "$UG_HOME/versions.json"

RUN $UG_HOME/src/scripts/archive_ug_versions.sh

################################################################################
# Create a minimal and unprivileged docker in order to make it compatible with
# OpenShift beast practices out-of-the-box.
# This step is required to periodically update the nginx base image
FROM nginxinc/nginx-unprivileged:1.31.1-alpine-slim@sha256:6616de6eaa82bc2ee3541fa287a8fca7dc7271e6374e9402014dbd13f4a980ae
ARG UG_HOME
ARG UG_VERSION_TO_BUILD

COPY --from=ug_builder --chown=nginx:nginx /tmp/nginx/ /etc/nginx/
COPY --from=ug_version_archiver --chown=nginx:nginx --chmod=644 /usr/share/nginx/html /usr/share/nginx/html
# Use the just built version.json file instead of the one from the previous image
COPY --from=ug_builder --chown=nginx:nginx --chmod=644 $UG_HOME/versions.json  /usr/share/nginx/html/versions.json
RUN chmod 755 /usr/share/nginx/html/archived
COPY --from=ug_version_archiver --chown=nginx:nginx --chmod=755 /usr/share/nginx/all /usr/share/nginx/all

USER nginx

EXPOSE 8080
