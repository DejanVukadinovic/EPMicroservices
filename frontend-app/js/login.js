import { createApp } from "https://unpkg.com/petite-vue?module";

const API_BASE = "/api";

createApp({
  theme: localStorage.getItem("theme") || "light",
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),

  loading: false,
  error: "",

  mode: "login",
  success: "",

  registerForm: {
    companyName: "",
    email: "",
    password: ""
  },

  loginForm: {
    email: "admin@epos.local",
    password: "admin123"
  },

  init() {
    document.documentElement.setAttribute("data-bs-theme", this.theme);
  },

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", this.theme);
    document.documentElement.setAttribute("data-bs-theme", this.theme);
  },

  async login() {
    this.loading = true;
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(this.loginForm)
      });

      if (!response.ok) {
        throw new Error("Invalid email or password");
      }

      const data = await response.json();

      this.token = data.token;
      this.user = data.user;

      localStorage.setItem("token", this.token);
      localStorage.setItem("user", JSON.stringify(this.user));
      if (data.user.role === "EPOS_ADMIN") {
        window.location.href = "/admin.html";
      } else {
        window.location.href = "/tenant.html";
      }
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },
  async registerTenant() {
    this.loading = true;
    this.error = "";
    this.success = "";

    try {
      const response = await fetch(`${API_BASE}/tenants/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(this.registerForm)
      });

      if (!response.ok) {
        throw new Error("Registration request failed");
      }

      this.success = "Registration request submitted. Wait for admin approval.";
      this.registerForm = {
        companyName: "",
        email: "",
        phone: ""
      };
      this.mode = "login";
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },

  logout() {
    this.token = null;
    this.user = null;

    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

}).mount();