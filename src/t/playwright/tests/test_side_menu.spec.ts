// Test that the side-menu is working as expected

import { test, expect } from '@playwright/test';

const clientWidth = 1200;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test('Test if left side-menu opens and closes correctly', async ({ page, baseURL }) => {

    await page.goto(baseURL + "/core-modules/director/monitoring-environment.html");

    // Check header title
    const moduleHeaderTitle = await page.locator(".side-menu-local .module-header").first().innerText();
    expect(moduleHeaderTitle).toMatch("Director");

    // check header icon
    const module_icon = page.locator(".core-module-icon").first();
    const isIconLoaded = await module_icon.evaluate((el) => {
        return el.complete && el.naturalWidth > 0; // Tests show that broken icons (looking for a missing .svg) are "complete" but have naturalWidth === 0.
    });
    expect(isIconLoaded, `This icon failed to load: ${await module_icon.getAttribute("src")}`).toBe(true);

    // Check if side menu is closed when first entering the page
    const parentMenu = await page.locator(".side-menu-parent");
    const parentMenuWidth = (await parentMenu.boundingBox()).width;
    await expect.poll(async () => (await parentMenu.boundingBox()).x).toBeLessThanOrEqual(-parentMenuWidth);
    await expect(parentMenu).not.toBeInViewport(); // check if it's completely outside the viewport

    // Open parent menu
    let parent_menu_button = await page.locator(".side-panel-header .summon-parent-menu").first();
    await parent_menu_button.click();

    // Check if side menu opened correctly
    await expect.poll(async () => (await parentMenu.boundingBox()).x).toBe(0);
    await expect(parentMenu).toBeInViewport({ ratio: 1.0 });

    // Check if the correct submenus opened.
    const sideMenuTitleLvl0 = await page.locator(".side-menu-parent .side-menu-lvl0[active]").innerText();
    expect(sideMenuTitleLvl0).toMatch("Director");

    // Close parent menu
    parent_menu_button = await page.locator(".side-panel-header .close-parent-menu").first();
    await parent_menu_button.click();

    // Check if side menu closed
    await expect.poll(async () => (await parentMenu.boundingBox()).x).toBeLessThanOrEqual(-parentMenuWidth);
    await expect(parentMenu).not.toBeInViewport(); // check if it's completely outside the viewport
});
