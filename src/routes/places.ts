import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  getPlace,
  PlaceIdSchema,
  PlaceSchema,
  PlaceSummarySchema,
  PlaceTypeSchema,
  searchPlaces,
} from "../models/place";

const NotFoundSchema = v.object({
  message: v.string(),
});

const PlaceFilterSchema = v.object({
  type: v.optional(PlaceTypeSchema),
  name: v.optional(v.string()),
  displayName: v.optional(v.string()),
});

export const places = new Hono()
  .get(
    "/",
    describeRoute({
      operationId: "listPlaces",
      summary: "場所の検索",
      description:
        "企画実施場所の一覧を階層IDつきのフラットな形式で返します。type(完全一致)・name(完全一致)・displayName(部分一致)で絞り込みできます。",
      tags: ["places"],
      responses: {
        200: {
          description: "条件に一致した場所の一覧",
          content: {
            "application/json": {
              schema: resolver(v.array(PlaceSummarySchema)),
            },
          },
        },
        400: {
          description: "クエリパラメータが不正",
        },
      },
    }),
    validator("query", PlaceFilterSchema),
    (c) => c.json(searchPlaces(c.req.valid("query"))),
  )
  .get(
    "/:placeId",
    describeRoute({
      operationId: "getPlace",
      summary: "場所の取得",
      description: "階層IDで指定した場所を1件返します。",
      tags: ["places"],
      responses: {
        200: {
          description: "指定した場所",
          content: {
            "application/json": {
              schema: resolver(PlaceSchema),
            },
          },
        },
        404: {
          description: "指定したIDの場所が存在しない",
          content: {
            "application/json": {
              schema: resolver(NotFoundSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ placeId: PlaceIdSchema }), (result, c) => {
      if (!result.success) {
        return c.json(
          { message: `Unknown place ID: ${c.req.param("placeId")}` },
          404,
        );
      }
    }),
    (c) => {
      const { placeId } = c.req.valid("param");
      return c.json(getPlace(placeId));
    },
  );
