// Where the city is running. The website build (scripts/build-site.mjs) sets __PUBLIC_SITE__ = true:
// a public preview where nobody is treated as the owner and shared features say they open at launch.
declare const __PUBLIC_SITE__: boolean | undefined;
export const PUBLIC_SITE = typeof __PUBLIC_SITE__ !== 'undefined' && !!__PUBLIC_SITE__;
/** Running from your own machine (dev server or file), where you may edit owner-only things locally. */
export const LOCAL_DEV = !PUBLIC_SITE && (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname));
