import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { MenuSchema } from "./menu";

describe("MenuSchema", () => {
  test("商品とオプションを検証する", () => {
    const menu = {
      items: [
        {
          name: "クレープ",
          price: 500,
          options: [
            { name: "アイス追加", price: 100 },
            { name: "ソースを選択" },
          ],
        },
      ],
      description: "当日の仕入れ状況により変更する場合があります。",
    };

    expect(v.parse(MenuSchema, menu)).toEqual(menu);
  });

  test("商品とオプションは価格を省略できる", () => {
    const menu = {
      items: [{ name: "時価商品", options: [{ name: "サイズを選択" }] }],
      description: "価格は店頭でご確認ください。",
    };

    expect(v.parse(MenuSchema, menu)).toEqual(menu);
  });

  test.each([
    [
      "商品",
      { items: [{ name: "商品", price: -1, options: [] }], description: "" },
    ],
    [
      "オプション",
      {
        items: [{ name: "商品", options: [{ name: "オプション", price: -1 }] }],
        description: "",
      },
    ],
  ])("%sの価格に負数を許可しない", (_name, menu) => {
    expect(() => v.parse(MenuSchema, menu)).toThrow();
  });
});
