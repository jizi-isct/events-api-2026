import * as v from "valibot";

const namedPlaceEntries = {
  name: v.string(),
  displayName: v.string(),
};

export const RoomSchema = v.object({
  ...namedPlaceEntries,
  type: v.literal("room"),
});
export type Room = v.InferInput<typeof RoomSchema>;

export const FoodStallSlotSchema = v.object({
  ...namedPlaceEntries,
  type: v.literal("food_stall_slot"),
});
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
  type: v.literal("district"),
  venues: v.array(VenueSchema),
});
export type District = v.InferInput<typeof DistrictSchema>;

export const DistrictsSchema = v.array(DistrictSchema);

export const PlaceSchema = v.variant("type", [
  DistrictSchema,
  VenueSchema,
  RoomSchema,
  FoodStallSlotSchema,
]);
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

// TODO: ちゃんと書く
export const districts = [
  {
    type: "district",
    name: "east",
    displayName: "東地区",
    venues: [
      {
        type: "building",
        name: "taki-plaza",
        displayName: "Taki Plaza",
        rooms: [
          {
            type: "room",
            name: "tp-b1-event",
            displayName: "地下1階イベントスペース",
          },
        ],
      },
      {
        type: "stage",
        name: "taki-plaza-stage",
        displayName: "Taki Plazaステージ",
      },
      {
        type: "stage",
        name: "wood-deck",
        displayName: "ウッドデッキステージ",
      },
      {
        type: "stage",
        name: "outdoor-stage",
        displayName: "野外ステージ",
      },
      {
        type: "food_stall_area",
        name: "fs-east-icho",
        displayName: "いちょう並木",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
          { type: "food_stall_slot", name: "8", displayName: "8" },
          { type: "food_stall_slot", name: "9", displayName: "9" },
          { type: "food_stall_slot", name: "10", displayName: "10" },
          { type: "food_stall_slot", name: "11", displayName: "11" },
          { type: "food_stall_slot", name: "12", displayName: "12" },
          { type: "food_stall_slot", name: "13", displayName: "13" },
          { type: "food_stall_slot", name: "14", displayName: "14" },
          { type: "food_stall_slot", name: "15", displayName: "15" },
          { type: "food_stall_slot", name: "16", displayName: "16" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-east-deck",
        displayName: "ウッドデッキ横",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
          { type: "food_stall_slot", name: "8", displayName: "8" },
          { type: "food_stall_slot", name: "9", displayName: "9" },
          { type: "food_stall_slot", name: "10", displayName: "10" },
          { type: "food_stall_slot", name: "11", displayName: "11" },
        ],
      },
    ],
  },
  {
    type: "district",
    name: "main",
    displayName: "本館地区",
    venues: [
      {
        type: "building",
        name: "m",
        displayName: "本館",
        rooms: [
          { type: "room", name: "m-b07", displayName: "M-B07" },
          { type: "room", name: "m-b45", displayName: "M-B45" },
          { type: "room", name: "m-b43", displayName: "M-B43" },
          { type: "room", name: "m-101", displayName: "M-101" },
          { type: "room", name: "m-102", displayName: "M-102" },
          { type: "room", name: "m-107", displayName: "M-107" },
          { type: "room", name: "m-112", displayName: "M-112" },
          { type: "room", name: "m-123", displayName: "M-123" },
          { type: "room", name: "m-134", displayName: "M-134" },
          { type: "room", name: "m-135", displayName: "M-135" },
          { type: "room", name: "m-143a", displayName: "M-143A" },
          { type: "room", name: "m-143b", displayName: "M-143B" },
          { type: "room", name: "m-155", displayName: "M-155" },
          { type: "room", name: "m-156", displayName: "M-156" },
          { type: "room", name: "m-157", displayName: "M-157" },
          { type: "room", name: "m-178", displayName: "M-178" },
          { type: "room", name: "m-278", displayName: "M-278" },
          { type: "room", name: "m-356", displayName: "M-356" },
          { type: "room", name: "m-b61", displayName: "M-B61" },
          { type: "room", name: "m-290", displayName: "M-290" },
        ],
      },
      {
        type: "building",
        name: "mb",
        displayName: "本館講義棟",
        rooms: [
          { type: "room", name: "m-b101", displayName: "M-B101" },
          { type: "room", name: "m-b104", displayName: "M-B104" },
          { type: "room", name: "m-b107", displayName: "M-B107" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-main",
        displayName: "本館横",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
          { type: "food_stall_slot", name: "8", displayName: "8" },
          { type: "food_stall_slot", name: "9", displayName: "9" },
          { type: "food_stall_slot", name: "10", displayName: "10" },
          { type: "food_stall_slot", name: "11", displayName: "11" },
          { type: "food_stall_slot", name: "12", displayName: "12" },
          { type: "food_stall_slot", name: "13", displayName: "13" },
          { type: "food_stall_slot", name: "14", displayName: "14" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-west",
        displayName: "西案内所横",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
        ],
      },
    ],
  },
  {
    type: "district",
    name: "south",
    displayName: "南地区",
    venues: [
      {
        type: "building",
        name: "s1",
        displayName: "南1号館",
        rooms: [{ type: "room", name: "s1-101", displayName: "S1-101" }],
      },
      {
        type: "building",
        name: "s2",
        displayName: "南2号館",
        rooms: [
          { type: "room", name: "s2-201", displayName: "S2-201" },
          { type: "room", name: "s2-202", displayName: "S2-202" },
          { type: "room", name: "s2-203", displayName: "S2-203" },
          { type: "room", name: "s2-204", displayName: "S2-204" },
          { type: "room", name: "s2-101", displayName: "S2-101" },
          { type: "room", name: "s2-109", displayName: "S2-109" },
          { type: "room", name: "mono", displayName: "ものつくりセンター" },
        ],
      },
      {
        type: "building",
        name: "s3",
        displayName: "南3号館",
        rooms: [
          { type: "room", name: "s3-206", displayName: "S3-206" },
          { type: "room", name: "s3-207", displayName: "S3-207" },
          { type: "room", name: "s3-215", displayName: "S3-215" },
          { type: "room", name: "s3-300", displayName: "S3-300" },
          { type: "room", name: "s3-403", displayName: "S3-403" },
          { type: "room", name: "s3-413", displayName: "S3-413" },
          { type: "room", name: "s3-414", displayName: "S3-414" },
          { type: "room", name: "s3-510", displayName: "S3-510" },
          { type: "room", name: "s3-601", displayName: "S3-601" },
          { type: "room", name: "s3-611", displayName: "S3-611" },
          { type: "room", name: "s3-906", displayName: "S3-906" },
          { type: "room", name: "s3-914", displayName: "S3-914" },
        ],
      },
      {
        type: "building",
        name: "s4",
        displayName: "南4号館",
        rooms: [
          { type: "room", name: "s4-201", displayName: "S4-201" },
          { type: "room", name: "s4-202", displayName: "S4-202" },
          { type: "room", name: "s4-203", displayName: "S4-203" },
        ],
      },
      {
        type: "building",
        name: "s7",
        displayName: "南7号館",
        rooms: [
          { type: "room", name: "s7-201", displayName: "S7-201" },
          { type: "room", name: "s7-202", displayName: "S7-202" },
          { type: "room", name: "s7-207", displayName: "S7-207" },
          { type: "room", name: "s7-512", displayName: "S7-512" },
          { type: "room", name: "s7-605", displayName: "S7-605" },
          { type: "room", name: "s7-701", displayName: "S7-701" },
          { type: "room", name: "s7-702", displayName: "S7-702" },
          { type: "room", name: "s7-703", displayName: "S7-703" },
          { type: "room", name: "s7-707", displayName: "S7-707" },
          { type: "room", name: "s7-804", displayName: "S7-804" },
          { type: "room", name: "s7-807", displayName: "S7-807" },
        ],
      },
      {
        type: "building",
        name: "s8",
        displayName: "南8号館",
        rooms: [
          { type: "room", name: "s8-101", displayName: "S8-101" },
          { type: "room", name: "s8-107", displayName: "S8-107" },
          { type: "room", name: "s8-501", displayName: "S8-501" },
          { type: "room", name: "s8-516", displayName: "S8-516" },
          { type: "room", name: "s8-518", displayName: "S8-518" },
        ],
      },
      {
        type: "building",
        name: "sl",
        displayName: "南講義棟",
        rooms: [{ type: "room", name: "sl-101", displayName: "SL-101" }],
      },
      {
        type: "building",
        name: "circle-1",
        displayName: "サークル棟1",
        rooms: [],
      },
      {
        type: "outdoor",
        name: "waste-station",
        displayName: "工系三学院廃棄物集積場",
      },
      {
        type: "outdoor",
        name: "seven-front",
        displayName: "セブンイレブン前",
      },
      {
        type: "food_stall_area",
        name: "fs-south-east",
        displayName: "南地区東",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
          { type: "food_stall_slot", name: "8", displayName: "8" },
          { type: "food_stall_slot", name: "9", displayName: "9" },
          { type: "food_stall_slot", name: "10", displayName: "10" },
          { type: "food_stall_slot", name: "11", displayName: "11" },
          { type: "food_stall_slot", name: "12", displayName: "12" },
          { type: "food_stall_slot", name: "13", displayName: "13" },
          { type: "food_stall_slot", name: "14", displayName: "14" },
          { type: "food_stall_slot", name: "15", displayName: "15" },
          { type: "food_stall_slot", name: "16", displayName: "16" },
          { type: "food_stall_slot", name: "17", displayName: "17" },
          { type: "food_stall_slot", name: "18", displayName: "18" },
          { type: "food_stall_slot", name: "19", displayName: "19" },
          { type: "food_stall_slot", name: "20", displayName: "20" },
          { type: "food_stall_slot", name: "21", displayName: "21" },
          { type: "food_stall_slot", name: "22", displayName: "22" },
          { type: "food_stall_slot", name: "23", displayName: "23" },
          { type: "food_stall_slot", name: "24", displayName: "24" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-south-west",
        displayName: "南地区西",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
          { type: "food_stall_slot", name: "8", displayName: "8" },
          { type: "food_stall_slot", name: "9", displayName: "9" },
          { type: "food_stall_slot", name: "10", displayName: "10" },
          { type: "food_stall_slot", name: "11", displayName: "11" },
          { type: "food_stall_slot", name: "12", displayName: "12" },
          { type: "food_stall_slot", name: "13", displayName: "13" },
          { type: "food_stall_slot", name: "14", displayName: "14" },
          { type: "food_stall_slot", name: "15", displayName: "15" },
          { type: "food_stall_slot", name: "16", displayName: "16" },
        ],
      },
    ],
  },
  {
    type: "district",
    name: "west",
    displayName: "西地区",
    venues: [
      {
        type: "building",
        name: "w2",
        displayName: "西2号館",
        rooms: [
          { type: "room", name: "w2-401", displayName: "401" },
          { type: "room", name: "w2-402", displayName: "402" },
        ],
      },
      {
        type: "building",
        name: "w3",
        displayName: "西3号館",
        rooms: [
          { type: "room", name: "w3-201", displayName: "201" },
          { type: "room", name: "w3-205", displayName: "205" },
          { type: "room", name: "w3-207", displayName: "207" },
          { type: "room", name: "w3-301", displayName: "301" },
          { type: "room", name: "w3-305", displayName: "305" },
          { type: "room", name: "w3-501", displayName: "501" },
          { type: "room", name: "w3-707", displayName: "707" },
          { type: "room", name: "w3-505", displayName: "505" },
        ],
      },
      {
        type: "building",
        name: "w5",
        displayName: "西5号館",
        rooms: [
          { type: "room", name: "w5-105", displayName: "105" },
          { type: "room", name: "w5-106", displayName: "106" },
          { type: "room", name: "w5-107", displayName: "107" },
          { type: "room", name: "tsubame", displayName: "つばめテラス" },
        ],
      },
      {
        type: "building",
        name: "w8",
        displayName: "西8号館",
        rooms: [
          { type: "room", name: "w8-404", displayName: "404" },
          { type: "room", name: "w8-407", displayName: "407" },
          { type: "room", name: "w8-509", displayName: "509" },
          { type: "room", name: "w8-601", displayName: "601" },
          { type: "room", name: "w8-604", displayName: "604" },
          { type: "room", name: "w8-609", displayName: "609" },
          { type: "room", name: "w8-7rf", displayName: "リフレッシュコーナー" },
          { type: "room", name: "w8-901", displayName: "901" },
        ],
      },
      {
        type: "building",
        name: "w9",
        displayName: "西9号館",
        rooms: [
          { type: "room", name: "w9-201", displayName: "201" },
          { type: "room", name: "w9-202", displayName: "202" },
          { type: "room", name: "w9-323", displayName: "323" },
          { type: "room", name: "w9-324", displayName: "324" },
          { type: "room", name: "w9-327", displayName: "327" },
          { type: "room", name: "w9-706", displayName: "706" },
          { type: "room", name: "w9-707", displayName: "707" },
          { type: "room", name: "w9-716", displayName: "716" },
        ],
      },
      {
        type: "building",
        name: "wl1",
        displayName: "西講義棟1",
        rooms: [
          { type: "room", name: "wl1-201", displayName: "201" },
          { type: "room", name: "wl1-401", displayName: "401" },
        ],
      },
      {
        type: "building",
        name: "wl2",
        displayName: "西講義棟2",
        rooms: [
          { type: "room", name: "wl2-101", displayName: "101" },
          { type: "room", name: "wl2-201", displayName: "201" },
          { type: "room", name: "wl2-301", displayName: "301" },
          { type: "room", name: "wl2-401", displayName: "401" },
        ],
      },
      {
        type: "stage",
        name: "lecture-hall-70",
        displayName: "70周年記念講堂",
      },
      {
        type: "stage",
        name: "digital-hall",
        displayName: "ディジタル多目的ホール",
      },
      {
        type: "building",
        name: "gym",
        displayName: "屋内運動場",
        rooms: [
          { type: "room", name: "gym-arena", displayName: "アリーナ" },
          { type: "room", name: "gym-dojo", displayName: "武道場" },
        ],
      },
      {
        type: "building",
        name: "circle-2",
        displayName: "サークル棟2",
        rooms: [],
      },
    ],
  },
  {
    type: "district",
    name: "north",
    displayName: "北地区",
    venues: [],
  },
  {
    type: "district",
    name: "midorigaoka",
    displayName: "緑が丘地区",
    venues: [
      {
        type: "building",
        name: "mi6",
        displayName: "緑が丘6号館",
        rooms: [{ type: "room", name: "mi6-302", displayName: "302" }],
      },
    ],
  },
  {
    type: "district",
    name: "ishikawadai",
    displayName: "石川台地区",
    venues: [
      {
        type: "building",
        name: "i1",
        displayName: "石川台1号館",
        rooms: [
          { type: "room", name: "i1-254", displayName: "254" },
          { type: "room", name: "i1-255", displayName: "255" },
          { type: "room", name: "i1-256", displayName: "256" },
          { type: "room", name: "i1-751", displayName: "751" },
        ],
      },
      {
        type: "building",
        name: "i7",
        displayName: "石川台7号館",
        rooms: [
          { type: "room", name: "i7-mishima", displayName: "Mishima Hall" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-ishikawadai",
        displayName: "石川台地区",
        slots: [
          { type: "food_stall_slot", name: "1", displayName: "1" },
          { type: "food_stall_slot", name: "2", displayName: "2" },
          { type: "food_stall_slot", name: "3", displayName: "3" },
          { type: "food_stall_slot", name: "4", displayName: "4" },
          { type: "food_stall_slot", name: "5", displayName: "5" },
          { type: "food_stall_slot", name: "6", displayName: "6" },
          { type: "food_stall_slot", name: "7", displayName: "7" },
        ],
      },
    ],
  },
] as const satisfies District[];

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
const placeIds = placeEntries.map(([id]) => id);

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
