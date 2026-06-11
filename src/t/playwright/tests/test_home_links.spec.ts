// Test that the links in the home page are working as expected

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('Test links in the home page', async ({ page, baseURL }) => {

    // it takes long to cycle through all the links. For future developers: you get a 'Error: page.goto: Page closed'
    // error if the test is taking too long to run (timeout)
    test.setTimeout(120_000);

    // Navigate to the search page
    await page.goto(baseURL + "/index.html");

    const banner = await page.locator('.title-and-search-container cds-heading');
    await expect(banner).toHaveText('Welcome to the NetEye product documentation');

    // Accept cookies so that they don't cover links
    await page.locator('button.btn-accept-cookie').click();

    // loop all the links
    const links = await page.locator('.index-section .tile-container cds-clickable-tile').all();
    for (const link of links) {
        await link.click();
        await page.waitForLoadState('networkidle')

        // check if we are not been redirected to 404.html
        await expect(page.url()).not.toContain('404.html');

        await page.goto(baseURL + "/index.html");
        await page.waitForLoadState('networkidle');
    }
});
