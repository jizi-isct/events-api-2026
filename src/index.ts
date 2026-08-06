import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import type { Bindings } from "./bindings";
import { requireAccess } from "./middleware/access";
import { places } from "./routes/places";
import { projects } from "./routes/projects";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/v1/places", places);
app.route("/v1/projects", projects);

// 書き込み系は /admin 配下にまとめる。Access はホスト名とパスでしか
// 対象を指定できず、メソッドによる出し分けができないため。
// 先頭セグメントごと保護しておけば、あとからルートを足しても漏れない。
app.use("/admin/*", requireAccess);

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "工大祭企画情報API",
        version: "0.1.0",
        contact: {
          url: "https://r.jizi.jp/2026/contact-form",
        },
      },
      servers: [
        {
          description: "本番環境",
          url: "https://events26.koudaisai.jp/v1",
        },
      ],
    },
    exclude: ["/openapi.json"],
  }),
);

export default app;
