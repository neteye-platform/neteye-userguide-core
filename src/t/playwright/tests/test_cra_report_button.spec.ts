// Test that the CRA report button opens the Jira Issue Collector form without CSP violations

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('CRA report button opens the incident form without CSP violations', async ({ page, baseURL }) => {

    test.setTimeout(30_000);

    await page.addInitScript(() => {
        (window as any).cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
            (window as any).cspViolations.push(event.violatedDirective + ' ' + event.blockedURI);
        });
    });

    const version = new URL(baseURL).pathname.split("/")[1];
    expect(version, 'baseURL must end with a version, e.g. https://neteye.guide/4.51').toMatch(/^\d+\.\d+$/);

    // The button exists from 4.51
    const [major, minor] = version.split(".").map(Number);
    test.skip(major < 4 || (major === 4 && minor < 51), 'This version has no CRA report button');

    await page.goto(baseURL + "/security-policy/cra-compliance.html");

    const button = page.locator('#cra-report-trigger');
    await expect(button).toHaveCount(1);

    const acceptCookies = page.locator('button.btn-accept-cookie');
    if (await acceptCookies.isVisible()) {
        await acceptCookies.click();
    }

    await button.click();

    const collector = page.frameLocator('iframe[src*="siwuerthphoenix.atlassian.net"]');
    await expect(collector.getByRole('heading', { name: 'Report a security incident' })).toBeVisible({ timeout: 15_000 });
    await expect(collector.locator('#jic-collector-form #summary')).toBeVisible();

    expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});
