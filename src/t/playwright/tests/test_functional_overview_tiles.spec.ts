// Test that the "linked-modules" tiles in the functional overview pages work

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('Test linked-modules tiles in functional overview pages', async ({ page, baseURL }) => {

    // Navigate to the root functional overview page
    await page.goto(baseURL + "/getting-started/functional-overview.html");

    // Accept cookies so that they don't cover links, just to be sure
    await page.locator('button.btn-accept-cookie').click();

    // Get all the links from the side-menu and loop over them
    const links = await page.locator('.local-side-menu .side-menu-lvl0').all();
    for (const link of links) {

        await link.click();
        await page.waitForLoadState('networkidle')

        // Check if we are not been redirected to 404.html
        await expect(page.url()).not.toContain('404.html');

        // Check if the title of the links corresponds with the first title (section > h1) in the document
        const link_title = await link.innerText();
        const first_h1 = await page.locator(".body section h1").first().innerText();
        expect(first_h1).toContain(link_title); // innerText() also contains the headerlink character "¶"

    }
});
