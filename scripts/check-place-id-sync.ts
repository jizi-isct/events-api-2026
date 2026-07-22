#!/usr/bin/env bun
import { placeIds } from "../src/models/place";
import {
  DTS_PATH,
  generatePlaceIdDts,
  RELATIVE_DTS_PATH,
} from "./generate-place-id-type";

const expected = await generatePlaceIdDts(placeIds);

const file = Bun.file(DTS_PATH);
const actual = (await file.exists()) ? await file.text() : null;

if (actual === expected) {
  console.log(`✓ ${RELATIVE_DTS_PATH} is up to date.`);
  process.exit(0);
}

console.error(
  [
    `✗ ${RELATIVE_DTS_PATH} is out of sync with src/models/places.json.`,
    actual === null
      ? "  The file does not exist yet."
      : "  The committed file differs from what would be generated now.",
    "",
    "  This usually means src/models/places.json was edited without",
    "  regenerating the PlaceId type. Run the following command,",
    "  review the diff, and commit the result:",
    "",
    "    bun run generate:place-id",
    "",
  ].join("\n"),
);
process.exit(1);
