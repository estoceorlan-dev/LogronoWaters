import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { authenticate } from "../server/auth.js";
import { getDatabase } from "../server/db.js";
import { route } from "../server/router.js";
import { HttpError } from "../server/errors.js";

export function createHandler({
  authenticateRequest = authenticate,
  database = getDatabase,
} = {}) {
  return async (req, res) => {
    const requestId = randomUUID();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Request-Id", requestId);
    try {
      const url = new URL(req.url, "http://localhost");
      const path =
        url.searchParams.get("path") || url.pathname.replace(/^\/api\/?/, "");
      if (path === "health" && req.method === "GET")
        return res.status(200).json({ status: "ok" });
      const user = await authenticateRequest(req);
      let body = req.body;
      if (["POST", "PUT", "PATCH"].includes(req.method)) {
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new HttpError(415, "Send application/json.");
        if (typeof body === "string") {
          try {
            body = JSON.parse(body);
          } catch {
            throw new HttpError(400, "Invalid JSON.");
          }
        }
      }
      const result = await route({
        db: database(),
        user,
        method: req.method,
        path,
        query: Object.fromEntries(url.searchParams),
        body: body || {},
      });
      if (result.csv !== undefined) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="aquaflow-orders.csv"',
        );
        return res.status(200).send(`\uFEFF${result.csv}`);
      }
      return res.status(result.status || 200).json(result.data);
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).json({
          error: error.issues
            .map((i) => `${i.path.join(".") || "Request"}: ${i.message}`)
            .join("; "),
          request_id: requestId,
        });
      if (error instanceof HttpError)
        return res
          .status(error.status)
          .json({ error: error.message, request_id: requestId });
      if (error.code === "23503")
        return res.status(409).json({
          error: "A linked record has changed. Refresh and try again.",
          request_id: requestId,
        });
      // Avoid logging SQL, query parameters, tokens, or customer data.
      console.error(
        JSON.stringify({ requestId, code: error.code || "INTERNAL_ERROR" }),
      );
      return res.status(500).json({
        error: "The request could not be completed. Please try again.",
        request_id: requestId,
      });
    }
  };
}

export default createHandler();
