import { Hono } from "hono";
import { cors } from "hono/cors";
import { openAPIRouteHandler } from "hono-openapi";
import type { Bindings } from "./bindings";
import { requireAccess } from "./middleware/access";
import { adminProjects } from "./routes/admin_projects";
import { places } from "./routes/places";
import { projects } from "./routes/projects";

const app = new Hono<{ Bindings: Bindings }>();

// 読み取り系は公開情報なので、どのオリジンからでもブラウザで直接読めるようにする。
// 書き込み系(/admin 配下)は Access で守られており、CORS も付けない。
const publicCors = cors({
  origin: "*",
  allowMethods: ["GET", "HEAD", "OPTIONS"],
  // アイコンの条件付きリクエストで使うヘッダ。安全リストに入っていないので明示する。
  allowHeaders: ["If-None-Match", "If-Modified-Since"],
  // ETag は安全リスト外で、露出させないとブラウザから読めず再検証できない。
  exposeHeaders: ["ETag", "Content-Length"],
  maxAge: 86400,
});

app.use("/v1/*", publicCors);
app.use("/openapi.json", publicCors);

app.route("/v1/places", places);
app.route("/v1/projects", projects);

// 書き込み系は /admin 配下にまとめる。Access はホスト名とパスでしか
// 対象を指定できず、メソッドによる出し分けができないため。
// 先頭セグメントごと保護しておけば、あとからルートを足しても漏れない。
app.use("/admin/*", requireAccess);
app.route("/admin/v1", adminProjects);

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
          url: "https://events26.koudaisai.jp",
        },
      ],
    },
    exclude: ["/openapi.json"],
  }),
);

export default app;
