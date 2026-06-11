function loadScript(url) {
    const script = document.createElement('script');
    script.src = url;
    document.head.appendChild(script);
}

function highlightQueryWords(text, queryWords) {
    // Sanitize html tags from text and queryWords
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    queryWords = queryWords.map(word => word.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

    queryWords
        .filter(word => word.length >= 3)
        .forEach(word => {
            const regex = new RegExp(`(?:\\b|(?<=\\W))(${word})(?:\\b|(?<=\\W))`, 'gi');
            text = text.replace(regex, '<span class="highlighted">$1</span>');
        });
    return text;
}

const urlParams = new URLSearchParams(window.location.search);
const query = urlParams.get('q');
const queryWords = query.split(" ");

var urlParts = window.location.pathname.split("/").filter(function (el) {
    return el !== "";
});


// Get current user guide base URL
const UG_base_url = window.location.origin;

// execute request only if current neteye version is within the last 10 versions.
const versions = JSON.parse(Cookies.get('neteye_userguide_versions'));
const last10Versions = versions.slice(0, 10).map(version => version.version);

var neteye_version = urlParts[0];
// If neteye_version does not match the expected format "X.Y", use the latest version available.
// Should only happen in development mode.
if (!/^\d+\.\d+$/.test(neteye_version)) {
    console.error("Invalid neteye_version format: " + neteye_version + ". Defaulting to latest version: " + versions[0].version);
    neteye_version = versions[0].version; // Use the first version in the list as the latest
}
const url='https://search.neteye.guide/query?neteye_version=' + encodeURIComponent(neteye_version) + '&query=' + encodeURIComponent(query);

if (last10Versions.includes(neteye_version)) {
    fetch(url)
        .then(response => response.json())
        .then(result => {
            if (result.length) {
                result.forEach((result) => {
                    let result_item = document.createElement("li");
                    const result_link = document.createElement("a");
                    result_link.href = UG_base_url + result.href;

                    // Build pretty caption with an href before it so that users can discern pages with the same title
                    // e.g. /4.43/core-modules/itoa/module-permission.html#user-management -> core-modules/itoa/module-permission
                    const result_path = document.createElement("p");
                    result_path.className = "path";
                    result_path.innerText = result.href.replace(/^\/\d+\.\d+\//, '').split(".html")[0];

                    result_link.appendChild(result_path);
                    result_link.textContent = result.caption;

                    const result_context = document.createElement("p");
                    result_context.className = "context";
                    result_context.innerHTML = highlightQueryWords(result.context, queryWords);
                    result_item.appendChild(result_path);
                    result_item.appendChild(result_link);
                    result_item.appendChild(result_context);

                    document.querySelector("#search-results #results").appendChild(result_item);
                });

            } else {
                loadScript('searchindex.js');
            }
            return result; //pass result to further `.then`s
        })
        .catch(e => {
            // Called in case of an error in the call to our search functionality,
            // the fallback is then on sphinx search
            console.error(e);
            loadScript('searchindex.js');
        })
        .then(result => {
            // Track search event for new search. Initialize _paq if not already done by the other scripts (Async issues)
            window._paq = window._paq || [];
            window._paq.push(['trackSiteSearch', query, false, result.length]);
            // Set cookie if everything worked
            setCookie('neteye_userguide_search_performed', 'true', false);
        })
        .catch(e => {
            // log error so that a failure does not get unnoticed
            console.error("Cookie or analytics failure: \n%s", e);
        });
} else {
    loadScript('searchindex.js');
}


$(document).ready(function(){
    document.querySelector('.query').textContent += query;
    let numberOfResults = 0;
    numberOfResults = document.querySelectorAll("#search-results ul.search li").length;
    if (numberOfResults !== 0) {
        // Track search event for legacy search
        window._paq.push(['trackSiteSearch', query, false, numberOfResults]);
    }
    $(document).on('click', '.search li', function() {
        const link = $(this).find('a').eq(0);
        if (link.length) {
            link[0].click();
        }
    });
});
