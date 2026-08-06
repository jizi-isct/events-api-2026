import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import type { Bindings } from "../bindings";
import { ProjectIdSchema, ProjectSchema } from "../models/project";
import { IconRepository } from "../repositories/icon_repository";
import {
  ProjectNotFoundError,
  ProjectRepository,
} from "../repositories/project_repository";
import {
  IconValidator,
  InvalidIconAspectRatioError,
  UnsupportedIconFormatError,
} from "../services/icon_validator";

const MessageSchema = v.object({
  message: v.string(),
});

const ParamSchema = v.object({ projectId: ProjectIdSchema });

const MAX_ICON_SIZE = 20_000_000;

const BinaryImageSchema = {
  type: "string" as const,
  format: "binary",
};

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
  .put(
    "/projects/:projectId/icon",
    describeRoute({
      operationId: "updateProjectIcon",
      summary: "企画アイコンの更新",
      description:
        "Cloudflare Imagesで扱える正方形の画像を、企画アイコンの原本として保存します。",
      tags: ["admin"],
      requestBody: {
        required: true,
        content: {
          "image/png": { schema: BinaryImageSchema },
          "image/jpeg": { schema: BinaryImageSchema },
          "image/gif": { schema: BinaryImageSchema },
          "image/webp": { schema: BinaryImageSchema },
          "image/heic": { schema: BinaryImageSchema },
        },
      },
      responses: {
        204: {
          description: "保存に成功",
        },
        400: {
          description: "画像データが空",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
        401: errorResponses[401],
        404: {
          description: "指定したIDの企画が存在しない",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
        413: {
          description: "画像が20 MBを超えている",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
        415: {
          description: "画像形式がCloudflare Imagesの処理対象外",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
        422: {
          description: "画像の縦横比が1:1ではない",
          content: {
            "application/json": { schema: resolver(MessageSchema) },
          },
        },
      },
    }),
    validator("param", ParamSchema),
    bodyLimit({
      maxSize: MAX_ICON_SIZE,
      onError: (c) =>
        c.json({ message: "Icon is too large: maximum size is 20 MB" }, 413),
    }),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const projectRepository = new ProjectRepository(c.env.DB);

      if ((await projectRepository.get(projectId)) === null) {
        return c.json({ message: `Unknown project ID: ${projectId}` }, 404);
      }

      const icon = await c.req.blob();

      if (icon.size === 0) {
        return c.json({ message: "Icon is required" }, 400);
      }

      try {
        const validatedIcon = await new IconValidator(c.env.IMAGES).validate(
          icon,
        );
        await new IconRepository(c.env.ICON_BUCKET).save(
          projectId,
          validatedIcon,
        );
      } catch (error) {
        if (error instanceof UnsupportedIconFormatError) {
          return c.json({ message: error.message }, 415);
        }

        if (error instanceof InvalidIconAspectRatioError) {
          return c.json({ message: error.message }, 422);
        }

        throw error;
      }

      return c.body(null, 204);
    },
  )
  .delete(
    "/projects/:projectId/icon",
    describeRoute({
      operationId: "deleteProjectIcon",
      summary: "企画アイコンの削除",
      description: "企画アイコンの原本を削除します。未登録の場合も成功します。",
      tags: ["admin"],
      responses: {
        204: {
          description: "削除に成功",
        },
        401: errorResponses[401],
      },
    }),
    validator("param", ParamSchema),
    async (c) => {
      const { projectId } = c.req.valid("param");
      await new IconRepository(c.env.ICON_BUCKET).delete(projectId);
      return c.body(null, 204);
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
