import * as v from "valibot";
import { districts } from "./places-data";

export { districts };

const namedPlaceEntries = {
  name: v.string(),
  displayName: v.string(),
};

// 判別子は v.literal ではなく単一要素の v.picklist を使う。v.literal は
// JSON Schema の const になり、OpenAPI Generator が解釈できずに型情報ごと
// 落とすため、構造が同じ stage と outdoor が同一モデルに潰れてしまう。
const placeType = <const T extends string>(type: T) => v.picklist([type]);

export const RoomSchema = v.pipe(
  v.object({
    ...namedPlaceEntries,
    type: placeType("room"),
    floor: v.string(),
    alias: v.optional(v.string()),
  }),
  v.metadata({ ref: "Room" }),
);
export type Room = v.InferInput<typeof RoomSchema>;

export const FoodStallSlotSchema = v.pipe(
  v.object({
    ...namedPlaceEntries,
    type: placeType("food_stall_slot"),
  }),
  v.metadata({ ref: "FoodStallSlot" }),
);
export type FoodStallSlot = v.InferInput<typeof FoodStallSlotSchema>;

export const BuildingSchema = v.pipe(
  v.object({
    ...namedPlaceEntries,
    type: placeType("building"),
    rooms: v.array(RoomSchema),
  }),
  v.metadata({ ref: "Building" }),
);
export type Building = v.InferInput<typeof BuildingSchema>;

export const StageSchema = v.pipe(
  v.object({ ...namedPlaceEntries, type: placeType("stage") }),
  v.metadata({ ref: "Stage" }),
);
export type Stage = v.InferInput<typeof StageSchema>;

export const OutdoorSchema = v.pipe(
  v.object({ ...namedPlaceEntries, type: placeType("outdoor") }),
  v.metadata({ ref: "Outdoor" }),
);
export type Outdoor = v.InferInput<typeof OutdoorSchema>;

export const FoodStallAreaSchema = v.pipe(
  v.object({
    ...namedPlaceEntries,
    type: placeType("food_stall_area"),
    slots: v.array(FoodStallSlotSchema),
  }),
  v.metadata({ ref: "FoodStallArea" }),
);
export type FoodStallArea = v.InferInput<typeof FoodStallAreaSchema>;

export const VenueSchema = v.pipe(
  v.variant("type", [
    BuildingSchema,
    StageSchema,
    OutdoorSchema,
    FoodStallAreaSchema,
  ]),
  v.metadata({ ref: "Venue" }),
);
export type Venue = v.InferInput<typeof VenueSchema>;

export const DistrictSchema = v.pipe(
  v.object({
    ...namedPlaceEntries,
    type: placeType("district"),
    venues: v.array(VenueSchema),
  }),
  v.metadata({ ref: "District" }),
);
export type District = v.InferInput<typeof DistrictSchema>;

export const DistrictsSchema = v.array(DistrictSchema);

export const PlaceSchema = v.pipe(
  v.variant("type", [
    DistrictSchema,
    VenueSchema,
    RoomSchema,
    FoodStallSlotSchema,
  ]),
  v.metadata({ ref: "Place" }),
);
export type Place = v.InferInput<typeof PlaceSchema>;

export type PlaceType = Place["type"];

const placeTypes = [
  "district",
  "building",
  "stage",
  "outdoor",
  "food_stall_area",
  "room",
  "food_stall_slot",
] as const satisfies readonly PlaceType[];

export const PlaceTypeSchema = v.picklist(placeTypes);

type DistrictData = (typeof districts)[number];

type ChildPlaceId<
  DistrictName extends string,
  VenueName extends string,
  Venue,
> = Venue extends {
  type: "building";
  rooms: readonly (infer Room)[];
}
  ? Room extends { name: infer RoomName extends string }
    ? `${DistrictName}.${VenueName}.${RoomName}`
    : never
  : Venue extends {
        type: "food_stall_area";
        slots: readonly (infer Slot)[];
      }
    ? Slot extends { name: infer SlotName extends string }
      ? `${DistrictName}.${VenueName}.${SlotName}`
      : never
    : never;

type VenuePlaceId<DistrictName extends string, Venue> = Venue extends {
  name: infer VenueName extends string;
}
  ? | `${DistrictName}.${VenueName}`
    | ChildPlaceId<DistrictName, VenueName, Venue>
  : never;

type DescendantPlaceId<TDistrict extends DistrictData> =
  TDistrict extends DistrictData
    ? VenuePlaceId<TDistrict["name"], TDistrict["venues"][number]>
    : never;

type PlaceIdValue = DistrictData["name"] | DescendantPlaceId<DistrictData>;

const createPlaceEntries = (): [PlaceIdValue, Place][] => {
  const entries: [PlaceIdValue, Place][] = [];

  for (const district of districts) {
    entries.push([district.name, district]);

    for (const venue of district.venues) {
      const venueId = `${district.name}.${venue.name}` as PlaceIdValue;
      entries.push([venueId, venue]);

      const children =
        venue.type === "building"
          ? venue.rooms
          : venue.type === "food_stall_area"
            ? venue.slots
            : [];

      for (const child of children) {
        const childId = `${venueId}.${child.name}` as PlaceIdValue;
        entries.push([childId, child]);
      }
    }
  }

  return entries;
};

const placeEntries = createPlaceEntries();
export const placeIds = placeEntries.map(([id]) => id);

export const findDuplicateIds = <T>(ids: readonly T[]): T[] => [
  ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
];

const duplicateIds = findDuplicateIds(placeIds);

if (duplicateIds.length > 0) {
  throw new Error(
    `Duplicate place ID(s) found in places-data.ts: ${duplicateIds.join(", ")}`,
  );
}

export const PlaceIdSchema = v.picklist(placeIds);
export type PlaceId = v.InferInput<typeof PlaceIdSchema>;

const placesById = new Map<PlaceId, Place>(placeEntries);

export const getPlace = (id: PlaceId): Place => {
  const place = placesById.get(id);

  if (place === undefined) {
    throw new Error(`Unknown place ID: ${id}`);
  }

  return place;
};

export const PlaceSummarySchema = v.object({
  id: PlaceIdSchema,
  type: PlaceTypeSchema,
  name: v.string(),
  displayName: v.string(),
});
export type PlaceSummary = v.InferInput<typeof PlaceSummarySchema>;

const placeSummaries: PlaceSummary[] = placeEntries.map(([id, place]) => ({
  id,
  type: place.type,
  name: place.name,
  displayName: place.displayName,
}));

export interface PlaceFilter {
  type?: PlaceType;
  name?: string;
  displayName?: string;
}

export const searchPlaces = (filter: PlaceFilter = {}): PlaceSummary[] =>
  placeSummaries.filter(
    (place) =>
      (filter.type === undefined || place.type === filter.type) &&
      (filter.name === undefined || place.name === filter.name) &&
      (filter.displayName === undefined ||
        place.displayName.includes(filter.displayName)),
  );
