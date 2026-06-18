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
  tenantId: null,

  customers: [],
  invoices: [],

  loading: false,
  error: "",

  customerFormOpen: false,
  invoicePanelOpen: false,

  selectedCustomer: null,
  generatingInvoice: false,

  customerForm: {
    name: "",
    email: "",
    phone: "",
    address: ""
  },

  transactionRows: [
    {
      item: "",
      quantity: 1,
      price: 0
    }
  ],

  async init() {
    applyTheme(this.theme);

    const session = requireRole("TENANT_ADMIN");
    this.token = session.token;
    this.user = session.user;

    await this.loadTenant();
    await this.loadCustomers();
  },

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    applyTheme(this.theme);
  },

  logout,

  async loadTenant() {
    const response = await fetch(`${API_BASE}/tenants/me`, {
      headers: authHeaders()
    });

    if (!response.ok) {
      throw new Error("Failed to load tenant profile");
    }

    const tenant = await response.json();
    this.tenantId = tenant.id;
  },

  async loadCustomers() {
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/customers/${this.tenantId}`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to load customers");
      }

      this.customers = await response.json();
    } catch (error) {
      this.error = error.message;
    }
  },

  openCustomerForm() {
    this.customerFormOpen = true;
  },

  closeCustomerForm() {
    this.customerFormOpen = false;
    this.customerForm = {
      name: "",
      email: "",
      phone: "",
      address: ""
    };
  },

  async createCustomer() {
    this.loading = true;
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/customers/${this.tenantId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(this.customerForm)
      });

      if (!response.ok) {
        throw new Error("Failed to create customer");
      }

      await this.loadCustomers();
      this.closeCustomerForm();
    } catch (error) {
      this.error = error.message;
    } finally {
      this.loading = false;
    }
  },

  async deleteCustomer(id) {
    this.error = "";

    try {
      const response = await fetch(`${API_BASE}/customers/${this.tenantId}/${id}`, {
        method: "DELETE",
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error("Failed to delete customer");
      }

      await this.loadCustomers();
    } catch (error) {
      this.error = error.message;
    }
  },

  async openInvoicePanel(customer) {
    this.selectedCustomer = customer;
    this.invoicePanelOpen = true;

    this.transactionRows = [
      {
        item: "",
        quantity: 1,
        price: 0
      }
    ];

    await this.loadInvoices();
  },

  closeInvoicePanel() {
    this.invoicePanelOpen = false;
    this.selectedCustomer = null;
    this.invoices = [];
  },

  closeAllPanels() {
    this.closeCustomerForm();
    this.closeInvoicePanel();
  },

  addTransactionRow() {
    this.transactionRows.push({
      item: "",
      quantity: 1,
      price: 0
    });
  },

  validTransactionRows() {
    return this.transactionRows.filter((row) => {
      return row.item && Number(row.quantity) > 0 && Number(row.price) >= 0;
    });
  },

  async createTransactions() {
    const rows = this.validTransactionRows();

    for (const row of rows) {
      const response = await fetch(
        `${API_BASE}/customers/transactions/${this.tenantId}/${this.selectedCustomer.id}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            item: row.item,
            quantity: Number(row.quantity),
            price: Number(row.price)
          })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }
    }
  },

  async createCustomerInvoice() {
    if (!this.selectedCustomer) return;

    this.generatingInvoice = true;
    this.error = "";

    try {
      await this.createTransactions();

      const response = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          owner_id: this.tenantId,
          source: "CUSTOMER",
          payload: {
            tenant_uuid: this.tenantId,
            customer_id: this.selectedCustomer.id
          }
        })
      });

      if (!response.ok) {
        throw new Error("Failed to create invoice");
      }

      const data = await response.json();

      const socketProtocol =
        window.location.protocol === "https:" ? "wss" : "ws";

      const socket = new WebSocket(
        `${socketProtocol}://${window.location.host}${data.websocket_url}`
      );

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.status === "READY") {
          this.generatingInvoice = false;
          await this.loadInvoices();
          window.open(message.download_url, "_blank");
          socket.close();
        }

        if (message.status === "FAILED") {
          this.generatingInvoice = false;
          this.error = message.error || "Invoice generation failed";
          socket.close();
        }
      };

      socket.onerror = () => {
        this.generatingInvoice = false;
        this.error = "WebSocket connection failed";
      };
    } catch (error) {
      this.generatingInvoice = false;
      this.error = error.message;
    }
  },

  async loadInvoices() {
    const response = await fetch(`${API_BASE}/invoices?owner_id=${this.tenantId}`, {
      headers: authHeaders()
    });

    if (!response.ok) {
      throw new Error("Failed to load invoices");
    }

    this.invoices = await response.json();
  },

  async downloadInvoice(id) {
    const response = await fetch(`${API_BASE}/invoices/${id}/download`, {
      headers: authHeaders()
    });

    if (!response.ok) {
      throw new Error("Failed to get invoice download link");
    }

    const data = await response.json();
    window.open(data.downloadUrl, "_blank");
  },

  formatDate(value) {
    return new Date(value).toLocaleDateString();
  }
}).mount();