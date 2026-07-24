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
        title: "工大祭企画情報API",
        version: "0.1.0",
        contact: {
          "url": "https://r.jizi.jp/2026/contact-form"
        },
      },
      servers: [
        {
          description: "本番環境",
          url: "https://events26.koudaisai.jp/v1"
        }
      ]
    },
    exclude: ["/openapi.json"],
  }),
);

export default app;
