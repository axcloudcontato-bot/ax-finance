import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
