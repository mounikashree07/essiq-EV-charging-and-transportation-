const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

export function apiUrl(path) {
  return `${apiBaseUrl}${path}`;
}
