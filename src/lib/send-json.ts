// JSON request to the app's own API.
export function sendJson(url: string, method: "POST" | "PUT" | "PATCH", body: unknown) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
