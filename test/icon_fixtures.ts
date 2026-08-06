const decodeBase64 = (encoded: string): Uint8Array =>
  Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));

/** 2x2 の PNG。 */
export const SQUARE_PNG = decodeBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8DwH4QZYAwAR8oH+Xm0fdIAAAAASUVORK5CYII=",
);

/** 2x1 の PNG。 */
export const LANDSCAPE_PNG = decodeBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNg+A+BAA/5A/2NJFz3AAAAAElFTkSuQmCC",
);
