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

// TODO: ちゃんと書く
export const districts = [
  {
    name: "east",
    displayName: "東地区",
    venues: [
      {
        type: "building",
        name: "taki-plaza",
        displayName: "Taki Plaza",
        rooms: [
          { name: "tp-b1-event", displayName: "地下1階イベントスペース", floor: "B1F" },
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
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
          { name: "8", displayName: "8" },
          { name: "9", displayName: "9" },
          { name: "10", displayName: "10" },
          { name: "11", displayName: "11" },
          { name: "12", displayName: "12" },
          { name: "13", displayName: "13" },
          { name: "14", displayName: "14" },
          { name: "15", displayName: "15" },
          { name: "16", displayName: "16" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-east-deck",
        displayName: "ウッドデッキ横",
        slots: [
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
          { name: "8", displayName: "8" },
          { name: "9", displayName: "9" },
          { name: "10", displayName: "10" },
          { name: "11", displayName: "11" },
        ],
      },
    ],
  },
  {
    name: "main",
    displayName: "本館地区",
    venues: [
      {
        type: "building",
        name: "m",
        displayName: "本館",
        rooms: [
          { name: "m-b07", displayName: "M-B07", floor: "B1F" },
          { name: "m-b45", displayName: "M-B45", floor: "B1F" },
          { name: "m-b43", displayName: "M-B43", floor: "B1F" },
          { name: "m-101", displayName: "M-101", floor: "1F" },
          { name: "m-102", displayName: "M-102", floor: "1F" },
          { name: "m-107", displayName: "M-107", floor: "1F" },
          { name: "m-112", displayName: "M-112", floor: "1F" },
          { name: "m-123", displayName: "M-123", floor: "1F" },
          { name: "m-134", displayName: "M-134", floor: "1F" },
          { name: "m-135", displayName: "M-135", floor: "1F" },
          { name: "m-143a", displayName: "M-143A", floor: "1F" },
          { name: "m-143b", displayName: "M-143B", floor: "1F" },
          { name: "m-155", displayName: "M-155", floor: "1F" },
          { name: "m-156", displayName: "M-156", floor: "1F" },
          { name: "m-157", displayName: "M-157", floor: "1F" },
          { name: "m-178", displayName: "M-178", floor: "1F" },
          { name: "m-278", displayName: "M-278", floor: "2F" },
          { name: "m-356", displayName: "M-356", floor: "3F" },
          { name: "m-b61", displayName: "M-B61", floor: "B1F" },
          { name: "m-290", displayName: "M-290", floor: "2F" },
        ],
      },
      {
        type: "building",
        name: "mb",
        displayName: "本館講義棟",
        rooms: [
          { name: "m-b101", displayName: "M-B101", floor: "B1F" },
          { name: "m-b104", displayName: "M-B104", floor: "B1F" },
          { name: "m-b107", displayName: "M-B107", floor: "B1F" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-main",
        displayName: "本館横",
        slots: [
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
          { name: "8", displayName: "8" },
          { name: "9", displayName: "9" },
          { name: "10", displayName: "10" },
          { name: "11", displayName: "11" },
          { name: "12", displayName: "12" },
          { name: "13", displayName: "13" },
          { name: "14", displayName: "14" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-west",
        displayName: "西案内所横",
        slots: [
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
        ],
      },
    ],
  },
  {
    name: "south",
    displayName: "南地区",
    venues: [
      {
        type: "building",
        name: "s1",
        displayName: "南1号館",
        rooms: [{ name: "s1-101", displayName: "S1-101", floor: "1F" }],
      },
      {
        type: "building",
        name: "s2",
        displayName: "南2号館",
        rooms: [
          { name: "s2-201", displayName: "S2-201", floor: "2F" },
          { name: "s2-202", displayName: "S2-202", floor: "2F" },
          { name: "s2-203", displayName: "S2-203", floor: "2F" },
          { name: "s2-204", displayName: "S2-204", floor: "2F" },
          { name: "s2-101", displayName: "S2-101", floor: "1F" },
          { name: "s2-109", displayName: "S2-109", floor: "1F" },
          { name: "mono", displayName: "ものつくりセンター", floor: "1F" },
        ],
      },
      {
        type: "building",
        name: "s3",
        displayName: "南3号館",
        rooms: [
          { name: "s3-206", displayName: "S3-206", floor: "2F" },
          { name: "s3-207", displayName: "S3-207", floor: "2F" },
          { name: "s3-215", displayName: "S3-215", floor: "2F" },
          { name: "s3-300", displayName: "S3-300", floor: "3F" },
          { name: "s3-403", displayName: "S3-403", floor: "4F" },
          { name: "s3-413", displayName: "S3-413", floor: "4F" },
          { name: "s3-414", displayName: "S3-414", floor: "4F" },
          { name: "s3-510", displayName: "S3-510", floor: "5F" },
          { name: "s3-601", displayName: "S3-601", floor: "6F" },
          { name: "s3-611", displayName: "S3-611", floor: "6F" },
          { name: "s3-906", displayName: "S3-906", floor: "9F" },
          { name: "s3-914", displayName: "S3-914", floor: "9F" },
        ],
      },
      {
        type: "building",
        name: "s4",
        displayName: "南4号館",
        rooms: [
          { name: "s4-201", displayName: "S4-201", floor: "2F" },
          { name: "s4-202", displayName: "S4-202", floor: "2F" },
          { name: "s4-203", displayName: "S4-203", floor: "2F" },
        ],
      },
      {
        type: "building",
        name: "s7",
        displayName: "南7号館",
        rooms: [
          { name: "s7-201", displayName: "S7-201", floor: "2F" },
          { name: "s7-202", displayName: "S7-202", floor: "2F" },
          { name: "s7-207", displayName: "S7-207", floor: "2F" },
          { name: "s7-512", displayName: "S7-512", floor: "5F" },
          { name: "s7-605", displayName: "S7-605", floor: "6F" },
          { name: "s7-701", displayName: "S7-701", floor: "7F" },
          { name: "s7-702", displayName: "S7-702", floor: "7F" },
          { name: "s7-703", displayName: "S7-703", floor: "7F" },
          { name: "s7-707", displayName: "S7-707", floor: "7F" },
          { name: "s7-804", displayName: "S7-804", floor: "8F" },
          { name: "s7-807", displayName: "S7-807", floor: "8F" },
        ],
      },
      {
        type: "building",
        name: "s8",
        displayName: "南8号館",
        rooms: [
          { name: "s8-101", displayName: "S8-101", floor: "1F" },
          { name: "s8-107", displayName: "S8-107", floor: "1F" },
          { name: "s8-501", displayName: "S8-501", floor: "5F" },
          { name: "s8-516", displayName: "S8-516", floor: "5F" },
          { name: "s8-518", displayName: "S8-518", floor: "5F" },
        ],
      },
      {
        type: "building",
        name: "sl",
        displayName: "南講義棟",
        rooms: [{ name: "sl-101", displayName: "SL-101", floor: "1F" }],
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
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
          { name: "8", displayName: "8" },
          { name: "9", displayName: "9" },
          { name: "10", displayName: "10" },
          { name: "11", displayName: "11" },
          { name: "12", displayName: "12" },
          { name: "13", displayName: "13" },
          { name: "14", displayName: "14" },
          { name: "15", displayName: "15" },
          { name: "16", displayName: "16" },
          { name: "17", displayName: "17" },
          { name: "18", displayName: "18" },
          { name: "19", displayName: "19" },
          { name: "20", displayName: "20" },
          { name: "21", displayName: "21" },
          { name: "22", displayName: "22" },
          { name: "23", displayName: "23" },
          { name: "24", displayName: "24" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-south-west",
        displayName: "南地区西",
        slots: [
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
          { name: "8", displayName: "8" },
          { name: "9", displayName: "9" },
          { name: "10", displayName: "10" },
          { name: "11", displayName: "11" },
          { name: "12", displayName: "12" },
          { name: "13", displayName: "13" },
          { name: "14", displayName: "14" },
          { name: "15", displayName: "15" },
          { name: "16", displayName: "16" },
        ],
      },
    ],
  },
  {
    name: "west",
    displayName: "西地区",
    venues: [
      {
        type: "building",
        name: "w2",
        displayName: "西2号館",
        rooms: [
          { name: "w2-401", displayName: "401", floor: "4F" },
          { name: "w2-402", displayName: "402", floor: "4F" },
        ],
      },
      {
        type: "building",
        name: "w3",
        displayName: "西3号館",
        rooms: [
          { name: "w3-201", displayName: "201", floor: "2F" },
          { name: "w3-205", displayName: "205", floor: "2F" },
          { name: "w3-207", displayName: "207", floor: "2F" },
          { name: "w3-301", displayName: "301", floor: "3F" },
          { name: "w3-305", displayName: "305", floor: "3F" },
          { name: "w3-501", displayName: "501", floor: "5F" },
          { name: "w3-707", displayName: "707", floor: "7F" },
          { name: "w3-505", displayName: "505", floor: "5F" },
        ],
      },
      {
        type: "building",
        name: "w5",
        displayName: "西5号館",
        rooms: [
          { name: "w5-105", displayName: "105", floor: "1F" },
          { name: "w5-106", displayName: "106", floor: "1F" },
          { name: "w5-107", displayName: "107", floor: "1F" },
          { name: "tsubame", displayName: "つばめテラス", floor: "2F" },
        ],
      },
      {
        type: "building",
        name: "w8",
        displayName: "西8号館",
        rooms: [
          { name: "w8-404", displayName: "404", floor: "4F" },
          { name: "w8-407", displayName: "407", floor: "4F" },
          { name: "w8-509", displayName: "509", floor: "5F" },
          { name: "w8-601", displayName: "601", floor: "6F" },
          { name: "w8-604", displayName: "604", floor: "6F" },
          { name: "w8-609", displayName: "609", floor: "6F" },
          { name: "w8-7rf", displayName: "リフレッシュコーナー", floor: "7F" },
          { name: "w8-901", displayName: "901", floor: "9F" },
        ],
      },
      {
        type: "building",
        name: "w9",
        displayName: "西9号館",
        rooms: [
          { name: "w9-201", displayName: "201", floor: "2F" },
          { name: "w9-202", displayName: "202", floor: "2F" },
          { name: "w9-323", displayName: "323", floor: "3F" },
          { name: "w9-324", displayName: "324", floor: "3F" },
          { name: "w9-327", displayName: "327", floor: "3F" },
          { name: "w9-706", displayName: "706", floor: "7F" },
          { name: "w9-707", displayName: "707", floor: "7F" },
          { name: "w9-716", displayName: "716", floor: "7F" },
        ],
      },
      {
        type: "building",
        name: "wl1",
        displayName: "西講義棟1",
        rooms: [
          { name: "wl1-201", displayName: "201", floor: "2F" },
          { name: "wl1-401", displayName: "401", floor: "4F" },
        ],
      },
      {
        type: "building",
        name: "wl2",
        displayName: "西講義棟2",
        rooms: [
          { name: "wl2-101", displayName: "101", floor: "1F" },
          { name: "wl2-201", displayName: "201", floor: "2F" },
          { name: "wl2-301", displayName: "301", floor: "3F" },
          { name: "wl2-401", displayName: "401", floor: "4F" },
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
          { name: "gym-arena", displayName: "アリーナ", floor: "1F" },
          { name: "gym-dojo", displayName: "武道場", floor: "B1F" },
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
    name: "north",
    displayName: "北地区",
    venues: [],
  },
  {
    name: "midorigaoka",
    displayName: "緑が丘地区",
    venues: [
      {
        type: "building",
        name: "mi6",
        displayName: "緑が丘6号館",
        rooms: [{ name: "mi6-302", displayName: "302", floor: "3F" }],
      },
    ],
  },
  {
    name: "ishikawadai",
    displayName: "石川台地区",
    venues: [
      {
        type: "building",
        name: "i1",
        displayName: "石川台1号館",
        rooms: [
          { name: "i1-254", displayName: "254", floor: "2F" },
          { name: "i1-255", displayName: "255", floor: "2F" },
          { name: "i1-256", displayName: "256", floor: "2F" },
          { name: "i1-751", displayName: "751", floor: "7F" },
        ],
      },
      {
        type: "building",
        name: "i7",
        displayName: "石川台7号館",
        rooms: [{ name: "i7-mishima", displayName: "Mishima Hall", floor: "1F" }],
      },
      {
        type: "food_stall_area",
        name: "fs-ishikawadai",
        displayName: "石川台地区",
        slots: [
          { name: "1", displayName: "1" },
          { name: "2", displayName: "2" },
          { name: "3", displayName: "3" },
          { name: "4", displayName: "4" },
          { name: "5", displayName: "5" },
          { name: "6", displayName: "6" },
          { name: "7", displayName: "7" },
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
