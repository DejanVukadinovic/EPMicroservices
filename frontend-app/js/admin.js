import { createApp } from "https://unpkg.com/petite-vue?module";
import {
  API_BASE,
  requireRole,
  logout,
  authHeaders,
  getTheme,
  applyTheme
} from "./auth.js";



createApp({
  theme: getTheme(),
  token: null,
  user: null,

  tenants: [],
  error: "",
  loading: false,

  sidebarOpen: false,
  selectedTenant: null,
  invoiceYear: new Date().getFullYear(),

  generatingInvoiceKey: null,

  months: [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" }
  ],

  get pendingTenants() {
    return this.tenants.filter(t => !t.approved);
  },

  get approvedTenants() {
    return this.tenants.filter(t => t.approved);
  },

  async init() {
    applyTheme(this.theme);

    const session = requireRole("EPOS_ADMIN");
    this.token = session.token;
    this.user = session.user;

    await this.loadTenants();
  },

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    applyTheme(this.theme);
  },

  logout,

  async loadTenants() {
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/tenants`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to load tenants");
      }

      this.tenants = await response.json();
    } catch (error) {
      this.error = error.message;
    }
  },

  async approveTenant(id) {
    this.loading = true;
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/tenants/${id}/approve`, {
        method: "PATCH",
        headers: authHeaders(),
        body: "{}" // Send empty body to ensure PATCH is recognized
      });

      if (!response.ok) {
        throw new Error("Failed to approve tenant");
      }

      await this.loadTenants();
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },

  openInvoices(tenant) {
    this.selectedTenant = tenant;
    this.sidebarOpen = true;
  },

  closeInvoices() {
    this.sidebarOpen = false;
    this.selectedTenant = null;
  },

async createBillingInvoice(month) {
  if (!this.selectedTenant) return;

  this.error = "";
  this.generatingInvoiceKey = month;

  const monthString = String(month).padStart(2, "0");
  const yearString = String(this.invoiceYear);
  const body = {

  owner_id: this.selectedTenant.id,

  source: "BILLING",

  payload: {

    tenant_uuid: this.selectedTenant.id,

    year: String(this.invoiceYear),

    month: String(month).padStart(2, "0")

  }

};

console.log("invoice request", body);

  try {
    const response = await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        owner_id: this.selectedTenant.id,
        source: "BILLING",
        payload: {
          tenant_uuid: this.selectedTenant.id,
          year: yearString,
          month: monthString
        }
      })
    });

    if (!response.ok) {
      throw new Error("Failed to create billing invoice");
    }

    const data = await response.json();

    const socketProtocol =
      window.location.protocol === "https:" ? "wss" : "ws";

    const socket = new WebSocket(
      `${socketProtocol}://${window.location.host}${data.websocket_url}`
    );

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.status === "READY") {
        this.generatingInvoiceKey = null;
        window.open(message.download_url, "_blank");
        socket.close();
      }

      if (message.status === "FAILED") {
        this.generatingInvoiceKey = null;
        this.error = message.error || "Invoice generation failed";
        socket.close();
      }
    };

    socket.onerror = () => {
      this.generatingInvoiceKey = null;
      this.error = "WebSocket connection failed";
    };
  } catch (error) {
    this.generatingInvoiceKey = null;
    this.error = error.message;
  }
}
}).mount();