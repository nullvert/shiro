import { expect, test } from "@playwright/test";

test("footer renders copyright notice and collapsible links", async ({
	page,
}) => {
	await page.goto("/", { waitUntil: "domcontentloaded" });

	const footer = page.locator(".m3-blog-footer").first();
	await expect(footer).toBeVisible();

	const text = footer.locator(".m3-blog-footer__text");
	await expect(text).toHaveText(/All Rights Reserved$/);

	const details = footer.locator("details.m3-blog-footer__details");
	await expect(details).toBeVisible();

	const sitemapLink = footer.locator('a[href$="sitemap-index.xml"]');
	await details.locator("summary").click();
	await expect(sitemapLink).toBeVisible();
});
