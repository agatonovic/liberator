export const isStaticHost = Boolean(process.env.NEXT_PUBLIC_BASE_PATH);

export function publicPath(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (base && (normalized === base || normalized.startsWith(`${base}/`))) return normalized;
  return `${base}${normalized}`;
}

/** App-relative `/templates/...` URLs need the GitHub Pages basePath. */
export function resolvePublicSrc(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("data:") || src.startsWith("blob:") || /^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return publicPath(src);
  return src;
}

export function navPath(pathname: string | null | undefined) {
  if (!pathname) return "/";
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  let path = pathname;
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length) || "/";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}
