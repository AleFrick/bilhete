import cors from "cors";
import express from "express";

import { pool } from "./config/db.js";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { cleanupExpiredMatchesAndChats } from "./services/expirationService.js";

const app = express();
let startupDbStatus = "pending";

function nowIso() {
  return new Date().toISOString();
}

function logInfo(message) {
  console.log(`[server] ${nowIso()} ${message}`);
}

function logWarn(message) {
  console.warn(`[server:warn] ${nowIso()} ${message}`);
}

function logError(message, error) {
  if (error) {
    const details = error.stack || error.message || String(error);
    console.error(`[server:error] ${nowIso()} ${message}\n${details}`);
    return;
  }

  console.error(`[server:error] ${nowIso()} ${message}`);
}

app.use(cors());
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));

app.use((req, res, next) => {
  if (!env.requestLoggingEnabled) {
    next();
    return;
  }

  const requestId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();
  const startedIso = new Date().toISOString();
  const sourceIp = req.headers["x-forwarded-for"] || req.ip;

  console.log(
    `[http:start] id=${requestId} ${startedIso} ${req.method} ${req.originalUrl} ip=${sourceIp}`,
  );

  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    const tag = elapsed >= env.slowRequestMs ? "http:slow" : "http";
    console.log(
      `[${tag}] id=${requestId} ${startedIso} ${req.method} ${req.originalUrl} status=${res.statusCode} ${elapsed}ms`,
    );
  });

  next();
});

app.use("/api", routes);

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    logWarn(
      `[http:payload-too-large] ${req.method} ${req.originalUrl} limit=${env.jsonBodyLimit}`,
    );
    return res
      .status(413)
      .json({ message: "Payload muito grande para esta operacao." });
  }

  return next(error);
});

app.use((error, req, res, next) => {
  logError(
    `[http:unhandled] ${req.method} ${req.originalUrl} status=500`,
    error,
  );
  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ message: "Erro interno no servidor." });
});

app.get("/healthz", async (req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true, db: "mysql", startupDbStatus });
  } catch (error) {
    logError("[healthz] database unavailable", error);
    res
      .status(500)
      .json({ ok: false, message: "db_unavailable", startupDbStatus });
  }
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

async function startServer() {
  logInfo(
    `Booting Bilhete backend (port=${env.port}, env=${env.nodeEnv}, envFile=${env.envFile}, db=${env.mysqlDatabase}@${env.mysqlHost}:${env.mysqlPort})`,
  );
  try {
    await pool.query("select 1");
    startupDbStatus = "connected";
    logInfo("Database connection check succeeded");
    try {
      const [countRows] = await pool.query(
        "select count(*) as cnt from venues",
      );
      const cnt =
        Array.isArray(countRows) && countRows.length
          ? countRows[0].cnt
          : "unknown";
      logInfo(`venues count=${cnt}`);

      const [bodegaRows] = await pool.query(
        "select id, name, lat, lng from venues where name like 'Bodega%'",
      );
      logInfo(
        `venues bodega_found=${Array.isArray(bodegaRows) ? bodegaRows.length : 0}`,
      );
      if (Array.isArray(bodegaRows) && bodegaRows.length) {
        for (const r of bodegaRows.slice(0, 5)) {
          logInfo(
            `venues bodega row id=${r.id} name=${r.name} lat=${r.lat} lng=${r.lng}`,
          );
        }
      }
    } catch (err) {
      logError("Error while querying venues count at startup", err);
    }
  } catch (error) {
    startupDbStatus = "failed";
    logError("Database connection check failed during startup", error);
  }

  const server = app.listen(env.port, () => {
    logInfo(`Bilhete backend running on http://localhost:${env.port}`);

    setInterval(async () => {
      try {
        const result = await cleanupExpiredMatchesAndChats();
        if (result.expiredChats > 0 || result.expiredMatches > 0) {
          logInfo(
            `Expiration cleanup: ${result.expiredChats} chats, ${result.expiredMatches} matches, ${result.deletedMessages} messages removed`,
          );
        }
      } catch (error) {
        logInfo(`Expiration cleanup error: ${error?.message || String(error)}`);
      }
    }, env.expirationCleanupIntervalMs);

    setInterval(async () => {
      try {
        await pool.query('delete from revoked_tokens where expires_at < now()');
      } catch (error) {
        logInfo(`Revoked tokens cleanup error: ${error?.message || String(error)}`);
      }
    }, 60 * 60 * 1000).unref();
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      logError(
        `Nao foi possivel iniciar na porta ${env.port} definida no ${env.envFile}: porta em uso. Ajuste o PORT no .env ou libere a porta.`,
      );
      process.exitCode = 1;
      setImmediate(() => process.exit(1));
      return;
    }

    logError("Falha ao iniciar servidor HTTP", error);
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  });
}

startServer();
