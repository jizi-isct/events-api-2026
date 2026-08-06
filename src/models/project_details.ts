import * as v from "valibot";
import { MenuSchema } from "./menu";

export const ProjectDetailsSchema = v.object({
  additionalInfo: v.optional(v.string()),
  menu: v.optional(MenuSchema),
});

export type ProjectDetails = v.InferInput<typeof ProjectDetailsSchema>;
