(function (funcName, baseObj) {
    "use strict";
    // The public function name defaults to window.docReady
    // you can modify the last line of this function to pass in a different object or method name
    // if you want to put them in a different namespace and those will be used instead of
    // window.docReady(...)
    funcName = funcName || "docReady";
    baseObj = baseObj || window;
    let readyList = [];
    let readyFired = false;
    let readyEventHandlersInstalled = false;

    // call this when the document is ready
    // this function protects itself against being called more than once
    function ready() {
        if (!readyFired) {
            // this must be set to true before we start calling callbacks
            readyFired = true;
            for (let i = 0; i < readyList.length; i++) {
                // if a callback here happens to add new ready handlers,
                // the docReady() function will see that it already fired
                // and will schedule the callback to run right after
                // this event loop finishes so all handlers will still execute
                // in order and no new ones will be added to the readyList
                // while we are processing the list
                readyList[i].fn.call(window, readyList[i].ctx);
            }
            // allow any closures held by these functions to free
            readyList = [];
        }

        $('#fallback').hide();
    }

    function readyStateChange() {
        if (document.readyState === "complete") {
            ready();
        }
    }

    // This is the one public interface
    // docReady(fn, context);
    // the context argument is optional - if present, it will be passed
    // as an argument to the callback
    baseObj[funcName] = function (callback, context) {
        if (typeof callback !== "function") {
            throw new TypeError("callback for docReady(fn) must be a function");
        }
        // if ready has already fired, then just schedule the callback
        // to fire asynchronously, but right away
        if (readyFired) {
            setTimeout(function () {
                callback(context);
            }, 1);
            return;
        } else {
            // add the function and context to the list
            readyList.push({fn: callback, ctx: context});
        }
        // if document already ready to go, schedule the ready function to run
        // IE only safe when readyState is "complete", others safe when readyState is "interactive"
        if (document.readyState === "complete" || (!document.attachEvent && document.readyState === "interactive")) {
            setTimeout(ready, 1);
        } else if (!readyEventHandlersInstalled) {
            // otherwise if we don't have event handlers installed, install them
            if (document.addEventListener) {
                // first choice is DOMContentLoaded event
                document.addEventListener("DOMContentLoaded", ready, false);
                // backup is window load event
                window.addEventListener("load", ready, false);
            } else {
                // must be IE
                document.attachEvent("onreadystatechange", readyStateChange);
                window.attachEvent("onload", ready);
            }
            readyEventHandlersInstalled = true;
        }
    }
})("docReady", window);
// modify this previous line to pass in your own method name
// and object for the method to be attached to

function setCookie(cookieName, cookieValue, consensusRequired) {
    if (!consensusRequired || Cookies.get('user-accepts-cookies') === 'true') {
        Cookies.set(cookieName, cookieValue, {
            expires: 365,
            sameSite: 'strict'
        });
    }
}

/* Neteye JS entry point */
(function () {
    docReady(() => {
        initTracking();
        initCookie();
        initCodeHighlights();
        initUserGuideTheme();
        configureLinebreakPointsForUrls();
        AddVersionDirectiveTags();
        initFigureModals();

        $(document).on('click', 'a.headerlink', function (e) {
            e.preventDefault();
            copyHrefToClipboard(e);
        });
    });

    function copyToClipboard(textToCopy) {
        var $temp = $("<textarea>");
        $("body").append($temp);
        $temp.val(textToCopy).select();
        navigator.clipboard.writeText(textToCopy);
        $temp.remove();
    }

    function copyHrefToClipboard(e) {
        let currentUrl = window.location.toString();
        currentUrl = currentUrl.split('#')[0];
        const elementHref = e.target.getAttribute('href');
        const copyText = currentUrl + elementHref;
        copyToClipboard(copyText);
        $(e.target).append('<span class="tooltip"><span class="arrow"></span><span class="text">Copied!</span></span>');
        $(e.target).addClass('disabled');
        var tooltip = $(e.target).find('span.tooltip');
        setTimeout(() => {
          $(tooltip)
            .fadeOut(110, function () {
              $(this).remove();
            });

          $(e.target).removeClass("disabled");
        }, 1000);
    }

    function initTracking() {
        var _paq = window._paq = window._paq || [];
        _paq.push(['requireConsent']);
        _paq.push(['requireCookieConsent']);
        _paq.push(['trackPageView']);
        _paq.push(['enableLinkTracking']);
        // Modify the visitor cookie timeout to less than a year. Default is 13 months.
        _paq.push(['setVisitorCookieTimeout', '31449600']);
        (function () {
            var u = "https://analytics.neteye.cloud/";
            _paq.push(['setTrackerUrl', u + 'matomo.php']);
            _paq.push(['setSiteId', '1']);
            var d = document, g = d.createElement('script'),
                s = d.getElementsByTagName('script')[0];
            g.async = true;
            g.src = u + 'matomo.js';
            s.parentNode.insertBefore(g, s);
        })();
    }

    function consentTracking() {
        window._paq.push(['setConsentGiven']);
        window._paq.push(['setCookieConsentGiven']);
    }

    function initCookie() {
        if (Cookies.get('user-accepts-cookies') !== 'true') {
            $('#cookie-banner').show();
            $('#cookie-banner .btn-reject-cookie').on('click', function () {
                $('#cookie-banner').hide();
            });
            $('#cookie-banner .btn-accept-cookie').on('click', function () {
                consentTracking();
                Cookies.set('user-accepts-cookies', true, {
                    expires: 365,
                    sameSite: 'strict'
                });
                $('#cookie-banner').hide();
            });
        } else {
            consentTracking();
        }
    }

    function initCodeHighlights() {
        var codeHighlightNodes = $('.document .highlight');
        if (codeHighlightNodes.length === 0) {
            return;
        }

        /* Copy */
        codeHighlightNodes.delegate('button.copybtn', 'click', function (e) {
            var el = $(e.target).parent();
            if (el.length === 0) {
                return;
            }
            $(el).append('<span class="tooltip"><span class="arrow"></span><span class="text">Copied!</span></span>')
            var tooltip = $(el).find('span.tooltip');
            setTimeout(function () {
                $(tooltip).fadeOut(110, function (e) {
                    $(tooltip).remove();
                });
            }, 1000);
        });
    }

    function initUserGuideTheme() {
        const lightTheme = {
            "html": [],
            "body": ["cds-theme-zone-g10"],
            "#topbar": ["cds-theme-zone-g100"],
            "#sidebar": ["cds-theme-zone-white"],
            "#banner": ["cds-theme-zone-g100"],
            "#footer": ["cds-theme-zone-g100"],
            "#home-menu": ["cds-theme-zone-g100"]
        }
        const darkTheme = {
            "html": ["dark-html"],
            "body": ["cds-theme-zone-g90", "dark-theme"],
            "#topbar": ["cds-theme-zone-g100"],
            "#sidebar": ["cds-theme-zone-g100"],
            "#banner": ["cds-theme-zone-g100"],
            "#footer": ["cds-theme-zone-g100"],
            "#home-menu": ["cds-theme-zone-g100"]
        };

        const darkThemeCookieName = "neteye-userguide-theme";
        const useDarkTheme = (Cookies.get(darkThemeCookieName) === 'true');
        const theme = useDarkTheme ? darkTheme : lightTheme;

        Object.entries(theme).forEach(([selector, classNames]) => {
            classNames.forEach(className => document.querySelector(selector)?.classList.add(className));
        });

        document.querySelector('#topbar #switch-theme').addEventListener("click", () => {
            const useDarkTheme = (Cookies.get(darkThemeCookieName) === "true");
            setCookie(darkThemeCookieName, !useDarkTheme, false);
            [...Object.entries(darkTheme), ...Object.entries(lightTheme)].forEach(
                ([selector, classNames]) =>
                    classNames.forEach(
                        className => {
                            // We need this because the class is already on the body at page load to prevent flickering and inflating of elements
                            document.querySelector(selector)?.classList.remove("cds-theme-zone-g10");
                            document.querySelector(selector)?.classList.toggle(className);
                        }
                    )
            );
            void document.body.offsetWidth;
        });
    }

    function configureLinebreakPointsForUrls() {
        // For all code elements on the side that have no children
        for (const elem of $("code .pre:not(:has(*))")) {
            if (elem.textContent !== undefined) {
                // Append a word break to all / to keep the same behaviour for
                // line-breaks across browsers.
                elem.innerHTML = elem.innerHTML.replaceAll('/', '/<wbr>')
            }
        }
    }

    function extractBadgeContentFromMap(jsonMap) {
        var url = window.location.pathname;
        urlParts = url.split('/');

        /* Remove first part ("userguide" for local instance or "4.17" for online) */
        if (urlParts.length > 1) {
            urlParts.splice(1, 1);
            url = urlParts.join('/');
        }

        for (const property in jsonMap) {
            if (jsonMap[property].includes(url)) {
                return property;
            }
        }

        return false;
    }

    function AddVersionDirectiveTags() {
        addVersionDirectiveTagsForNew();
        addVersionDirectiveTagsForChanged();
        addVersionDirectiveTagsForDeprecated();
    }

    function addVersionDirectiveTagsForNew() {
        const versionModifiedAddedEle = $('.document .versionmodified.added');
        updateVersionModifiedDomElement(versionModifiedAddedEle);
    }

    function addVersionDirectiveTagsForChanged() {
        const versionModifiedChangedEle = $('.document .versionmodified.changed');
        updateVersionModifiedDomElement(versionModifiedChangedEle);
    }

    function addVersionDirectiveTagsForDeprecated() {
        const versionModifiedDeprecatedEle = $('.document .versionmodified.deprecated');
        updateVersionModifiedDomElement(versionModifiedDeprecatedEle);
    }

    function updateVersionModifiedDomElement(versionModifiedEle) {
        if (versionModifiedEle.length === 0) {
            return;
        }

        const regex = /^(New|Changed|Deprecated)\s.*version\s([\d+.\d+].*):/gm;
        let string = versionModifiedEle.text();
        let match;
        let modifiedDom;

        while ((match = regex.exec(string)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            modifiedDom = '<span class="versionmodified-type">' + match[1] + '</span>' +
                '<span class="version-' + match[1].toLowerCase() + '">' + match[2] + '</span>';
        }

        if (modifiedDom) {
            versionModifiedEle.html(versionModifiedEle.text().replace(regex, modifiedDom));
        }
    }

    function initFigureModals() {
        $("figure").click(function (e) {
            let img_src = e.currentTarget.querySelector('img').getAttribute('src');
            let img_caption = e.currentTarget.querySelector('figcaption');
            if (img_caption) {
                let cloned_img_caption = img_caption.cloneNode(true);
                document.querySelector('cds-modal-body').querySelector('figcaption').replaceWith(cloned_img_caption);
            }
            document.querySelector('cds-modal-body').querySelector('img').setAttribute('src', img_src);
            document.querySelector('cds-modal')?.toggleAttribute('open');
        });
    }
})();


// workaround to not flash web components
const carbonTags = [
    'cds-header',
    'cds-header-menu-button',
    'cds-header-name',
    'cds-header-global-action',
    'cds-header-nav',
    'cds-header-menu',
    'cds-header-menu-item',
    'cds-header-nav-item',
    'cds-side-nav',
    'cds-side-nav-menu',
    'cds-side-nav-menu-item',
    'cds-side-nav-items',
    'cds-side-nav-link',
];

Promise.all(carbonTags.map(tag => customElements.whenDefined(tag))).then((tag) => {
    const sideNav = document.querySelector("cds-side-nav");
    if (sideNav?.shadowRoot) {
        const shadowRoot = sideNav.shadowRoot;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        const version = window.location.pathname.split('/')[1];
        link.href = `/_static/carbon-custom-css/side-nav.css`;
        if (/^4\.\d+$/.test(version)) {
            link.href = `/${version}/_static/carbon-custom-css/side-nav.css`;
        }
        shadowRoot.appendChild(link);
    }
    document.body.classList.add('carbon-ready');
});
