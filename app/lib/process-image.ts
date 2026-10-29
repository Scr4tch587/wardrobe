export async function processImage(file: File): Promise<{
  small: Blob;
  large: Blob;
  ext: "webp" | "jpg";
  w: number;
  h: number;
}> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const large = draw(bitmap, Math.min(1600, long));
    const small = draw(bitmap, Math.min(480, long));
    const largeWebp = await encode(large.canvas, "image/webp", 0.82);
    const useJpeg = largeWebp.type !== "image/webp";
    const ext = useJpeg ? "jpg" : "webp";
    const type = useJpeg ? "image/jpeg" : "image/webp";
    const quality = useJpeg ? 0.85 : 0.82;
    return {
      large: useJpeg ? await encode(large.canvas, type, quality) : largeWebp,
      small: await encode(small.canvas, type, quality),
      ext,
      w: large.w,
      h: large.h,
    };
  } finally {
    bitmap.close();
  }
}

function draw(bitmap: ImageBitmap, edge: number): { canvas: HTMLCanvasElement; w: number; h: number } {
  const scale = edge / Math.max(bitmap.width, bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, 0, 0, w, h);
  return { canvas, w, h };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo"))),
      type,
      quality,
    );
  });
}
