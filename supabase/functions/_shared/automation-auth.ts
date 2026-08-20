import { timingSafeEqual } from "./timing-safe-equal.ts";

export function withAutomationSecret(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    const apiKeyHeader =
      req.headers.get("apikey") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const expectedSecret = Deno.env.get("AUTOMATION_SECRET") || "";

    if (
      !expectedSecret ||
      !apiKeyHeader ||
      !timingSafeEqual(apiKeyHeader, expectedSecret)
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return handler(req);
  };
}
