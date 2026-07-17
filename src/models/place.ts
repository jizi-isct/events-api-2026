type RoomDefinition = { name: string; displayName: string };
type FoodStallSlotDefinition = { name: string; displayName: string };
type VenueDefinition =
  | {
      type: "building";
      name: string;
      displayName: string;
      rooms: RoomDefinition[];
    }
  | { type: "stage"; name: string; displayName: string }
  | { type: "outdoor"; name: string; displayName: string }
  | {
      type: "food_stall_area";
      name: string;
      displayName: string;
      slots: FoodStallSlotDefinition[];
    };
type DistrictDefinition = {
  name: string;
  displayName: string;
  venues: VenueDefinition[];
};

const createSlots = (count: number): FoodStallSlotDefinition[] =>
  Array.from({ length: count }, (_, index) => {
    const displayName = String(index + 1);
    return { name: displayName, displayName };
  });

// TODO: ちゃんと書く
const districts = [
  {
    name: "east",
    displayName: "東地区",
    venues: [
      {
        type: "building",
        name: "taki-plaza",
        displayName: "Taki Plaza",
        rooms: [
          { name: "tp-b1-event", displayName: "地下1階イベントスペース" },
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
        slots: createSlots(16),
      },
      {
        type: "food_stall_area",
        name: "fs-east-deck",
        displayName: "ウッドデッキ横",
        slots: createSlots(11),
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
          { name: "m-b07", displayName: "M-B07" },
          { name: "m-b45", displayName: "M-B45" },
          { name: "m-b43", displayName: "M-B43" },
          { name: "m-101", displayName: "M-101" },
          { name: "m-102", displayName: "M-102" },
          { name: "m-107", displayName: "M-107" },
          { name: "m-112", displayName: "M-112" },
          { name: "m-123", displayName: "M-123" },
          { name: "m-134", displayName: "M-134" },
          { name: "m-135", displayName: "M-135" },
          { name: "m-143a", displayName: "M-143A" },
          { name: "m-143b", displayName: "M-143B" },
          { name: "m-155", displayName: "M-155" },
          { name: "m-156", displayName: "M-156" },
          { name: "m-157", displayName: "M-157" },
          { name: "m-178", displayName: "M-178" },
          { name: "m-278", displayName: "M-278" },
          { name: "m-356", displayName: "M-356" },
          { name: "m-b61", displayName: "M-B61" },
          { name: "m-290", displayName: "M-290" },
        ],
      },
      {
        type: "building",
        name: "mb",
        displayName: "本館講義棟",
        rooms: [
          { name: "m-b101", displayName: "M-B101" },
          { name: "m-b104", displayName: "M-B104" },
          { name: "m-b107", displayName: "M-B107" },
        ],
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-main",
        displayName: "本館横",
        slots: createSlots(14),
      },
      {
        type: "food_stall_area",
        name: "fs-honkan-west",
        displayName: "西案内所横",
        slots: createSlots(2),
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
        rooms: [{ name: "s1-101", displayName: "S1-101" }],
      },
      {
        type: "building",
        name: "s2",
        displayName: "南2号館",
        rooms: [
          { name: "s2-201", displayName: "S2-201" },
          { name: "s2-202", displayName: "S2-202" },
          { name: "s2-203", displayName: "S2-203" },
          { name: "s2-204", displayName: "S2-204" },
          { name: "s2-101", displayName: "S2-101" },
          { name: "s2-109", displayName: "S2-109" },
          { name: "mono", displayName: "ものつくりセンター" },
        ],
      },
      {
        type: "building",
        name: "s3",
        displayName: "南3号館",
        rooms: [
          { name: "s3-206", displayName: "S3-206" },
          { name: "s3-207", displayName: "S3-207" },
          { name: "s3-215", displayName: "S3-215" },
          { name: "s3-300", displayName: "S3-300" },
          { name: "s3-403", displayName: "S3-403" },
          { name: "s3-413", displayName: "S3-413" },
          { name: "s3-414", displayName: "S3-414" },
          { name: "s3-510", displayName: "S3-510" },
          { name: "s3-601", displayName: "S3-601" },
          { name: "s3-611", displayName: "S3-611" },
          { name: "s3-906", displayName: "S3-906" },
          { name: "s3-914", displayName: "S3-914" },
        ],
      },
      {
        type: "building",
        name: "s4",
        displayName: "南4号館",
        rooms: [
          { name: "s4-201", displayName: "S4-201" },
          { name: "s4-202", displayName: "S4-202" },
          { name: "s4-203", displayName: "S4-203" },
        ],
      },
      {
        type: "building",
        name: "s7",
        displayName: "南7号館",
        rooms: [
          { name: "s7-201", displayName: "S7-201" },
          { name: "s7-202", displayName: "S7-202" },
          { name: "s7-207", displayName: "S7-207" },
          { name: "s7-512", displayName: "S7-512" },
          { name: "s7-605", displayName: "S7-605" },
          { name: "s7-701", displayName: "S7-701" },
          { name: "s7-702", displayName: "S7-702" },
          { name: "s7-703", displayName: "S7-703" },
          { name: "s7-707", displayName: "S7-707" },
          { name: "s7-804", displayName: "S7-804" },
          { name: "s7-807", displayName: "S7-807" },
        ],
      },
      {
        type: "building",
        name: "s8",
        displayName: "南8号館",
        rooms: [
          { name: "s8-101", displayName: "S8-101" },
          { name: "s8-107", displayName: "S8-107" },
          { name: "s8-501", displayName: "S8-501" },
          { name: "s8-516", displayName: "S8-516" },
          { name: "s8-518", displayName: "S8-518" },
        ],
      },
      {
        type: "building",
        name: "sl",
        displayName: "南講義棟",
        rooms: [{ name: "sl-101", displayName: "SL-101" }],
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
        slots: createSlots(24),
      },
      {
        type: "food_stall_area",
        name: "fs-south-west",
        displayName: "南地区西",
        slots: createSlots(16),
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
          { name: "w2-401", displayName: "401" },
          { name: "w2-402", displayName: "402" },
        ],
      },
      {
        type: "building",
        name: "w3",
        displayName: "西3号館",
        rooms: [
          { name: "w3-201", displayName: "201" },
          { name: "w3-205", displayName: "205" },
          { name: "w3-207", displayName: "207" },
          { name: "w3-301", displayName: "301" },
          { name: "w3-305", displayName: "305" },
          { name: "w3-501", displayName: "501" },
          { name: "w3-707", displayName: "707" },
          { name: "w3-505", displayName: "505" },
        ],
      },
      {
        type: "building",
        name: "w5",
        displayName: "西5号館",
        rooms: [
          { name: "w5-105", displayName: "105" },
          { name: "w5-106", displayName: "106" },
          { name: "w5-107", displayName: "107" },
          { name: "tsubame", displayName: "つばめテラス" },
        ],
      },
      {
        type: "building",
        name: "w8",
        displayName: "西8号館",
        rooms: [
          { name: "w8-404", displayName: "404" },
          { name: "w8-407", displayName: "407" },
          { name: "w8-509", displayName: "509" },
          { name: "w8-601", displayName: "601" },
          { name: "w8-604", displayName: "604" },
          { name: "w8-609", displayName: "609" },
          { name: "w8-7rf", displayName: "リフレッシュコーナー" },
          { name: "w8-901", displayName: "901" },
        ],
      },
      {
        type: "building",
        name: "w9",
        displayName: "西9号館",
        rooms: [
          { name: "w9-201", displayName: "201" },
          { name: "w9-202", displayName: "202" },
          { name: "w9-323", displayName: "323" },
          { name: "w9-324", displayName: "324" },
          { name: "w9-327", displayName: "327" },
          { name: "w9-706", displayName: "706" },
          { name: "w9-707", displayName: "707" },
          { name: "w9-716", displayName: "716" },
        ],
      },
      {
        type: "building",
        name: "wl1",
        displayName: "西講義棟1",
        rooms: [
          { name: "wl1-201", displayName: "201" },
          { name: "wl1-401", displayName: "401" },
        ],
      },
      {
        type: "building",
        name: "wl2",
        displayName: "西講義棟2",
        rooms: [
          { name: "wl2-101", displayName: "101" },
          { name: "wl2-201", displayName: "201" },
          { name: "wl2-301", displayName: "301" },
          { name: "wl2-401", displayName: "401" },
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
          { name: "gym-arena", displayName: "アリーナ" },
          { name: "gym-dojo", displayName: "武道場" },
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
        rooms: [{ name: "mi6-302", displayName: "302" }],
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
          { name: "i1-254", displayName: "254" },
          { name: "i1-255", displayName: "255" },
          { name: "i1-256", displayName: "256" },
          { name: "i1-751", displayName: "751" },
        ],
      },
      {
        type: "building",
        name: "i7",
        displayName: "石川台7号館",
        rooms: [{ name: "i7-mishima", displayName: "Mishima Hall" }],
      },
      {
        type: "food_stall_area",
        name: "fs-ishikawadai",
        displayName: "石川台地区",
        slots: createSlots(7),
      },
    ],
  },
] as const satisfies DistrictDefinition[];
