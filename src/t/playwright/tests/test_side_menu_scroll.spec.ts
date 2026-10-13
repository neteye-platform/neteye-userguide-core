// Test that both desktop side menus (section menu and module list) scroll when they are taller than
// the window, and that they scroll below their top bar ("See all ... pages" / "Close") instead of
// behind it

import { test, expect, Locator } from '@playwright/test';

// Desktop layout (>= 1056px) in a short window, so that both menus need to scroll
test.use({
    viewport: { width: 1200, height: 260 },
});

// `scrollerCandidates`: the elements that may do the scrolling; the first one that is scrollable is used
async function expectScrollsBelowBar(scrollerCandidates: Locator[], bar: Locator, entries: Locator) {
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    const barBottom = barBox.y + barBox.height;

    // The menu is taller than its scrolling area
    let scroller: Locator | undefined;
    for (const candidate of scrollerCandidates) {
        if (await candidate.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== "hidden")) {
            scroller = candidate;
            break;
        }
    }
    expect(scroller, "the menu is not scrollable").toBeDefined();
    if (!scroller) return;

    // The scrolling area (and with it its scrollbar) starts at the bar's bottom edge, so entries
    // scrolled up are clipped there instead of showing behind the bar
    const scrollerBox = await scroller.boundingBox();
    expect(scrollerBox.y).toBeGreaterThanOrEqual(barBottom - 1);

    // Scroll to the end: the entries move up past the bar's edge and the last entry becomes visible
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    const firstEntryBox = await entries.first().boundingBox();
    expect(firstEntryBox.y).toBeLessThan(barBottom);

    const lastEntryBox = await entries.last().boundingBox();
    expect(lastEntryBox.y).toBeGreaterThanOrEqual(barBottom - 1);
    expect(lastEntryBox.y + lastEntryBox.height).toBeLessThanOrEqual(scrollerBox.y + scrollerBox.height + 1);

    // The bar is still on top and clickable
    const barIsHit = await bar.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(barIsHit).toBe(true);
}

test('Side menus scroll below their top bar', async ({ page, baseURL }) => {

    await page.goto(baseURL + "/feature-modules/elastic-stack/architecture.html");
    await expect(page.locator("body")).toHaveClass(/carbon-ready/);

    // Section menu: unfold all sections; it scrolls either itself or its menu body (in Carbon's shadow DOM)
    const sectionMenu = page.locator(".side-menu-local");
    await sectionMenu.locator(".side-menu-lvl0").evaluateAll((menus) => menus.forEach((m) => m.setAttribute("expanded", "")));

    await expectScrollsBelowBar(
        [sectionMenu.locator('[part="menu-body"]').first(), sectionMenu],
        page.locator(".side-panel-header .summon-parent-menu"),
        sectionMenu.locator("cds-side-nav-menu-item"),
    );

    // Module list: open it, then it scrolls itself
    await page.locator(".side-panel-header .summon-parent-menu").click();
    const moduleList = page.locator(".side-menu-parent");
    await expect.poll(async () => (await moduleList.boundingBox()).x).toBe(0);

    await expectScrollsBelowBar(
        [moduleList],
        page.locator(".side-panel-header .close-parent-menu"),
        moduleList.locator("cds-side-nav-link"),
    );
});
