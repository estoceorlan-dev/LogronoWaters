import { authClient } from "./auth";

export async function api(
  path,
  { method = "GET", body, signal, download = false } = {},
) {
  // Neon places its signed JWT in session.token (including SDK refresh/cache handling).
  const { data, error } = await authClient.getSession();
  const token = data?.session?.token;
  if (error || !token)
    throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`/api/${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      result.error || `Request failed (${response.status}). Please try again.`,
    );
  }
  return download ? response.blob() : response.json();
}
export function params(values) {
  return new URLSearchParams(
    Object.entries(values).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  ).toString();
}
export function money(cents = 0) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}
export function date(value, timezone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
export function exportFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
