import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  projects: [
    { name: "mobile", use: { ...devices["iPhone 12"] } },
    { name: "tablet", use: { ...devices["iPad Pro"] } },
    { name: "desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "kiosk", use: { viewport: { width: 1080, height: 1920 } } }
  ],
  use: { baseURL: "http://localhost:4500" }
});
