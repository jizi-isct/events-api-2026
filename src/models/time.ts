import * as v from "valibot";

export const TimeSchema = v.object({
  date: v.union([v.literal(1), v.literal(2)]),
  hour: v.pipe(v.number(), v.minValue(0), v.maxValue(23)),
  minute: v.pipe(v.number(), v.minValue(0), v.maxValue(59)),
});

export type Time = v.InferInput<typeof TimeSchema>;

export const TimeRangeSchema = v.object({ start: TimeSchema, end: TimeSchema });

export type TimeRange = v.InferInput<typeof TimeRangeSchema>;
