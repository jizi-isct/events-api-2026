import * as v from "valibot";
import { OccasionSchema } from "./occasion";

// 判別子・列挙は v.literal / v.union ではなく v.picklist を使う。v.literal は
// JSON Schema の const になり、OpenAPI Generator が解釈できずに型情報ごと落とす。
const tagOf = <const T extends string>(tag: T) => v.picklist([tag]);

export const GeneralTagSchema = v.pipe(
  v.picklist(["experience", "display", "performance", "food", "lecture"]),
  v.metadata({ ref: "GeneralTag" }),
);

export type GeneralTag = v.InferInput<typeof GeneralTagSchema>;

export const MainFoodStallTagSchema = v.pipe(
  v.object({
    tag: tagOf("main"),
    tag2: v.picklist([
      "rice",
      "noodle_flour",
      "skewer_grill",
      "snack",
      "soup",
      "world",
    ]),
  }),
  v.metadata({ ref: "MainFoodStallTag" }),
);

export const SweetFoodStallTagSchema = v.pipe(
  v.object({
    tag: tagOf("sweet"),
    tag2: v.picklist([
      "japanese",
      "western",
      "cold",
      "snack",
      "drink",
      "world",
    ]),
  }),
  v.metadata({ ref: "SweetFoodStallTag" }),
);

export const DrinkFoodStallTagSchema = v.pipe(
  v.object({
    tag: tagOf("drink"),
  }),
  v.metadata({ ref: "DrinkFoodStallTag" }),
);

export const FoodStallTagSchema = v.pipe(
  v.variant("tag", [
    MainFoodStallTagSchema,
    SweetFoodStallTagSchema,
    DrinkFoodStallTagSchema,
  ]),
  v.metadata({ ref: "FoodStallTag" }),
);

export type FoodStallTag = v.InferInput<typeof FoodStallTagSchema>;

/**
 * 企画を探すときの入り口になるカテゴリ。
 * type やタグとは直交しておらず、laboratory や display のように種別・タグと
 * 重なる値もあるが、利用者が選ぶ区分としてそのまま持つ。
 */
export const CategorySchema = v.pipe(
  v.picklist([
    "hearty",
    "street_food",
    "sweets",
    "performance",
    "play",
    "cafe",
    "laboratory",
    "display",
  ]),
  v.metadata({ ref: "Category" }),
);

export type Category = v.InferInput<typeof CategorySchema>;

export const ProjectIdSchema = v.string();

export type ProjectId = v.InferInput<typeof ProjectIdSchema>;

// 共通情報。v.intersect で種別ごとのスキーマと重ねると JSON Schema 上は
// allOf + oneOf になるが、OpenAPI Generator はこれを 1 つの構造体に潰して
// 全種別のフィールドを必須にしてしまう。そのため spec 上は共通情報を各種別に
// 展開した素の oneOf になるよう、entries を spread して組み立てる。
const projectBaseEntries = {
  id: ProjectIdSchema,
  groupName: v.string(),
  projectName: v.string(),
  description: v.string(),
  isChildFriendly: v.boolean(),
  isRecommended: v.boolean(),
  // 未設定の企画があり得るので任意。
  category: v.optional(CategorySchema),
  occasions: v.array(OccasionSchema),
};

export const FoodStallProjectSchema = v.pipe(
  v.object({
    ...projectBaseEntries,
    type: tagOf("food-stall"),
    tag: v.array(FoodStallTagSchema),
  }),
  v.metadata({ ref: "FoodStallProject" }),
);

export const GeneralProjectSchema = v.pipe(
  v.object({
    ...projectBaseEntries,
    type: tagOf("general"),
    tag: v.array(GeneralTagSchema),
  }),
  v.metadata({ ref: "GeneralProject" }),
);

export const LaboratoryProjectSchema = v.pipe(
  v.object({
    ...projectBaseEntries,
    type: tagOf("laboratory"),
    isTour: v.boolean(),
  }),
  v.metadata({ ref: "LaboratoryProject" }),
);

export const StageProjectSchema = v.pipe(
  v.object({
    ...projectBaseEntries,
    type: tagOf("stage"),
  }),
  v.metadata({ ref: "StageProject" }),
);

/**
 * 企画を表す。共通情報に、type で判別される種別ごとの情報を加えた直和型。
 */
export const ProjectSchema = v.pipe(
  v.variant("type", [
    FoodStallProjectSchema,
    GeneralProjectSchema,
    LaboratoryProjectSchema,
    StageProjectSchema,
  ]),
  v.metadata({ ref: "Project" }),
);

export type Project = v.InferInput<typeof ProjectSchema>;

export type ProjectType = Project["type"];
