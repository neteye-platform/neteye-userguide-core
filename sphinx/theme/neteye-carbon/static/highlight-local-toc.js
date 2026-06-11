// This JS code implements a scrollspy on the local toc in order to highlight it. It addresses some problems such as:
// A: we have nested sections which have the same 'bottom' value and as such start intersecting the viewport at the same time.
// B: We can have multiple sections visible, of which we only want to highlight the one on the top.
// C: Sometimes, we also have to only highlight a "parent" section without its subsection, thus a full tree traversal is not always correct.

const callback = (entries, observer) => {
    entries.forEach((entry) => {
        const selector = `a[href=\"#${entry.target.id}\"].nav-link`;
        const toctree_entry = document.querySelector(selector);

        if (toctree_entry != null){
            if (entry.isIntersecting) {
                toctree_entry.classList.add("active");
            } else {
                toctree_entry.classList.remove("active");
            }
        }
    });
}


// IntersectionObserver options. Due to compatibility issues, we have to manually calculate where to put the border.
// When "scrollMargin" becomes available everywhere and works with negative values, we can use that.

const options = {
    root: document.querySelector(".body"),
    // thin line at the top of the observed element, with an arbibrary offset to skip the topbar and make the transitions prettier.
    // 32px is the space between sections, it's there to prevent "blank zones" where no toc-item is highlighted.
    rootMargin: `${-64 + 32}px 0px ${-window.innerHeight + 64}px 0px`,
    threshold: 0,
}

let observer = new IntersectionObserver(callback, options);

// Only start observing when the page loaded, else the <section>s won't be loaded yet
window.onload = function (){
    // Observe all the <section>s in the .body
    document.querySelectorAll(".body section").forEach((section) => {
        observer.observe(section);
    });
};

window.onresize = function () {
    // Disconnect and re-observe to recalculate margins
    observer.disconnect();
    options.rootMargin = `${-64 + 32}px 0px ${-window.innerHeight + 64}px 0px`;
    observer = new IntersectionObserver(callback, options);

    document.querySelectorAll(".body section").forEach((section) => {
        observer.observe(section);
    });
};
