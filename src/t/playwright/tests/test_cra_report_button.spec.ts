// Test that the "Report a CRA incident" button opens the Jira Issue Collector form
// and that the Content-Security-Policy does not block it (NUC-607)

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('CRA report button opens the incident form without CSP violations', async ({ page, baseURL }) => {

    test.setTimeout(30_000);

    // Record every CSP violation that the browser reports on the page
    await page.addInitScript(() => {
        (window as any).cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
            (window as any).cspViolations.push(event.violatedDirective + ' ' + event.blockedURI);
        });
    });

    // Versions before 4.51 report CRA incidents by email and have no button
    const [major, minor] = new URL(baseURL).pathname.split("/")[1].split(".").map(Number);
    test.skip(major < 4 || (major === 4 && minor < 51), 'This version has no CRA report button');

    await page.goto(baseURL + "/security-policy/cra-compliance.html");

    const button = page.locator('#cra-report-trigger');
    await expect(button).toHaveCount(1);

    // Accept cookies so that the banner does not cover the button
    const acceptCookies = page.locator('button.btn-accept-cookie');
    if (await acceptCookies.isVisible()) {
        await acceptCookies.click();
    }

    await button.click();

    // The collector opens its form in an iframe served by the Jira host
    const form = page.locator('iframe[src*="siwuerthphoenix.atlassian.net"]');
    await expect(form).toBeVisible({ timeout: 15_000 });

    expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});
