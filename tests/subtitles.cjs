const assert = require("node:assert/strict");
(async () => {
    const { prepareSubtitle, configureSubtitleRequest } = await import("../src/utils/SubtitleUtils.js");
    const original = {
        url: "https://media.example.com/_piped/proxy/api/timedtext?fmt=ttml&lang=en&sparams=v,lang&signature=fixture",
        mimeType: "application/ttml+xml",
        code: "en",
        name: "English",
    };
    const native = prepareSubtitle(original);
    assert.equal(new URL(native.url).searchParams.get("fmt"), "vtt");
    assert.equal(new URL(native.url).searchParams.get("signature"), "fixture");
    assert.equal(native.mimeType, "text/vtt");
    assert.equal(new URL(original.url).searchParams.get("fmt"), "ttml");
    for (const subtitle of [
        { ...original, url: "https://example.com/captions.ttml" },
        { ...original, url: original.url.replace("v,lang", "v,lang,fmt") },
        { ...original, url: "invalid" },
        { ...original, mimeType: "text/vtt" },
    ])
        assert.equal(prepareSubtitle(subtitle), subtitle);
    const request = { uris: [native.url], retryParameters: { maxAttempts: Infinity, backoffFactor: 1.5 } };
    configureSubtitleRequest(request, [original]);
    assert.equal(request.retryParameters.maxAttempts, 2);
    assert.equal(request.retryParameters.timeout, 8000);
    assert.equal(request.retryParameters.backoffFactor, 1.5);
    const video = {
        uris: ["https://media.example.com/videoplayback?id=fixture"],
        retryParameters: { maxAttempts: Infinity },
    };
    configureSubtitleRequest(video, [original]);
    assert.equal(video.retryParameters.maxAttempts, Infinity);
    console.log("Native subtitle format, signed-format preservation and isolated retry bounds passed.");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
