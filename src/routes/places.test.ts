import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import app from "../index";
import {
  getPlace,
  PlaceSchema,
  PlaceSummarySchema,
  type PlaceSummary,
} from "../models/place";

describe("GET /v1/places", () => {
  test("returns all places as a flat list without filters", async () => {
    const res = await app.request("/v1/places");

    expect(res.status).toBe(200);

    const body = (await res.json()) as PlaceSummary[];
    expect(v.safeParse(v.array(PlaceSummarySchema), body).success).toBe(true);
    expect(body.length).toBe(242);
    expect(body[0]).toEqual({
      id: "east",
      type: "district",
      name: "east",
      displayName: "東地区",
    });
  });

  test("filters by type", async () => {
    const res = await app.request("/v1/places?type=stage");

    expect(res.status).toBe(200);

    const body = (await res.json()) as PlaceSummary[];
    expect(body.map((place) => place.id)).toEqual([
      "east.taki-plaza-stage",
      "east.wood-deck",
      "east.outdoor-stage",
      "west.lecture-hall-70",
      "west.digital-hall",
    ]);
  });

  test("filters by exact name", async () => {
    const res = await app.request("/v1/places?name=m-101");

    expect(await res.json()).toEqual([
      { id: "main.m.m-101", type: "room", name: "m-101", displayName: "M-101" },
    ]);
  });

  test("filters by partial displayName", async () => {
    const res = await app.request(
      `/v1/places?displayName=${encodeURIComponent("ステージ")}`,
    );

    const body = (await res.json()) as PlaceSummary[];
    expect(body.map((place) => place.displayName)).toEqual([
      "Taki Plazaステージ",
      "ウッドデッキステージ",
      "野外ステージ",
    ]);
  });

  test("combines multiple filters with AND", async () => {
    const res = await app.request("/v1/places?type=room&displayName=101");

    const body = (await res.json()) as PlaceSummary[];
    expect(body.length).toBeGreaterThan(0);
    for (const place of body) {
      expect(place.type).toBe("room");
      expect(place.displayName).toContain("101");
    }
    expect(body.map((place) => place.id)).toContain("main.m.m-101");
  });

  test("rejects an unknown type with 400", async () => {
    const res = await app.request("/v1/places?type=galaxy");

    expect(res.status).toBe(400);
  });
});

describe("GET /v1/places/:placeId", () => {
  test("returns a venue by its hierarchical ID", async () => {
    const res = await app.request("/v1/places/east.taki-plaza");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(v.safeParse(PlaceSchema, body).success).toBe(true);
    expect(body).toEqual(getPlace("east.taki-plaza"));
  });

  test("returns a food stall slot by its hierarchical ID", async () => {
    const res = await app.request("/v1/places/east.fs-east-icho.1");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "food_stall_slot",
      name: "1",
      displayName: "1",
    });
  });

  test("returns 404 for an unknown ID", async () => {
    const res = await app.request("/v1/places/east.fs-east-icho.17");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message: "Unknown place ID: east.fs-east-icho.17",
    });
  });
});

interface OpenApiSpec {
  openapi: string;
  paths: Record<
    string,
    | {
        get?: {
          operationId?: string;
          parameters?: {
            name: string;
            in: string;
            schema?: { enum?: string[] };
          }[];
        };
      }
    | undefined
  >;
}

describe("GET /openapi.json", () => {
  test("documents the places endpoint", async () => {
    const res = await app.request("/openapi.json");

    expect(res.status).toBe(200);

    const spec = (await res.json()) as OpenApiSpec;
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/v1/places"]?.get?.operationId).toBe("listPlaces");
    expect(spec.paths["/v1/places/{placeId}"]?.get?.operationId).toBe(
      "getPlace",
    );
  });

  test("documents the search query parameters", async () => {
    const res = await app.request("/openapi.json");
    const spec = (await res.json()) as OpenApiSpec;

    const params = spec.paths["/v1/places"]?.get?.parameters ?? [];
    expect(params.map((p) => [p.in, p.name])).toEqual([
      ["query", "type"],
      ["query", "name"],
      ["query", "displayName"],
    ]);

    const type = params.find((p) => p.name === "type");
    expect(type?.schema?.enum).toEqual([
      "district",
      "building",
      "stage",
      "outdoor",
      "food_stall_area",
      "room",
      "food_stall_slot",
    ]);
  });

  test("documents every place ID as an enum of the placeId parameter", async () => {
    const res = await app.request("/openapi.json");
    const spec = (await res.json()) as OpenApiSpec;

    const param = spec.paths["/v1/places/{placeId}"]?.get?.parameters?.find(
      (p) => p.name === "placeId",
    );
    const ids = param?.schema?.enum ?? [];

    expect(ids).toContain("east");
    expect(ids).toContain("east.taki-plaza.tp-b1-event");
    expect(ids).toContain("ishikawadai.fs-ishikawadai.7");
    expect(ids.length).toBe(242);
  });

  test("does not document itself", async () => {
    const res = await app.request("/openapi.json");
    const spec = (await res.json()) as OpenApiSpec;

    expect(spec.paths["/openapi.json"]).toBeUndefined();
  });
});
