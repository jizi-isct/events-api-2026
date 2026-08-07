import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import { LANDSCAPE_PNG, SQUARE_PNG } from "../../test/icon_fixtures";
import {
  IconValidator,
  InvalidIconAspectRatioError,
  UnsupportedIconFormatError,
} from "./icon_validator";

const validator = new IconValidator(env.IMAGES);

describe("validate", () => {
  test("正方形の対応画像を受け付ける", async () => {
    const icon = new Blob([SQUARE_PNG], { type: "image/png" });

    const validated = await validator.validate(icon);

    expect(new Uint8Array(await validated.arrayBuffer())).toEqual(SQUARE_PNG);
    expect(validated.type).toBe("image/png");
  });

  test("申告された Content-Type ではなく実際の形式へ正規化する", async () => {
    const icon = new Blob([SQUARE_PNG], { type: "image/jpeg" });

    const validated = await validator.validate(icon);

    expect(validated.type).toBe("image/png");
  });

  test("縦横比が 1:1 でない画像を拒否する", async () => {
    const icon = new Blob([LANDSCAPE_PNG], { type: "image/png" });

    await expect(validator.validate(icon)).rejects.toEqual(
      new InvalidIconAspectRatioError(2, 1),
    );
  });

  test("寸法を検証できない SVG を拒否する", async () => {
    const icon = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>'],
      { type: "image/svg+xml" },
    );

    await expect(validator.validate(icon)).rejects.toEqual(
      new UnsupportedIconFormatError("image/svg+xml"),
    );
  });

  test("画像でないデータを拒否する", async () => {
    const icon = new Blob(["not an image"], { type: "image/png" });

    await expect(validator.validate(icon)).rejects.toBeInstanceOf(
      UnsupportedIconFormatError,
    );
  });

  test("画像入力以外を原因とする Images のエラーはそのまま送出する", async () => {
    const imagesError = Object.assign(new Error("Images is unavailable"), {
      code: 9432,
    });
    const failingValidator = new IconValidator({
      info: () => Promise.reject(imagesError),
    });

    await expect(
      failingValidator.validate(new Blob([SQUARE_PNG])),
    ).rejects.toBe(imagesError);
  });
});
