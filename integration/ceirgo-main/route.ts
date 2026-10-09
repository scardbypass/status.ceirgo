// Copy this file into the MAIN CeirGo Next.js application at:
// src/app/(api)/api/public/ceirgo-status/route.ts
// This file is not executed by the standalone status server.
import { NextResponse } from "next/server";
import { prisma } from "@withchiwa/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS = [
  { code: "cek_imei", name: "Cek Status IMEI" },
  { code: "cek_history_imei", name: "Cek History IMEI" },
  { code: "cek_imei_beacukai", name: "Cek Bea Cukai" },
  { code: "cek_validity", name: "Cek Until" },
  { code: "create_barcode", name: "Create Barcode" },
] as const;

type State = "online" | "offline" | "unknown";
const AGE_LIMIT_MS = 30 * 60_000;
const technicalError = (message: string | null) =>
  /timeout|timed out|ECONN|ETIMEDOUT|network error|socket hang up|HTTP\s*5\d\d|server error|service unavailable|bad gateway|gateway timeout|provider.*(down|offline|error)/i.test(message ?? "");

async function load() {
  const services = await prisma.services.findMany({
    where: { code: { in: PRODUCTS.map(p => p.code) } },
    select: { id: true, code: true, is_active: true },
  });
  const byCode = new Map(services.map(s => [s.code, s]));
  const rows = services.length ? await prisma.orders.findMany({
    where: {
      service_id: { in: services.map(s => s.id) },
      status: { in: ["completed", "partial", "refunded", "cancelled", "processing"] },
    },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: 120,
    select: { service_id: true, status: true, error_message: true, updated_at: true },
  }) : [];

  const outcome = (row: (typeof rows)[number]): State | null => {
    if (row.status === "completed") return "online";
    return technicalError(row.error_message) ? "offline" : null;
  };
  const now = Date.now();
  const publicServices = PRODUCTS.map(p => {
    const service = byCode.get(p.code);
    const latest = rows.find(row => row.service_id === service?.id && outcome(row));
    const fresh = latest && now - latest.updated_at.getTime() <= AGE_LIMIT_MS;
    return {
      name: p.name,
      state: (service?.is_active && fresh ? outcome(latest) : "unknown") as State,
      lastActivity: latest?.updated_at.toISOString() ?? null,
    };
  });
  const activities = rows.slice(0, 20).flatMap(row => {
    const product = PRODUCTS.find(p => byCode.get(p.code)?.id === row.service_id);
    if (!product) return [];
    const state = row.status === "completed" ? "completed"
      : row.status === "processing" ? "processing"
      : technicalError(row.error_message) ? "error" : null;
    return state ? [{ name: product.name, state, time: row.updated_at.toISOString() }] : [];
  });
  return { updatedAt: new Date().toISOString(), services: publicServices, activities };
}

let cache: { expires: number; value: Awaited<ReturnType<typeof load>> } | null = null;
let pending: Promise<Awaited<ReturnType<typeof load>>> | null = null;

export async function GET() {
  try {
    if (!cache || cache.expires < Date.now()) {
      pending ??= load().then(value => {
        cache = { value, expires: Date.now() + 10_000 };
        return value;
      }).finally(() => { pending = null; });
      await pending;
    }
    return NextResponse.json(cache!.value, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10" } });
  } catch {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      services: PRODUCTS.map(p => ({ name: p.name, state: "unknown", lastActivity: null })),
      activities: [],
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
