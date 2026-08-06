import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Bindings } from "../bindings";
import { MenuSchema } from "../models/menu";
import { ProjectIdSchema } from "../models/project";
import { ProjectDetailsRepository } from "../repositories/project_details_repository";
import { ProjectNotFoundError } from "../repositories/project_repository";

const MessageSchema = v.object({
  message: v.string(),
});

const ParamSchema = v.object({ projectId: ProjectIdSchema });

const unauthorizedResponse = {
  description: "Access の認証を通っていない",
  content: {
    "application/json": { schema: resolver(MessageSchema) },
  },
};

const notFoundResponse = {
  description: "指定したIDの企画が存在しない",
  content: {
    "application/json": { schema: resolver(MessageSchema) },
  },
};

const putResponses = {
  204: {
    description: "保存に成功",
  },
  400: {
    description: "リクエストボディが不正",
  },
  401: unauthorizedResponse,
  404: notFoundResponse,
};

const deleteResponses = {
  204: {
    description: "削除に成功",
  },
  401: unauthorizedResponse,
  404: notFoundResponse,
};

export const adminProjectDetails = new Hono<{ Bindings: Bindings }>()
  .put(
    "/projects/:projectId/details/menu",
    describeRoute({
      operationId: "updateProjectMenu",
      summary: "企画メニューの登録・更新",
      description:
        "指定した企画のメニューを保存します。追加情報は変更しません。",
      tags: ["admin"],
      responses: putResponses,
    }),
    validator("param", ParamSchema),
    validator("json", MenuSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const menu = c.req.valid("json");
      const repository = new ProjectDetailsRepository(c.env.DB);

      try {
        await repository.saveMenu(projectId, menu);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.body(null, 204);
    },
  )
  .delete(
    "/projects/:projectId/details/menu",
    describeRoute({
      operationId: "deleteProjectMenu",
      summary: "企画メニューの削除",
      description:
        "指定した企画のメニューを削除します。追加情報は変更しません。",
      tags: ["admin"],
      responses: deleteResponses,
    }),
    validator("param", ParamSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const repository = new ProjectDetailsRepository(c.env.DB);

      try {
        await repository.deleteMenu(projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.body(null, 204);
    },
  )
  .put(
    "/projects/:projectId/details/additionalInfo",
    describeRoute({
      operationId: "updateProjectAdditionalInfo",
      summary: "企画追加情報の登録・更新",
      description:
        "指定した企画の追加情報を保存します。メニューは変更しません。",
      tags: ["admin"],
      responses: putResponses,
    }),
    validator("param", ParamSchema),
    validator("json", v.string()),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const additionalInfo = c.req.valid("json");
      const repository = new ProjectDetailsRepository(c.env.DB);

      try {
        await repository.saveAdditionalInfo(projectId, additionalInfo);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.body(null, 204);
    },
  )
  .delete(
    "/projects/:projectId/details/additionalInfo",
    describeRoute({
      operationId: "deleteProjectAdditionalInfo",
      summary: "企画追加情報の削除",
      description:
        "指定した企画の追加情報を削除します。メニューは変更しません。",
      tags: ["admin"],
      responses: deleteResponses,
    }),
    validator("param", ParamSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const repository = new ProjectDetailsRepository(c.env.DB);

      try {
        await repository.deleteAdditionalInfo(projectId);
      } catch (error) {
        if (error instanceof ProjectNotFoundError) {
          return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
        }
        throw error;
      }

      return c.body(null, 204);
    },
  );
