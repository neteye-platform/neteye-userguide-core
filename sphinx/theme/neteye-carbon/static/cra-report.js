// Binds the Jira issue collector of the CRA incident report to the "Report a CRA incident" button.
// Kept as a static file instead of an inline script so that it is allowed by the 'self' script-src
// of the Content-Security-Policy. It must be loaded before the issue collector script.

window.ATL_JQ_PAGE_PROPS = {
    "triggerFunction": function (showCollectorDialog) {
        var trigger = document.getElementById("cra-report-trigger");
        if (!trigger) { return; }
        trigger.addEventListener("click", function (event) {
            event.preventDefault();
            showCollectorDialog();
        });
    }
};
