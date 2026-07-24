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

export const ProjectSchema = v.union([
  v.object({
    groupName: v.string(),
    projectName: v.string(),
    description: v.string(),
    isChildFriendly: v.boolean(),
    isRecommended: v.boolean(),
    occasions: v.array(OccasionSchema),
  }),
  v.variant("type", [
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
  ]),
]);

export type Project = v.InferInput<typeof ProjectSchema>;
