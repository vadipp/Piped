// YouTube timedtext supports native WebVTT. In src= playback, Shaka eagerly
// downloads TTML to convert it, while VTT tracks load only when selected.
export function prepareSubtitle(subtitle) {
    if (subtitle.mimeType !== "application/ttml+xml") return subtitle;
    try {
        const url = new URL(subtitle.url);
        const signed = [url.searchParams.get("sparams"), url.searchParams.get("lsparams")]
            .filter(Boolean)
            .join(",")
            .split(",");
        if (
            !url.pathname.endsWith("/api/timedtext") ||
            url.searchParams.get("fmt") !== "ttml" ||
            signed.includes("fmt")
        )
            return subtitle;
        url.searchParams.set("fmt", "vtt");
        return { ...subtitle, url: url.href, mimeType: "text/vtt" };
    } catch {
        return subtitle;
    }
}

export function configureSubtitleRequest(request, subtitles) {
    const isSubtitle = request.uris.some(uri =>
        subtitles.some(subtitle => {
            try {
                const requestURL = new URL(uri);
                const subtitleURL = new URL(subtitle.url);
                return requestURL.origin === subtitleURL.origin && requestURL.pathname === subtitleURL.pathname;
            } catch {
                return false;
            }
        }),
    );
    if (!isSubtitle) return;
    request.retryParameters = {
        ...request.retryParameters,
        maxAttempts: 2,
        timeout: 8000,
        connectionTimeout: 4000,
        stallTimeout: 4000,
        baseDelay: 250,
    };
}
