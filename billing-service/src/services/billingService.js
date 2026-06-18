import { Op, fn, col } from "sequelize";
import {
  UsageEvent,
  EVENT_TYPES,
  EVENT_PRICES
} from "../models/UsageEvent.js";

export function getEventPrice(eventType) {
  if (!(eventType in EVENT_PRICES)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }

  return EVENT_PRICES[eventType];
}

export async function recordUsageEvent(payload) {
  const tenantUuid = payload.tenant_uuid || payload.tenantUuid;
  const eventType = payload.event_type || payload.eventType;

  if (!tenantUuid || !eventType) {
    throw new Error("tenant_uuid and event_type are required");
  }

  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    throw new Error(`Invalid event_type: ${eventType}`);
  }

  const price = getEventPrice(eventType);

  await UsageEvent.create({
    tenantUuid,
    eventType,
    price
  });
}

export function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { start, end };
}

export async function getMonthlySummary({ tenantUuid, year, month }) {
  const { start, end } = monthRange(year, month);

  const events = await UsageEvent.findAll({
    where: {
      tenantUuid,
      createdAt: {
        [Op.gte]: start,
        [Op.lt]: end
      }
    },
    attributes: [
      "eventType",
      [fn("COUNT", col("id")), "quantity"],
      [fn("SUM", col("price")), "total"]
    ],
    group: ["eventType"],
    order: [["eventType", "ASC"]]
  });

  const items = events.map((event) => ({
    event_type: event.eventType,
    quantity: Number(event.get("quantity")),
    unit_price: Number(EVENT_PRICES[event.eventType]),
    total: Number(event.get("total"))
  }));

  const total = items.reduce((sum, item) => sum + item.total, 0);

  return {
    tenant_uuid: tenantUuid,
    year,
    month,
    currency: "KM",
    items,
    total
  };
}

export function summaryToInvoiceItems(summary) {
  return summary.items.map((item) => ({
    item: item.event_type,
    quantity: item.quantity,
    price: item.unit_price
  }));
}