// Real production-bundle checks with synthetic video/comment APIs.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
    const browser = await chromium.launch({ headless: true });
    fs.mkdirSync("test-results", { recursive: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 740 }, serviceWorkers: "block" });
        await context.addInitScript(() => {
            localStorage.setItem("instance", "http://localhost:4173/api");
            localStorage.setItem("sponsorblock", "false");
            localStorage.setItem("autoplay", "0");
            localStorage.setItem("minimizeComments", "true");
            localStorage.setItem("minimizeRecommendations", "true");
        });
        let mode = "normal",
            pages = 0,
            firstPages = 0;
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#64748b"/><circle cx="24" cy="19" r="9" fill="#cbd5e1"/></svg>';
        const comment = (id, thumbnail = null) => ({
            commentId: String(id),
            author: "@viewer" + id,
            thumbnail,
            commentText: "Synthetic discussion: a useful perspective on this video. ".repeat(3),
            commentedTime: "3 months ago",
            likeCount: 3,
            commentorUrl: "/channel/fixture",
            replyCount: 1,
            repliesPage: id === 0 ? "replies" : null,
        });
        const rec = id => ({
            type: "stream",
            url: "/watch?v=" + id,
            title: "Recommended fixture video",
            uploaderName: "Fixture creator",
            uploaderUrl: "/channel/fixture",
            duration: 60,
            views: 10,
            uploadedDate: "Today",
            thumbnail: "/fixture-avatar.svg",
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", e => pageErrors.push(e.message));
        await page.route("**/fixture-avatar.svg", route => route.fulfill({ contentType: "image/svg+xml", body: svg }));
        await page.route("**/broken-avatar.png", route => route.fulfill({ status: 404, body: "missing" }));
        await page.route("**/api/**", async route => {
            const url = new URL(route.request().url());
            let body = {};
            if (url.pathname.includes("/nextpage/comments/")) {
                if (url.searchParams.get("nextpage") === "replies")
                    body = { comments: [comment("reply")], nextpage: null };
                else {
                    pages++;
                    body = { comments: [comment("page" + pages)], nextpage: null };
                }
            } else if (url.pathname.includes("/comments/")) {
                firstPages++;
                await new Promise(resolve => setTimeout(resolve, 120));
                if (mode === "error")
                    return route.fulfill({
                        status: 500,
                        contentType: "application/json",
                        body: JSON.stringify({ error: "fixture failure" }),
                    });
                body = {
                    comments:
                        mode === "empty" || mode === "disabled"
                            ? []
                            : Array.from({ length: 35 }, (_, i) =>
                                  comment(i, i === 1 ? "/broken-avatar.png" : i === 2 ? "/fixture-avatar.svg" : null),
                              ),
                    commentCount: 35,
                    nextpage: mode === "normal" ? "page2" : null,
                    disabled: mode === "disabled",
                };
            } else if (url.pathname.includes("/streams/")) {
                body = {
                    title: "Layout preview — synthetic video",
                    description: "",
                    uploader: "Fixture creator",
                    uploaderUrl: "/channel/fixture",
                    uploaderAvatar: "/fixture-avatar.svg",
                    uploaderSubscriberCount: 123,
                    uploadDate: "2026-01-01",
                    views: 1234,
                    likes: 42,
                    dislikes: 0,
                    duration: 60,
                    tags: [],
                    chapters: [],
                    subtitles: [],
                    previewFrames: [],
                    audioStreams: [],
                    videoStreams: [
                        { url: "http://localhost:4173/fixture.mp4", codec: null, quality: "360p", videoOnly: false },
                    ],
                    proxyUrl: "http://localhost:4173",
                    relatedStreams: [rec("bcdefghijkl"), rec("cdefghijklm")],
                };
            } else if (url.pathname.endsWith("/config"))
                body = { countries: ["US"], imageProxyUrl: "http://localhost:4173", registrationDisabled: true };
            else if (url.pathname.endsWith("/trending")) body = [rec("abcdefghijk")];
            return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
        });
        await page.route("**/fixture.mp4", route =>
            route.fulfill({ status: 404, body: "UI fixture: media unavailable" }),
        );
        const goto = async (id = "abcdefghijk") => {
            await page.goto("http://localhost:4173/watch?v=" + id);
            await page.locator("#watch-panel-comments").waitFor();
        };
        const commentsTab = page.locator("#watch-tab-comments");
        const recsTab = page.locator("#watch-tab-recommendations");
        const commentsPanel = page.locator("#watch-panel-comments");
        const recsPanel = page.locator("#watch-panel-recommendations");
        const selected = async name =>
            assert.equal(await page.locator("#watch-tab-" + name).getAttribute("aria-selected"), "true");
        await goto();
        await commentsPanel.getByText("@viewer0", { exact: true }).waitFor();
        await selected("comments");
        assert.equal(await recsPanel.isVisible(), false);
        const avatar = commentsPanel.locator("span[aria-hidden=true]").filter({ has: page.locator("svg") });
        await avatar.first().waitFor();
        assert.equal(await commentsPanel.locator('img[src="/broken-avatar.png"]').count(), 0);
        assert.equal(await commentsPanel.locator('img[src="/fixture-avatar.svg"]').count(), 1);
        await commentsPanel.getByText("1 replies", { exact: true }).click();
        await commentsPanel.getByText("@viewerreply", { exact: true }).waitFor();
        const before = firstPages;
        await recsTab.click();
        await selected("recommendations");
        assert.equal(await commentsPanel.isVisible(), false);
        assert.equal(await recsPanel.isVisible(), true);
        await commentsTab.click();
        await commentsPanel.getByText("@viewerreply", { exact: true }).waitFor();
        assert.equal(firstPages, before);
        await recsTab.focus();
        await page.keyboard.press("End");
        await selected("recommendations");
        await page.keyboard.press("ArrowLeft");
        await selected("comments");
        assert.equal(await commentsTab.evaluate(el => el === document.activeElement), true);
        // The sticky selector remains at the top while scrolling the panel.
        await commentsTab.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY + 500));
        await page.waitForTimeout(150);
        assert.ok(Math.abs((await page.getByRole("tablist").boundingBox()).y) < 2);
        await recsTab.click();
        assert.ok(Math.abs((await page.getByRole("tablist").boundingBox()).y) < 2);
        assert.equal(pages, 0, "hidden comments must not paginate");
        await commentsTab.click();
        for (const width of [320, 390, 768, 1023, 1024, 1280]) {
            await page.setViewportSize({ width, height: 740 });
            await page.waitForTimeout(100);
            assert.equal(await page.getByRole("tablist").count(), width < 1024 ? 1 : 0);
            assert.ok(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                "overflow at " + width,
            );
            if (width < 1024) {
                await commentsTab.scrollIntoViewIfNeeded();
                await selected("comments");
                const bounds = await commentsPanel.locator('span[aria-hidden="true"]').first().boundingBox();
                assert.equal(bounds.width, 48);
                if (width === 390) await page.screenshot({ path: "test-results/watch-phone.png" });
            } else {
                await page.getByRole("button", { name: /Show Comments/ }).click();
                await commentsPanel.getByText("@viewer0", { exact: true }).waitFor();
                assert.equal(await page.getByText("Recommended fixture video").first().isVisible(), false); // desktop preference is respected
                await page.getByText("Show Recommendations", { exact: true }).click();
                await page.getByText("Recommended fixture video").first().waitFor();
                await page.screenshot({ path: "test-results/watch-desktop.png" });
                // Restore desktop preferences for the next breakpoint.
                await page.getByRole("button", { name: /Minimize Comments/ }).click();
                await page.getByText("Minimize Recommendations", { exact: true }).click();
            }
        }
        await page.setViewportSize({ width: 390, height: 740 });
        await recsTab.click();
        await page.reload();
        await selected("comments");
        await recsTab.click();
        await recsPanel.getByText("Recommended fixture video").first().click();
        await commentsPanel.getByText("@viewer0", { exact: true }).waitFor();
        await selected("comments");
        // Pagination occurs near the visible comment list's end.
        await commentsPanel.locator('a[href="/channel/fixture"]').last().scrollIntoViewIfNeeded();
        await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
        await commentsPanel.getByText("@viewerpage1", { exact: true }).waitFor();
        assert.equal(pages, 1);
        for (const state of ["empty", "disabled", "error"]) {
            mode = state;
            await page.reload();
            await commentsPanel
                .getByText(
                    {
                        empty: "No comments yet.",
                        disabled: "Comments are disabled by the uploader.",
                        error: "Could not load comments.",
                    }[state],
                    { exact: true },
                )
                .waitFor();
        }
        mode = "normal";
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await commentsPanel.getByText("@viewer0", { exact: true }).waitFor();
        await page.evaluate(() => localStorage.setItem("hl", "ru"));
        await page.reload();
        await page.getByRole("tab", { name: /Комментарии/ }).waitFor();
        await page.getByRole("tab", { name: "Рекомендации", exact: true }).waitFor();
        await commentsPanel.getByText("@viewer0", { exact: true }).waitFor();
        await commentsTab.scrollIntoViewIfNeeded();
        await page.screenshot({ path: "test-results/watch-phone-ru.png" });
        assert.deepEqual(pageErrors, []);
        console.log(
            "Watch tabs, breakpoints, sticky scrolling, pagination, defaults, keyboard, states and avatar fallbacks passed.",
        );
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error("::error::" + String(error.stack || error).replaceAll("\n", "%0A"));
    process.exitCode = 1;
});
