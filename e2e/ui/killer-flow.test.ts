import { test, expect } from "@playwright/test";

/**
 * Killer-flow E2E: CSV → Mock Agent → Preview → Verification Receipt → Export
 *
 * This test proves the core 1.0 demo path works end-to-end without
 * requiring any real coding-agent CLI to be installed.
 */

test("CSV fixture → mock convert → preview → verification receipt → export menu", async ({ page }) => {
  // 1. Load the app
  await page.goto("http://localhost:3000");

  // 2. Welcome modal: select Mock Agent
  await page.waitForSelector("[data-testid=welcome-modal]", { timeout: 5000 });
  await page.click("text=Mock Agent");
  await page.click("text=Enter Editor");

  // 3. Paste CSV fixture
  const csv = `department,score,headcount
Engineering,4.2,32
Design,4.7,12
Marketing,3.8,18
Product,4.5,8`;
  await page.fill("[data-testid=editor-textarea]", csv);

  // 4. Select Data Brief template
  await page.click("[data-testid=template-picker-button]");
  await page.click("text=Data Brief");

  // 5. Click Convert
  await page.click("[data-testid=convert-button]");

  // 6. Wait for preview iframe to render
  await page.waitForSelector("iframe[data-testid=preview-iframe]", { timeout: 15000 });
  const iframe = page.locator("iframe[data-testid=preview-iframe]");
  await expect(iframe).toBeVisible();

  // 7. Verification receipt should be visible (not hidden)
  await page.waitForSelector("[data-testid=verification-receipt]", { timeout: 15000 });
  const receipt = page.locator("[data-testid=verification-receipt]");
  await expect(receipt).toBeVisible();

  // 8. Score badge should show
  const scoreBadge = receipt.locator("[data-testid=score-badge]");
  await expect(scoreBadge).toBeVisible();
  const scoreText = await scoreBadge.textContent();
  expect(scoreText).toMatch(/^\d+$/); // Should be a number like "85"

  // 9. Source-key coverage should be visible
  const coverageRow = receipt.locator("text=Source-key coverage");
  await expect(coverageRow).toBeVisible();

  // 10. Export menu should open
  await page.click("[data-testid=export-menu-button]");
  await page.waitForSelector("[data-testid=export-menu]", { timeout: 5000 });
  await expect(page.locator("text=PNG")).toBeVisible();
  await expect(page.locator("text=PDF")).toBeVisible();
});
