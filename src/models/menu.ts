import * as v from "valibot";

const PriceSchema = v.pipe(v.number(), v.minValue(0));

export const MenuOptionSchema = v.object({
  name: v.string(),
  price: v.optional(PriceSchema),
});

export type MenuOption = v.InferInput<typeof MenuOptionSchema>;

export const MenuItemSchema = v.object({
  name: v.string(),
  price: v.optional(PriceSchema),
  options: v.array(MenuOptionSchema),
});

export type MenuItem = v.InferInput<typeof MenuItemSchema>;

export const MenuSchema = v.object({
  items: v.array(MenuItemSchema),
  description: v.string(),
});

export type Menu = v.InferInput<typeof MenuSchema>;
