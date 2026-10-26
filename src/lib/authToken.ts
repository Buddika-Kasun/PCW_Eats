const TOKEN_KEY = "pcw_eats_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function bootstrapTokenFromUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (urlToken) {
    setToken(urlToken);
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }
  return getToken() !== null;
}
