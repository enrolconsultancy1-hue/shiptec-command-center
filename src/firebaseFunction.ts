import { onRequest } from "firebase-functions/v2/https";
import { createServer } from "./server.js";

process.env.SHIPTEC_DATA_BACKEND = "firestore";

export const api = onRequest({
  region: "us-central1",
  cors: true
}, createServer());
