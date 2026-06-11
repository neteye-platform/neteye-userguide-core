/* Init current version */
var urlParts = window.location.pathname.split("/").filter(function (el) {
    return el !== "";
});
if (urlParts.length > 0 && !isNaN(parseFloat(urlParts[0]))) {
    const changeVersionElement = document.querySelector("#change-version");
    const currentVersionText = getVersionText(urlParts[0]);
    changeVersionElement.setAttribute("menu-label", currentVersionText);
    changeVersionElement.setAttribute("trigger-content", currentVersionText);
}

const versionsUrl = "/versions.json"
const lastArchivedVersionUrl = "/last_archived_version.json";

/* Load all versions */
fetch(versionsUrl, {cache: "no-cache"})
    .then((response) => response.json())
    .then((data) => initVersions(data))
    .catch(() => initVersions([]));


function setNeteyeVersionsInCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function change_version(version) {
    if (window.location.pathname.includes("/archived.html")) {
        window.location = "/" + version + "/index.html";
        return;
    }

    const current_location = window.location.pathname.replace(/^\/.*?\//, "/");
    window.location = "/" + version + current_location + window.location.hash;
}

async function initVersions(versions) {
    // get last archived version from /last_archived_version.json
    const last_archived_version = (
        await (await fetch(lastArchivedVersionUrl)).json()
    ).last_archived_version;

    //version will be 4.xx, drop the 4. and convert to int
    const last_archived_minor = parseInt(last_archived_version.split(".")[1]);

    // drop versions which are less or equal to the last archived version
    versions = versions.filter((version) => {
        const minor = parseInt(version.version.split(".")[1]);
        return minor > last_archived_minor;
    });

    const sortedVersions = sortVersions(versions);
    setNeteyeVersionsInCookie(
        "neteye_userguide_versions",
        JSON.stringify(sortedVersions),
        365,
    );

    for (let versionObj of sortedVersions) {
        let releaseStatus = "";
        if ("release_status" in versionObj) {
            releaseStatus = versionObj["release_status"];
        }
        const menuItem = document.createElement("cds-header-menu-item");
        // Using onclick instead of href to preserve the hash in the URL
        menuItem.onclick = () => change_version(versionObj["version"]);
        menuItem.innerHTML = getVersionText(`${versionObj["version"]}${releaseStatus}`);
        document.querySelector("#change-version").appendChild(menuItem);
    }

    const menuItem = document.createElement("cds-header-menu-item");
    menuItem.href = "/archived.html";
    menuItem.innerHTML = 'Old Versions';
    document.querySelector("#change-version").appendChild(menuItem);
}

function getVersionText(version) {
    return `v${version}`;
}

function sortVersions(versions) {
    versions.sort((a, b) =>
        (parseInt(b.version.split(".")[0]) === parseInt(a.version.split(".")[0]) &&
            parseInt(b.version.split(".")[1]) >= parseInt(a.version.split(".")[1])) ||
        parseInt(b.version.split(".")[0]) > parseInt(a.version.split(".")[0])
            ? 1
            : -1,
    );

    return tagCurrentAndNextVersionReleaseStatus(versions);
}

function tagCurrentAndNextVersionReleaseStatus(versions) {
    for (let i = 0; i < versions.length; ++i) {
        if (versions[i]["released"]) {
            versions[i]["release_status"] = " (current)";
            const next = i - 1;
            if (next >= 0) {
                versions[next]["release_status"] = " (next)";
                const alpha = next - 1;
                if (alpha >= 0) {
                    versions[alpha]["release_status"] = " (alpha)";
                }
            }
            break;
        }
    }

    return versions;
}

/* search display/hide on scroll for index page */

window.addEventListener('load', () => {
    const indexSearchContainer = document.querySelector('#index-search-container');
    const topbarSearch = document.querySelector('#topbar-search');

    if (indexSearchContainer && topbarSearch) {
        handleSearchBoxVisibility();
        window.addEventListener('scroll', handleSearchBoxVisibility);
    }

    function handleSearchBoxVisibility() {
        const bounds = indexSearchContainer?.getBoundingClientRect();
        if (!bounds || !topbarSearch) return;
        const isOutOfView = bounds.top < 0 || bounds.bottom > window.innerHeight;
        topbarSearch.classList.toggle('show', isOutOfView);
    }
})
