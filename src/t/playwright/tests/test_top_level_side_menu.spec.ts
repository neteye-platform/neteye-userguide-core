// Test that the hamburger button and the side menu work on top-level pages (pages not belonging to a module).
// Below the Carbon "lg" breakpoint the top menu is replaced by the hamburger button, which must open the side menu.
// From the "lg" breakpoint on, the side menu must stay hidden on these pages.

import { test, expect, Page } from '@playwright/test';

// Carbon grid breakpoints: https://carbondesignsystem.com/elements/2x-grid/overview/#breakpoints
// Carbon defines them in rem (md 42rem, lg 66rem, xlg 82rem), here converted to px at the 16px browser default.
const CARBON_BREAKPOINT_MD = 672;
const CARBON_BREAKPOINT_LG = 1056;
const CARBON_BREAKPOINT_XLG = 1312;
const VIEWPORT_HEIGHT = 851;

const TOP_LEVEL_PAGES = [
    '/index.html',
    '/getting-started.html',
    '/core-modules.html',
    '/feature-modules.html',
    '/neteye-cloud.html',
    '/references.html',
    '/guidelines.html',
    '/genindex.html',
];

const HAMBURGER = '#topbar cds-header-menu-button';
const TOP_MENU = '#topbar cds-header-nav';
const TOP_MENU_SECTIONS = '#topbar cds-header-nav .header-menu';
const SIDE_MENU = '#sidebar';
const SIDE_MENU_GENERAL = '#sidebar cds-side-nav-items.side-menu-general';
const SIDE_MENU_SECTIONS = '#sidebar cds-side-nav-items.side-menu-general > .side-menu-lvl0';

async function openPage(page: Page, baseURL: string | undefined, path: string) {
    await page.goto(baseURL + path);
    // Accept cookies so that the banner doesn't cover the side menu
    await page.locator('button.btn-accept-cookie').click();
}

async function expectSideMenuClosed(page: Page) {
    const sideMenu = page.locator(SIDE_MENU_GENERAL);
    const sideMenuWidth = (await sideMenu.boundingBox())!.width;
    // Polling handles the slide animation
    await expect.poll(async () => (await sideMenu.boundingBox())!.x).toBeLessThan(-sideMenuWidth);
    await expect(sideMenu).not.toBeInViewport();
}

async function expectSideMenuOpen(page: Page) {
    const sideMenu = page.locator(SIDE_MENU_GENERAL);
    await expect.poll(async () => (await sideMenu.boundingBox())!.x).toBe(0);
    await expect(sideMenu).toBeInViewport({ ratio: 1.0 });
}

async function expectDesktopLayout(page: Page) {
    await expect(page.locator(TOP_MENU)).toBeVisible();
    await expect(page.locator(HAMBURGER)).toBeHidden();
    await expect(page.locator(SIDE_MENU)).toBeHidden();
}

test.describe('Below the lg breakpoint', () => {
    test.use({ viewport: { width: CARBON_BREAKPOINT_MD, height: VIEWPORT_HEIGHT } });

    for (const path of TOP_LEVEL_PAGES) {
        test(`hamburger opens and closes the side menu on ${path}`, async ({ page, baseURL }) => {
            await openPage(page, baseURL, path);

            await expect(page.locator(TOP_MENU)).toBeHidden();
            const hamburger = page.locator(HAMBURGER);
            await expect(hamburger).toBeVisible();

            await expectSideMenuClosed(page);
            await hamburger.click();
            await expectSideMenuOpen(page);

            // The side menu must offer the same sections as the (now hidden) top menu
            const expectedSections = await page.locator(TOP_MENU_SECTIONS)
                .evaluateAll((menus) => menus.map((menu) => menu.getAttribute('trigger-content')));
            expect(expectedSections.length).toBeGreaterThan(0);
            const sections = page.locator(SIDE_MENU_SECTIONS);
            await expect(sections).toHaveCount(expectedSections.length);
            for (const [index, title] of expectedSections.entries()) {
                await expect(sections.nth(index)).toHaveAttribute('title', title!);
                await expect(sections.nth(index)).toBeInViewport();
            }

            await hamburger.click();
            await expectSideMenuClosed(page);
        });
    }

    test('side menu sections expand and lead to a working page', async ({ page, baseURL }) => {
        await openPage(page, baseURL, '/index.html');
        await page.locator(HAMBURGER).click();
        await expectSideMenuOpen(page);

        const section = page.locator(SIDE_MENU_SECTIONS).first();
        await section.click();
        await expect(section).toHaveAttribute('expanded', '');

        const subsection = section.locator('> .side-menu-lvl1').first();
        await expect(subsection).toBeInViewport();
        await subsection.click();
        await expect(subsection).toHaveAttribute('expanded', '');

        const link = subsection.locator('> .side-menu-lvl2').first();
        await expect(link).toBeInViewport();
        const href = await link.getAttribute('href');
        expect(href).toBeTruthy();

        const [response] = await Promise.all([
            page.waitForNavigation(),
            link.click(),
        ]);
        expect(response?.ok()).toBe(true);
        expect(page.url()).not.toContain('404.html');
        expect(page.url()).toContain(href!.replace(/^(\.\.\/|\.\/)+/, ''));
    });
});

test.describe('From the xlg breakpoint', () => {
    test.use({ viewport: { width: CARBON_BREAKPOINT_XLG, height: VIEWPORT_HEIGHT } });

    for (const path of TOP_LEVEL_PAGES) {
        test(`top menu is shown and side menu is hidden on ${path}`, async ({ page, baseURL }) => {
            await openPage(page, baseURL, path);
            await expectDesktopLayout(page);
        });
    }
});

test.describe('At the lg breakpoint', () => {
    test.describe('just below it', () => {
        test.use({ viewport: { width: CARBON_BREAKPOINT_LG - 1, height: VIEWPORT_HEIGHT } });

        test('hamburger is shown and opens the side menu', async ({ page, baseURL }) => {
            await openPage(page, baseURL, '/index.html');

            await expect(page.locator(TOP_MENU)).toBeHidden();
            await expectSideMenuClosed(page);
            await page.locator(HAMBURGER).click();
            await expectSideMenuOpen(page);
        });
    });

    test.describe('exactly on it', () => {
        test.use({ viewport: { width: CARBON_BREAKPOINT_LG, height: VIEWPORT_HEIGHT } });

        test('top menu is shown and side menu is hidden', async ({ page, baseURL }) => {
            await openPage(page, baseURL, '/index.html');
            await expectDesktopLayout(page);
        });
    });
});
