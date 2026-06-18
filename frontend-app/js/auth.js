export const API_BASE = "/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function getUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

export function requireRole(role) {
  const user = getUser();
  const token = getToken();

  if (!token || !user || user.role !== role) {
    window.location.href = "/";
  }

  return { token, user };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`
  };
}

export function getTheme() {
  return localStorage.getItem("theme") || "light";
}

export function applyTheme(theme) {
  localStorage.setItem("theme", theme);
  document.documentElement.setAttribute("data-bs-theme", theme);
}