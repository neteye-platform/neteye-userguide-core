// Test that the top menu dropdowns ("Getting Started", "Core Modules", ..., and the version switcher) never extend
// past the bottom of the window and can always be scrolled to their last item, whatever the window height.

import { test, expect, Page, Locator } from '@playwright/test';

// Carbon "xlg" breakpoint (82rem at the 16px browser default): from here on the top menu is shown
const CARBON_BREAKPOINT_XLG = 1312;
// From very short windows, where every dropdown overflows, to a common laptop height
const VIEWPORT_HEIGHTS = [250, 500, 851];

const SECTION_MENUS = '#topbar cds-header-nav cds-header-menu';
const VERSION_MENU = '#topbar #change-version';

// Enough versions that the version switcher overflows at every tested height
const MOCK_VERSIONS = Array.from({ length: 30 }, (_, i) => ({ version: `4.${20 + i}`, released: i < 25 }));

async function openPage(page: Page, baseURL: string | undefined) {
    await page.route('**/versions.json', (route) => route.fulfill({ json: MOCK_VERSIONS }));
    await page.route('**/last_archived_version.json', (route) =>
        route.fulfill({ json: { last_archived_version: '4.10' } }));
    await page.goto(baseURL + '/index.html');
    // Accept cookies so that the banner doesn't cover the dropdowns
    await page.locator('button.btn-accept-cookie').click();
}

async function expectDropdownScrollable(page: Page, menu: Locator) {
    const viewportHeight = page.viewportSize()!.height;
    const items = menu.locator('cds-header-menu-item');
    expect(await items.count()).toBeGreaterThan(0);

    await menu.locator('a[part~="trigger"]').click();
    const body = menu.locator('ul[part~="menu-body"]');
    await expect(body).toBeVisible();

    // The dropdown must end within the window
    const box = (await body.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);

    // A dropdown longer than the window must scroll with the mouse wheel, without scrolling the page behind it.
    // A dropdown that fits is not scrollable, so the wheel would rightly scroll the page instead.
    const { scrollHeight, clientHeight } = await body.evaluate(
        (element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    if (scrollHeight > clientHeight) {
        const pageScrollBefore = await page.evaluate(() => window.scrollY);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, scrollHeight);
        await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
    }

    // Either way, the last item must be fully visible
    await expect(items.last()).toBeInViewport({ ratio: 1.0 });

    // Close the dropdown again
    await menu.locator('a[part~="trigger"]').click();
    await expect(body).toBeHidden();
}

for (const height of VIEWPORT_HEIGHTS) {
    test.describe(`With a ${height}px high window`, () => {
        test.use({ viewport: { width: CARBON_BREAKPOINT_XLG, height } });

        test('every section dropdown fits the window and scrolls to its last item', async ({ page, baseURL }) => {
            await openPage(page, baseURL);

            const menus = page.locator(SECTION_MENUS);
            const count = await menus.count();
            expect(count).toBeGreaterThan(0);

            for (let index = 0; index < count; index++) {
                const menu = menus.nth(index);
                const title = await menu.getAttribute('trigger-content');
                await test.step(`"${title}" dropdown`, async () => {
                    await expectDropdownScrollable(page, menu);
                });
            }
        });

        test('version dropdown fits the window and scrolls to its last item', async ({ page, baseURL }) => {
            await openPage(page, baseURL);

            const menu = page.locator(VERSION_MENU);
            // Wait for topbar.js to fill the menu: one item per mocked version plus "Old Versions"
            await expect(menu.locator('cds-header-menu-item')).toHaveCount(MOCK_VERSIONS.length + 1);

            // The mocked list is longer than the window, so the dropdown must really overflow and scroll
            await menu.locator('a[part~="trigger"]').click();
            const body = menu.locator('ul[part~="menu-body"]');
            await expect(body).toBeVisible();
            expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
            await menu.locator('a[part~="trigger"]').click();

            await expectDropdownScrollable(page, menu);
        });
    });
}
