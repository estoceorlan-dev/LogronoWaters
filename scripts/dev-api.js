import "./env.js";
import http from "node:http";
import handler from "../api/handler.js";

export function createApiServer(apiHandler = handler) {
  return http.createServer(async (req, res) => {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (value) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    };
    res.send = (value) => res.end(value);
    let body = "";
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 65536) {
        res.status(413).json({ error: "Request is too large." });
        return;
      }
      body += chunk.toString();
    }
    req.body = body || undefined;
    await apiHandler(req, res);
  });
}

if (process.argv[1]?.endsWith("dev-api.js")) {
  const port = Number(process.env.API_PORT || 3001);
  createApiServer().listen(port, "127.0.0.1", () =>
    console.log(`Station API: http://127.0.0.1:${port}`),
  );
}
