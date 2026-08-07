import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Bindings } from "../bindings";
import { ProjectIdSchema, ProjectSchema } from "../models/project";
import { ProjectDetailsSchema } from "../models/project_details";
import { IconRepository } from "../repositories/icon_repository";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectRepository } from "../repositories/project_repository";

const NotFoundSchema = v.object({
  message: v.string(),
});

const BinaryImageSchema = {
  type: "string" as const,
  format: "binary",
};

const iconResponseHeaders = (icon: R2Object): Headers => {
  const headers = new Headers();
  icon.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("ETag", icon.httpEtag);
  headers.set("Last-Modified", icon.uploaded.toUTCString());
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
};

const hasBody = (icon: R2Object): icon is R2ObjectBody => "body" in icon;

export const projects = new Hono<{ Bindings: Bindings }>()
  .get(
    "/",
    describeRoute({
      operationId: "listProjects",
      summary: "企画の一覧",
      description: "登録されている企画をすべて返します。",
      tags: ["projects"],
      responses: {
        200: {
          description: "企画の一覧",
          content: {
            "application/json": {
              schema: resolver(v.array(ProjectSchema)),
            },
          },
        },
      },
    }),
    async (c) => {
      const repository = new ProjectRepository(c.env.DB);
      return c.json(await repository.list());
    },
  )
  .get(
    "/:projectId/details",
    describeRoute({
      operationId: "getProjectDetails",
      summary: "企画詳細情報の取得",
      description: "IDで指定した企画の詳細情報を返します。",
      tags: ["projects"],
      responses: {
        200: {
          description: "指定した企画の詳細情報",
          content: {
            "application/json": {
              schema: resolver(ProjectDetailsSchema),
            },
          },
        },
        404: {
          description: "指定した企画の詳細情報が存在しない",
          content: {
            "application/json": {
              schema: resolver(NotFoundSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: ProjectIdSchema })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const repository = new ProjectDetailsRepository(c.env.DB);
      const details = await repository.get(projectId);

      if (details === null) {
        return c.json(
          { message: `Project details not found: ${projectId}` },
          404,
        );
      }

      return c.json(details);
    },
  )
  .get(
    "/:projectId",
    describeRoute({
      operationId: "getProject",
      summary: "企画の取得",
      description: "IDで指定した企画を1件返します。",
      tags: ["projects"],
      responses: {
        200: {
          description: "指定した企画",
          content: {
            "application/json": {
              schema: resolver(ProjectSchema),
            },
          },
        },
        404: {
          description: "指定したIDの企画が存在しない",
          content: {
            "application/json": {
              schema: resolver(NotFoundSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: ProjectIdSchema })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const repository = new ProjectRepository(c.env.DB);
      const project = await repository.get(projectId);

      if (project === null) {
        return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
      }

      return c.json(project);
    },
  )
  .get(
    "/:projectId/icon",
    describeRoute({
      operationId: "getProjectIcon",
      summary: "企画アイコンの取得",
      description: "IDで指定した企画のアイコン原本を返します。",
      tags: ["projects"],
      responses: {
        200: {
          description: "指定した企画のアイコン",
          content: {
            "image/png": { schema: BinaryImageSchema },
            "image/jpeg": { schema: BinaryImageSchema },
            "image/gif": { schema: BinaryImageSchema },
            "image/webp": { schema: BinaryImageSchema },
            "image/heic": { schema: BinaryImageSchema },
          },
        },
        304: {
          description: "クライアントが保持しているアイコンから未更新",
        },
        404: {
          description: "指定したアイコンが存在しない",
          content: {
            "application/json": {
              schema: resolver(NotFoundSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: ProjectIdSchema })),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const conditionalHeaders = new Headers();

      for (const name of ["If-None-Match", "If-Modified-Since"]) {
        const value = c.req.header(name);

        if (value !== undefined) {
          conditionalHeaders.set(name, value);
        }
      }

      const iconRepository = new IconRepository(c.env.ICON_BUCKET);
      const icon =
        conditionalHeaders.keys().next().done === true
          ? await iconRepository.get(projectId)
          : await iconRepository.get(projectId, conditionalHeaders);

      if (icon === null) {
        c.header("Cache-Control", "no-store");
        return c.json(
          { message: `Icon not found for project ID: ${projectId}` },
          404,
        );
      }

      const headers = iconResponseHeaders(icon);

      if (!hasBody(icon)) {
        return new Response(null, { status: 304, headers });
      }

      headers.set("Content-Length", icon.size.toString());

      return new Response(icon.body, { headers });
    },
  );
