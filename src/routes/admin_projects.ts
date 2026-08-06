import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Bindings } from "../bindings";
import { ProjectIdSchema, ProjectSchema } from "../models/project";
import {
  ProjectNotFoundError,
  ProjectRepository,
} from "../repositories/project_repository";

const MessageSchema = v.object({
  message: v.string(),
});

const ParamSchema = v.object({ projectId: ProjectIdSchema });

const errorResponses = {
  400: {
    description: "リクエストボディが不正",
  },
  401: {
    description: "Access の認証を通っていない",
    content: {
      "application/json": { schema: resolver(MessageSchema) },
    },
  },
};

export const adminProjects = new Hono<{ Bindings: Bindings }>()
  .post(
    "/projects",
    describeRoute({
      operationId: "createProject",
      summary: "企画の登録",
      description: "企画を新規登録します。ID は呼び出し側が指定します。",
      tags: ["admin"],
      responses: {
        ...errorResponses,
        201: {
          description: "登録した企画",
          content: {
            "application/json": { schema: resolver(ProjectSchema) },
          },
        },
        409: {
          description: "同じ ID の企画が既に存在する",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
      },
    }),
    validator("json", ProjectSchema),
    async (c) => {
      const project = c.req.valid("json");
      const repository = new ProjectRepository(c.env.DB);

      if ((await repository.get(project.id)) !== null) {
        return c.json(
          { message: `Project already exists: ${project.id}` },
          409,
        );
      }

      await repository.create(project);

      return c.json(project, 201);
    },
  )
  .put(
    "/projects/:projectId",
    describeRoute({
      operationId: "updateProject",
      summary: "企画の更新",
      description:
        "企画を丸ごと置き換えます。タグと開催予定は差分ではなく総入れ替えになります。",
      tags: ["admin"],
      responses: {
        ...errorResponses,
        200: {
          description: "更新後の企画",
          content: {
            "application/json": { schema: resolver(ProjectSchema) },
          },
        },
        404: {
          description: "指定したIDの企画が存在しない",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
      },
    }),
    validator("param", ParamSchema),
    validator("json", ProjectSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const project = c.req.valid("json");

      if (project.id !== projectId) {
        return c.json(
          { message: `ID mismatch: path ${projectId}, body ${project.id}` },
          400,
        );
      }

      const repository = new ProjectRepository(c.env.DB);

      try {
        await repository.update(project);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.json(project);
    },
  )
  .delete(
    "/projects/:projectId",
    describeRoute({
      operationId: "deleteProject",
      summary: "企画の削除",
      description: "企画を削除します。タグと開催予定も一緒に消えます。",
      tags: ["admin"],
      responses: {
        ...errorResponses,
        204: {
          description: "削除に成功",
        },
        404: {
          description: "指定したIDの企画が存在しない",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
      },
    }),
    validator("param", ParamSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const repository = new ProjectRepository(c.env.DB);

      try {
        await repository.delete(projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.body(null, 204);
    },
  );
