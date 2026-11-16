# Optional single-video sharing

This fork can generate permanent, revocable links through a separate
[piped-sharing-gateway](https://github.com/vadipp/piped-sharing-gateway).
The backend API remains unchanged.

Before the application loads, an operator-provided script can set:

```js
window.PIPED_SHARING_API = "/_piped/shares";
```

This same-origin endpoint must authenticate users at the reverse proxy. It accepts
`POST {"videoId":"abcdefghijk"}` and returns `{"url":"https://share.example.com/s/TOKEN"}`.
Never expose the gateway's management credential in browser code. The reverse
proxy supplies that credential after authenticating the user. See the gateway
repository for integration and CSRF requirements.

The existing Piped-link checkbox uses the gateway when configured. YouTube links
retain their original behavior. Timecodes affect only the start time. Playlist
sharing is unavailable in this mode because a capability grants one video only.
Copy, open and QR actions remain unavailable until link creation succeeds; errors
do not silently fall back to an authentication-required watch URL. The dialog has
a retry action. Without runtime configuration, upstream behavior is preserved.

The frontend image build workflow publishes a source-revision-tagged image bundle
as a GitHub release. The bundle contains no instance configuration. Supply the
usual `BACKEND_HOSTNAME` at runtime and inject the optional sharing configuration
from private deployment configuration.
