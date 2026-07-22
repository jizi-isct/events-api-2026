import * as v from "valibot";

const namedPlaceEntries = {
  name: v.string(),
  displayName: v.string(),
};

export const RoomSchema = v.object({
  ...namedPlaceEntries,
  floor: v.string(),
  alias: v.optional(v.string()),
});
export type Room = v.InferInput<typeof RoomSchema>;

export const FoodStallSlotSchema = v.object(namedPlaceEntries);
export type FoodStallSlot = v.InferInput<typeof FoodStallSlotSchema>;

export const VenueSchema = v.variant("type", [
  v.object({
    ...namedPlaceEntries,
    type: v.literal("building"),
    rooms: v.array(RoomSchema),
  }),
  v.object({ ...namedPlaceEntries, type: v.literal("stage") }),
  v.object({ ...namedPlaceEntries, type: v.literal("outdoor") }),
  v.object({
    ...namedPlaceEntries,
    type: v.literal("food_stall_area"),
    slots: v.array(FoodStallSlotSchema),
  }),
]);
export type Venue = v.InferInput<typeof VenueSchema>;

export const DistrictSchema = v.object({
  ...namedPlaceEntries,
  venues: v.array(VenueSchema),
});
export type District = v.InferInput<typeof DistrictSchema>;

export const DistrictsSchema = v.array(DistrictSchema);

export const PlaceSchema = v.union([
  DistrictSchema,
  VenueSchema,
  RoomSchema,
  FoodStallSlotSchema,
]);
export type Place = v.InferInput<typeof PlaceSchema>;

import districtsJson from "./places.json";
import type { PlaceId } from "./place-id.generated";

export type { PlaceId };

export const districts = v.parse(DistrictsSchema, districtsJson);

const createPlaceEntries = (): [PlaceId, Place][] => {
  const entries: [PlaceId, Place][] = [];

  for (const district of districts) {
    entries.push([district.name as PlaceId, district]);

    for (const venue of district.venues) {
      const venueId = `${district.name}.${venue.name}` as PlaceId;
      entries.push([venueId, venue]);

      const children =
        venue.type === "building"
          ? venue.rooms
          : venue.type === "food_stall_area"
            ? venue.slots
            : [];

      for (const child of children) {
        const childId = `${venueId}.${child.name}` as PlaceId;
        entries.push([childId, child]);
      }
    }
  }

  return entries;
};

const placeEntries = createPlaceEntries();
export const placeIds = placeEntries.map(([id]) => id);

export const PlaceIdSchema = v.picklist(placeIds);

const placesById = new Map<PlaceId, Place>(placeEntries);

if (placesById.size !== placeEntries.length) {
  const duplicateIds = placeEntries
    .map(([id]) => id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  throw new Error(
    `Duplicate place ID(s) found in places.json: ${[...new Set(duplicateIds)].join(", ")}`,
  );
}

export const getPlace = (id: PlaceId): Place => {
  const place = placesById.get(id);

  if (place === undefined) {
    throw new Error(`Unknown place ID: ${id}`);
  }

  return place;
};
