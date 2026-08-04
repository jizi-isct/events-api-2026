import * as v from "valibot";
import { OccasionSchema } from "./occasion";

export const GeneralTagSchema = v.union([
  v.literal("experience"),
  v.literal("display"),
  v.literal("performance"),
  v.literal("food"),
  v.literal("lecture"),
]);

export type GeneralTag = v.InferInput<typeof GeneralTagSchema>;

export const FoodStallTagSchema = v.variant("tag", [
  v.object({
    tag: v.literal("main"),
    tag2: v.union([
      v.literal("rice"),
      v.literal("noodle_flour"),
      v.literal("skewer_grill"),
      v.literal("snack"),
      v.literal("soup"),
      v.literal("world"),
    ]),
  }),
  v.object({
    tag: v.literal("sweet"),
    tag2: v.union([
      v.literal("japanese"),
      v.literal("western"),
      v.literal("cold"),
      v.literal("snack"),
      v.literal("drink"),
      v.literal("world"),
    ]),
  }),
  v.object({
    tag: v.literal("drink"),
  }),
]);

export type FoodStallTag = v.InferInput<typeof FoodStallTagSchema>;

export const ProjectIdSchema = v.string();

export type ProjectId = v.InferInput<typeof ProjectIdSchema>;

const ProjectBaseSchema = v.object({
  id: ProjectIdSchema,
  groupName: v.string(),
  projectName: v.string(),
  description: v.string(),
  isChildFriendly: v.boolean(),
  isRecommended: v.boolean(),
  occasions: v.array(OccasionSchema),
});

const ProjectVariantSchema = v.variant("type", [
  v.object({
    type: v.literal("food-stall"),
    tag: v.array(FoodStallTagSchema),
  }),
  v.object({
    type: v.literal("general"),
    tag: v.array(GeneralTagSchema),
  }),
  v.object({
    type: v.literal("laboratory"),
    tour: v.boolean(),
  }),
  v.object({
    type: v.literal("stage"),
  }),
]);

/**
 * 企画を表す。共通情報({@link ProjectBaseSchema})に、
 * type で判別される種別ごとの情報({@link ProjectVariantSchema})を重ねた直和型。
 */
export const ProjectSchema = v.intersect([
  ProjectBaseSchema,
  ProjectVariantSchema,
]);

export type Project = v.InferInput<typeof ProjectSchema>;

export type ProjectType = Project["type"];
