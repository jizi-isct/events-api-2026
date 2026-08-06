import * as v from "valibot";

export const TimeSchema = v.pipe(
  v.object({
    // v.literal は JSON Schema の const になり OpenAPI Generator が解釈できないため
    // picklist を使う。
    date: v.picklist([1, 2]),
    hour: v.pipe(v.number(), v.minValue(0), v.maxValue(23)),
    minute: v.pipe(v.number(), v.minValue(0), v.maxValue(59)),
  }),
  v.metadata({ ref: "Time" }),
);

export type Time = v.InferInput<typeof TimeSchema>;

export const TimeRangeSchema = v.pipe(
  v.object({ start: TimeSchema, end: TimeSchema }),
  v.metadata({ ref: "TimeRange" }),
);

export type TimeRange = v.InferInput<typeof TimeRangeSchema>;
