import { chromium } from "playwright";
import { spawn } from "node:child_process";

const server = spawn("python3", ["-m", "http.server", "8765"], { stdio: "ignore" });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Local web server did not start")), 10000);
    const probe = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8765/docs/");
        if (response.ok) { clearTimeout(timeout); resolve(); }
        else setTimeout(probe, 200);
      } catch { setTimeout(probe, 200); }
    };
    probe();
  });

  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:8765/docs/", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#loadStatus")?.textContent.includes("caricate correttamente"));
    for (const bank of ["a", "m"]) {
      const exam = page.locator('[data-action="exam"][data-bank="' + bank + '"]');
      if (await exam.isDisabled()) throw new Error("Exam button disabled for bank " + bank);
      await exam.click();
      for (let i = 0; i < 20; i++) {
        await page.locator("#options .option").first().click();
        await page.locator("#next").click();
      }
      await page.locator("#resultsPanel").waitFor({ state: "visible" });
      const score = await page.locator("#score").textContent();
      if (!score?.includes("/20")) throw new Error("Unexpected exam result: " + score);
      await page.locator("#home").click();

      await page.locator('[data-action="all"][data-bank="' + bank + '"]').click();
      if (!(await page.locator("#progress").textContent()).includes(bank === "a" ? "111" : "123")) throw new Error("Full review did not load for bank " + bank);
      await page.locator("#options .option").first().click();
      await page.locator("#next").click();
      await page.locator("#feedback").waitFor({ state: "visible" });
      await page.locator("#next").click();
      if (!(await page.locator("#progress").textContent()).includes("2")) throw new Error("Full review did not advance for bank " + bank);
      await page.locator("#home").click();

      await page.locator('[data-action="random"][data-bank="' + bank + '"]').click();
      if (!(await page.locator("#progress").textContent()).includes("/20")) throw new Error("Random practice did not load for bank " + bank);
      await page.locator("#home").click();

      await page.locator('[data-action="categories"][data-bank="' + bank + '"]').click();
      await page.locator("#categoryList button").first().click();
      if (!(await page.locator("#progress").textContent()).includes("1")) throw new Error("Category practice did not start for bank " + bank);
      await page.locator("#home").click();
    }
    await page.locator("#languageSelect").selectOption("en");
    if (await page.locator("#loadStatus").textContent() !== "Question banks loaded: 111 ADC A and 123 ADC M.") {
      throw new Error("Language selector did not update bank status");
    }
    if (errors.length) throw new Error("Browser errors: " + errors.join(" | "));
    await page.close();
  }
  console.log("Browser tests passed: desktop/mobile, ADC A/ADC M exams, full review, random practice, category practice, results and language selector.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
