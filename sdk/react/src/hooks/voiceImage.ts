/**
 * Image preparation for `useVoice().sendImage()`. Gemini Live takes a still
 * image as one video frame (JPEG or PNG); a phone photo is several MB, so
 * the image is shrunk and re-encoded as JPEG in the browser before it goes
 * over the call's WebSocket — faster to send and far cheaper in tokens.
 */

export const VOICE_IMAGE_LIMITS = Object.freeze({
  mimeTypes: Object.freeze(["image/jpeg", "image/png"] as const),
  maxImageBytes: 5 * 1024 * 1024,
  /** Server accepts at most one image per second. */
  minIntervalMs: 1000,
  maxImagesPerCall: 20,
  /** Longest side after shrinking. */
  maxDimension: 1024,
  jpegQuality: 0.85,
});

export type VoiceImageMimeType = (typeof VOICE_IMAGE_LIMITS.mimeTypes)[number];

export class VoiceImageInputError extends Error {
  code = "UNSUPPORTED_IMAGE" as const;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(width: number, height: number): AnyCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

async function canvasToJpeg(canvas: AnyCanvas): Promise<Blob | null> {
  const { jpegQuality } = VOICE_IMAGE_LIMITS;
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality: jpegQuality });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));
}

/**
 * Shrinks to {@link VOICE_IMAGE_LIMITS.maxDimension} and re-encodes as JPEG
 * (transparent areas become white). Falls back to the original bytes when
 * the browser can't decode/encode it and it's already JPEG or PNG.
 */
export async function prepareVoiceImage(
  image: Blob,
): Promise<{ blob: Blob; mimeType: VoiceImageMimeType }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(image);
      const scale = Math.min(
        1,
        VOICE_IMAGE_LIMITS.maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = makeCanvas(width, height);
      const ctx = canvas?.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null
        | undefined;
      if (canvas && ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        const jpeg = await canvasToJpeg(canvas);
        if (jpeg && jpeg.size > 0) return { blob: jpeg, mimeType: "image/jpeg" };
      } else {
        bitmap.close?.();
      }
    } catch {
      // fall through to the as-is path
    }
  }
  const type = image.type as VoiceImageMimeType;
  if (VOICE_IMAGE_LIMITS.mimeTypes.includes(type)) return { blob: image, mimeType: type };
  throw new VoiceImageInputError(
    "This image can't be sent in a voice call. Use a JPEG or PNG image.",
  );
}

/** Base64 of a Blob, encoded in chunks so large images don't overflow the call stack. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
