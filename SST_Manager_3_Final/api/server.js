import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","R2_ENDPOINT","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Falta variable de entorno: ${key}`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(x => x.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Origen no permitido"));
  }
}));

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});
const BUCKET = process.env.R2_BUCKET;

async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Falta sesión" });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Sesión inválida" });
    req.user = data.user;
    next();
  } catch {
    res.status(401).json({ error: "No autorizado" });
  }
}

app.get("/", (_req, res) => res.json({ ok: true, sistema: "SST Manager API", version: "3.0" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/r2/upload-url", requireAuth, async (req, res) => {
  try {
    const { dni, fecha, nombreArchivo, contentType, size } = req.body || {};
    if (!/^\d{8}$/.test(String(dni || ""))) return res.status(400).json({ error: "DNI inválido" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return res.status(400).json({ error: "Fecha inválida" });

    const allowedTypes = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };
    const ext = allowedTypes[contentType];
    if (!ext) return res.status(400).json({ error: "Formato no permitido" });
    if (Number(size) > 15 * 1024 * 1024) return res.status(400).json({ error: "Máximo 15 MB" });

    const key = `emo/${dni}/${fecha}/${randomUUID()}.${ext}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Metadata: {
        dni: String(dni),
        fecha: String(fecha),
        original: String(nombreArchivo || "emo").slice(0, 180)
      }
    });
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    res.json({ uploadUrl, key, expiresIn: 300 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo preparar la carga" });
  }
});

app.post("/r2/view-url", requireAuth, async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key || !String(key).startsWith("emo/")) return res.status(400).json({ error: "Ruta inválida" });
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: String(key) });
    const viewUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    res.json({ viewUrl, expiresIn: 300 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo abrir el documento" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SST Manager API en puerto ${port}`));
