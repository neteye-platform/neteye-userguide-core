// Test that the search query works as expected and the dedicated endpoint is called correctly

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('Search query calls the expected endpoint', async ({ page, baseURL }) => {

    test.setTimeout(10_000);

    // Navigate to the home page
    await page.goto(baseURL + "/index.html");

    // Fill the search query field. Specifically: fill the search bar inside the homepage
    const searchQuery = "test_query";
    await page.fill('#index-search-container #search #input', searchQuery);

    // Get version from neteye url
    const current_url = new URL(baseURL);
    const neteye_version = current_url.pathname.split("/")[1];

    // Press 'Enter' and check if the dedicated endpoint is called with the correct parameters
    const [request] = await Promise.all([
        page.waitForRequest(request => {
            const url = new URL(request.url());
            return url.pathname.includes('/query') && url.searchParams.get('query') === searchQuery && url.searchParams.get('neteye_version') === neteye_version;
        }),
        page.press('#index-search-container #search #input', 'Enter')
    ]);

    const url = new URL(request.url());
    expect(url.searchParams.get('query')).toBe(searchQuery);
});
