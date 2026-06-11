#!/usr/bin/env sh

set -x
set -e

versions_file=$1

if [ -z "$versions_file" ]; then
    echo "versions_file is mandatory"
    exit 1
fi

current_version=$(cat "$versions_file" | jq -c 'map(select(.released==true))' | jq -r ".[-1].version")
next_version=$(cat "$versions_file" | jq -c 'map(select(.released==false))' | jq -r ".[0].version")
alpha_version=$(cat "$versions_file" | jq -c 'map(select(.released==false))' | jq -r ".[-1].version")

if [ "$next_version" = "null" ]; then
    echo "[!] Unable to retrieve next version from versions.json!"
    exit 1
fi

if [ "$current_version" = "null" ]; then
    echo "[!] Unable to retrieve current version from versions.json!"
    exit 1
fi

if [ "$alpha_version" = "null" ]; then
    echo "[!] Unable to retrieve alpha version from versions.json!"
    exit 1
fi

sed -i s/"@@CURRENT_VERSION@@"/"$current_version"/g /tmp/nginx/conf.d/server/*
sed -i s/"@@NEXT_VERSION@@"/"$next_version"/g /tmp/nginx/conf.d/server/*
sed -i s/"@@ALPHA_VERSION@@"/"$alpha_version"/g /tmp/nginx/conf.d/server/*
