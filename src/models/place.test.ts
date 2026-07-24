import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  districts,
  DistrictsSchema,
  findDuplicateIds,
  getPlace,
  placeIds,
  PlaceIdSchema,
} from "./place";

describe("districts", () => {
  test("all definitions conform to DistrictsSchema", () => {
    expect(v.safeParse(DistrictsSchema, districts).success).toBe(true);
  });

  test("has no duplicate place IDs", () => {
    expect(findDuplicateIds(placeIds)).toEqual([]);
  });
});

describe("findDuplicateIds", () => {
  test("returns IDs that appear more than once", () => {
    expect(findDuplicateIds(["a", "b", "a", "c", "c", "c"])).toEqual([
      "a",
      "c",
    ]);
  });

  test("returns an empty array when there are no duplicates", () => {
    expect(findDuplicateIds(["a", "b", "c"])).toEqual([]);
  });
});

describe("getPlace", () => {
  test("gets a venue by its hierarchical ID", () => {
    expect(getPlace("midorigaoka.mi6")).toEqual({
      type: "building",
      name: "mi6",
      displayName: "緑が丘6号館",
      rooms: [
        { type: "room", name: "mi6-302", displayName: "MI6-302", floor: "3F" },
      ],
    });
  });

  test("gets a room by its hierarchical ID", () => {
    expect(getPlace("midorigaoka.mi6.mi6-302")).toEqual({
      type: "room",
      name: "mi6-302",
      displayName: "MI6-302",
      floor: "3F",
    });
  });

  test("rejects an unknown ID", () => {
    expect(v.safeParse(PlaceIdSchema, "midorigaoka.mi6.unknown").success).toBe(
      false,
    );
  });

  test("rejects an out-of-range food stall slot ID", () => {
    // @ts-expect-error East Icho has slots 1 through 16 only.
    expect(() => getPlace("east.fs-east-icho.17")).toThrow(
      "Unknown place ID: east.fs-east-icho.17",
    );
  });
});
