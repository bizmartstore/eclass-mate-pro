/** @returns {boolean} Lovable editor / sandbox production build */
export function isLovableBuild() {
  return process.env.LOVABLE_SANDBOX === "1" || !!process.env.DEV_SERVER__PROJECT_PATH;
}

/** @returns {boolean} Cloudflare Pages CI (git-connected deploy) */
export function isCloudflarePagesBuild() {
  return process.env.CF_PAGES === "1" || !!process.env.CF_PAGES_URL;
}

/** Static SPA output for Cloudflare Pages — not the Lovable nitro Worker bundle. */
export function useCloudflarePagesStaticOutput() {
  return !isLovableBuild();
}
