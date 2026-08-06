import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Bindings } from "../bindings";
import { ProjectIdSchema, ProjectSchema } from "../models/project";
import { ProjectRepository } from "../repositories/project_repository";

const NotFoundSchema = v.object({
  message: v.string(),
});

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
  );
