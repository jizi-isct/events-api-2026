/** 実データが Cloudflare Images で扱えない画像形式であることを表す。 */
export class UnsupportedIconFormatError extends Error {
  constructor(
    readonly format: string | null,
    options?: ErrorOptions,
  ) {
    super(
      format === null
        ? "Unsupported icon format"
        : `Unsupported icon format: ${format}`,
      options,
    );
    this.name = "UnsupportedIconFormatError";
  }
}

/** アイコンの縦横比が 1:1 でないことを表す。 */
export class InvalidIconAspectRatioError extends Error {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    super(`Icon must be square: ${width}x${height}`);
    this.name = "InvalidIconAspectRatioError";
  }
}

const UNSUPPORTED_IMAGE_ERROR_CODES = new Set([
  9412, // 入力が画像ではない
  9520, // 画像形式が非対応
  9523, // 壊れた画像などをデコードできない
]);

const imagesErrorCode = (error: unknown): number | null => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "number"
  ) {
    return null;
  }

  return error.code;
};

/**
 * Cloudflare Images と同じデコーダーで企画アイコンを検証する。
 * Content-Type ヘッダーではなく実データから形式と寸法を判定し、保存用 Blob の
 * type も検出した形式へ正規化する。
 */
export class IconValidator {
  constructor(private readonly images: Pick<ImagesBinding, "info">) {}

  async validate(icon: Blob): Promise<Blob> {
    let info: ImageInfoResponse;

    try {
      info = await this.images.info(icon.stream());
    } catch (error) {
      const code = imagesErrorCode(error);

      if (code !== null && UNSUPPORTED_IMAGE_ERROR_CODES.has(code)) {
        throw new UnsupportedIconFormatError(null, { cause: error });
      }

      throw error;
    }

    // Images は SVG の寸法を返さず、リサイズも行わない。1:1 を保証できない
    // 形式はアイコンとして受け付けない。
    if (!("width" in info)) {
      throw new UnsupportedIconFormatError(info.format);
    }

    if (info.width !== info.height) {
      throw new InvalidIconAspectRatioError(info.width, info.height);
    }

    return new Blob([icon], { type: info.format });
  }
}
