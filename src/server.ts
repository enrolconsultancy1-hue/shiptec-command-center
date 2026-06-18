import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import path from "node:path";
import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { router } from "./routes.js";

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(path.resolve("public")));
  app.use(router);
  app.use("/api", router);
  app.use(errorHandler);
  return app;
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unexpected error"
    }
  });
};
