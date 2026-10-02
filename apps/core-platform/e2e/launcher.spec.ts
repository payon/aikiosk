import { test, expect } from "@playwright/test";

test("런처 그리드 렌더링", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("grid", { name: "앱 런처" })).toBeVisible();
});

test("SSO 흐름: 로그인 후 런처", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill("admin@rustkorea.cloud");
  await page.getByPlaceholder("password").fill("Admin123!");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL("/");
});
