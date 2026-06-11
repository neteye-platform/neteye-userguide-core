from jira import JIRA
from operator import itemgetter
import natsort
import argparse
import urllib3
import json

urllib3.disable_warnings()

###
# This script is used to generate the versions.json used on https://neteye.guide/versions.json
###

json_indentation = 4
alias_separator = " "


def get_args():
    parser = argparse.ArgumentParser(description="Arguments")

    parser.add_argument(
        "-u",
        "--user",
        required=True,
        action="store",
        help="the user that calls the API",
    )

    parser.add_argument(
        "-t",
        "--token",
        required=True,
        action="store",
        help="the API token for the si.dev.atlassian (previously si.development) user",
    )

    parser.add_argument(
        "-p",
        "--project",
        required=False,
        action="store",
        help="the JIRA key for the project to look for",
    )

    parser.add_argument(
        "-f",
        "--folder",
        required=False,
        action="store",
        help="folder to scan to look for ug versions",
    )

    parser.add_argument(
        "-v",
        "--last_version",
        required=True,
        action="store",
        help="Build from ne 4.17 to ne-last_version",
    )
    args = parser.parse_args()
    return args


# returns a JIRA object
def connect_to_jira(user, token):
    options = {"server": "https://siwuerthphoenix.atlassian.net/", "verify": True}
    return JIRA(options, basic_auth=(user, token))


# dumps a list of dictionary to a json file
def dump_to_json_file(dictionary_list, file_path):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(dictionary_list, f, ensure_ascii=False, indent=json_indentation)


def get_neteye_version(jira_version):
    """Generate a NetEye version json object from a jira version
    Versions are allowed of the forms:
        * 4.47
        * 4.47 2030-10
    """
    split_name = jira_version.name.split(alias_separator, 1)
    neteye_version = {
        "version": split_name[0],
        "released": jira_version.released,
    }
    if len(split_name) > 1:
        neteye_version["alias"] = split_name[1]
    return neteye_version


def get_userguide_versions(last_version):
    # return a list of versions from 4.17 to neteye_last_version
    major, minor = map(int, last_version.split("."))
    if major != 4:
        raise NotImplementedError("can build only for ne 4.x")
    return [f"4.{i}" for i in range(17, int(minor) + 1)]


def main():
    args = get_args()
    user = args.user
    token = args.token

    project_key = "NEPROD"
    if args.project:
        project_key = args.project

    root_path = "/var/www/html/"
    if args.folder:
        root_path = args.folder
    versions_file = root_path + "/versions.json"

    userguide_versions = get_userguide_versions(args.last_version)

    jira = connect_to_jira(user, token)
    version_list = []
    for jira_version in jira.project_versions(project_key):
        neteye_version = get_neteye_version(jira_version)

        if neteye_version["version"] in userguide_versions:
            version_list.append(neteye_version)

    sorted_list = natsort.natsorted(version_list, key=itemgetter(*["version"]))

    dump_to_json_file(sorted_list, versions_file)
    print(
        "Wrote to '"
        + versions_file
        + "'\n"
        + json.dumps(sorted_list, indent=json_indentation)
    )


if __name__ == "__main__":
    main()
