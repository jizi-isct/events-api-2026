import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { places } from "./routes/places";

const app = new Hono();

app.route("/v1/places", places);

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Events API 2026",
        version: "0.1.0",
      },
    },
    exclude: ["/openapi.json"],
  }),
);

export default app;
