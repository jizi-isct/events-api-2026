import * as v from "valibot";
import { PlaceIdSchema } from "./place";
import { TimeRangeSchema } from "./time";

/**
 * 時と場所を表す。
 * {@link PlaceIdSchema} と {@link TimeRangeSchema} を結びつけて表現する．
 */
export const OccasionSchema = v.object({
  place: PlaceIdSchema,
  timeRange: TimeRangeSchema,
});

export type Occasion = v.InferInput<typeof OccasionSchema>;
