import { test, expect } from '@playwright/test';

const clientWidth = 1500;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('Test if all sections are present in the local toc', async ({ page, baseURL }) => {

    // Navigate to the introduction page
    await page.goto(baseURL + "/feature-modules/alyvix/overview.html");
    await page.waitForLoadState('networkidle');

    const localTocLinks = await page.locator('#local-toc-nav a.nav-link').all();

    const hrefSections = await page.locator('.body section:has(a.headerlink)').all();
    expect(localTocLinks.length).toBe(hrefSections.length);
    for (let i = 0; i < localTocLinks.length; i++){
        const sectionTitle = await hrefSections[i].locator("h1, h2, h3, h4, h5, h6").first();
        await expect(sectionTitle).toContainText(await localTocLinks[i].innerText()); //note: href have a trailing '¶' character, so the order matters
    }
});

test('Test if scrolling through the page highlights the correct entry in the local toc', async ({ page, baseURL }) => {

    // Navigate to the introduction page
    await page.goto(baseURL + "/feature-modules/alyvix/overview.html");
    await page.waitForLoadState('networkidle');

    let sections = await page.locator(".body section").all();
    sections.shift(); //ignore first Title as it doesn't have highlighting

    // start scrolling
    while (true){
        let previousScrollPosition = await page.evaluate(() => window.scrollY);
        await page.evaluate(() => window.scrollBy({top: 100, left: 0, behavior: "instant"}));
        if (previousScrollPosition === await page.evaluate(() => window.scrollY)){ // if we reached the bottom, quit.
            break;
        }

        // get all the toc items. Querying the 'active' toc items would result in flakiness as it takes some time for the IntersectionObserver to update the <a> classes following a scroll
        let tocItems = await page.locator("#local-toc-nav nav a").all();
        tocItems.shift(); //skip first Title

        let topBarHeight = 64; // can be found in highlight-local-toc.js:29

        // get all sections that are intersecting the line dividing the top bar from the document body.
        for (const [i, section] of sections.entries()) {

            const tocTreeEntry = tocItems[i];

            // check if we are getting the correct entry, just to be sure.
            const header = await section.locator("h1, h2, h3, h4, h5, h6").first(); // this resolves to all descendant sections, thus `first()` is essential.
            await expect(header).toContainText(await tocTreeEntry.innerText());

            const sectionBB = await section.boundingBox();

            // check if the box intersects the top bar line (note: y === 0 when on the top)
            if (sectionBB.y < topBarHeight && sectionBB.y + sectionBB.height > topBarHeight){

                await expect(tocTreeEntry).toHaveClass(/(^|\s)active(\s|$)/); //only using `active` would fail as the actual class results in e.g. "nav-link active", which is != "active"

            }
        }

    }

});
