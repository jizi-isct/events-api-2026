#!/usr/bin/env bun
import { join } from "node:path";
import * as prettier from "prettier";
import { placeIds } from "../src/models/place";

export const RELATIVE_DTS_PATH = "src/models/place-id.generated.d.ts";
export const DTS_PATH = join(import.meta.dir, "..", RELATIVE_DTS_PATH);

export const generatePlaceIdDts = async (
  ids: readonly string[],
): Promise<string> => {
  if (ids.length === 0) {
    throw new Error(
      "placeIds is empty. Refusing to generate an invalid `export type PlaceId = ;`.",
    );
  }

  const union = ids.map((id) => JSON.stringify(id)).join(" | ");

  const source = `// このファイルは \`bun run generate:place-id\` によって自動生成されたものです。手動で編集しないでください。
// \`src/models/places.json\` を編集した上で、\`bun run generate:place-id\` を実行し、生成しなおしてください。

export type PlaceId = ${union};
`;

  const config = await prettier.resolveConfig(DTS_PATH);

  return prettier.format(source, {
    ...config,
    parser: "typescript",
  });
};

if (import.meta.main) {
  const content = await generatePlaceIdDts(placeIds);
  await Bun.write(DTS_PATH, content);
  console.log(
    `✓ Generated ${RELATIVE_DTS_PATH} (${placeIds.length} place IDs)`,
  );
}
