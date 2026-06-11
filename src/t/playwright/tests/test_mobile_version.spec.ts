import { test, expect} from "@playwright/test";

const clientWidth = 300;

test.use({
    viewport: { width: clientWidth, height: 851 },
});

test("Does not scroll horizontally", async ({ page, baseURL }) => {
    await page.goto(baseURL + "/");
    const body_width =  await page.evaluate(() => document.body.scrollWidth);

    expect(body_width).toBeLessThanOrEqual(clientWidth);
});



test('Test if left side-menu opens and closes correctly', async ({ page, baseURL }) => {

    await page.goto(baseURL + "/getting-started/functional-overview/introduction.html");

    const menu_button = page.locator("#topbar cds-header-menu-button").first();

    // Ensure the menu is completely out of view, then click the button to open it

    let sideMenu = await page.locator("cds-side-nav-items.side-menu-general");
    let sideMenuWidth = (await sideMenu.boundingBox()).width;
    await expect.poll(async () => (await sideMenu.boundingBox()).x).toBeLessThan(-sideMenuWidth);
    await expect(sideMenu).not.toBeInViewport(); // check if it's completely outside the viewport

    //click the menu, check if it correctly moves.
    await menu_button.click();
    await expect.poll(async () => (await sideMenu.boundingBox()).x).toBe(0); // This polling method solves any animation / synchronization issues
    await expect(sideMenu).toBeInViewport({ ratio: 1.0 });

    // Check if the correct submenus opened. Note: this assertions pass even when the menu is closed, as "closed" means "moved out of the viewport"
    const sideMenuTitleLvl0 = await page.locator("cds-side-nav-items.side-menu-general .side-menu-lvl0[active]").getAttribute("title");
    const sideMenuTitleLvl1 = await page.locator("cds-side-nav-items.side-menu-general .side-menu-lvl1[active]").getAttribute("title");
    const sideMenuTitleLvl2 = await page.locator("cds-side-nav-items.side-menu-general .side-menu-lvl2[active]"); // lvl2 items are different
    expect(sideMenuTitleLvl0).toMatch("Getting Started");
    expect(sideMenuTitleLvl1).toMatch("Functional Overview");
    expect(await sideMenuTitleLvl2.innerText()).toContain("Introduction to NetEye"); //there might be some space paddings inside the innerText, hence the `contains` and not the `equals`

    // Click on the lvl2 item, which is supposed to close the menu when clicked.
    await sideMenuTitleLvl2.click();

    // check if the menu closed correctly
    await expect.poll(async () => (await sideMenu.boundingBox()).x).toBeLessThan(-sideMenuWidth);
    await expect(sideMenu).not.toBeInViewport();
});
