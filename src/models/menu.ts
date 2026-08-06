import * as v from "valibot";

export const MenuOptionSchema = v.object({
  name: v.string(),
  price: v.optional(v.pipe(v.number(), v.minValue(0)))
})

export const MenuItemSchema = v.object({})
