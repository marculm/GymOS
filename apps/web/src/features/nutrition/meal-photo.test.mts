import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressMealPhoto, fitPhoto } from "./meal-photo.mts";

function photoFile() {
  return new File(["photo"], "meal.jpg", { type: "image/jpeg" });
}

describe("fitPhoto", () => {
  it("scales down the longest edge", () => {
    expect(fitPhoto(3000, 2000)).toEqual({ width: 1536, height: 1024 });
    expect(fitPhoto(1000, 2000)).toEqual({ width: 768, height: 1536 });
  });

  it("keeps smaller photos unchanged", () => {
    expect(fitPhoto(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("keeps a dimension of at least one pixel", () => {
    expect(fitPhoto(1, 100000)).toEqual({ width: 1, height: 1536 });
  });
});

describe("compressMealPhoto", () => {
  const drawImage = vi.fn();
  const toDataURL = vi.fn(() => "data:image/jpeg;base64,AAAA");
  let getContext: ReturnType<typeof vi.fn>;
  let decode: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let canvas: {
    width: number;
    height: number;
    getContext: typeof getContext;
    toDataURL: typeof toDataURL;
  };

  beforeEach(() => {
    drawImage.mockClear();
    toDataURL.mockClear();
    getContext = vi.fn(() => ({ drawImage }));
    decode = vi.fn().mockResolvedValue(undefined);
    createObjectURL = vi.fn(() => "blob:meal");
    revokeObjectURL = vi.fn();
    canvas = { width: 0, height: 0, getContext, toDataURL };

    vi.stubGlobal(
      "Image",
      class {
        naturalWidth = 3000;
        naturalHeight = 2000;
        src = "";
        decode = decode;
      }
    );
    vi.stubGlobal(
      "URL",
      class {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      }
    );
    vi.spyOn(document, "createElement").mockReturnValue(
      canvas as unknown as HTMLElement
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("re-encodes the photo as a scaled JPEG", async () => {
    await expect(compressMealPhoto(photoFile())).resolves.toBe(
      "data:image/jpeg;base64,AAAA"
    );

    expect(canvas.width).toBe(1536);
    expect(canvas.height).toBe(1024);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1536,
      1024
    );
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.8);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:meal");
  });

  it("fails when the image cannot be decoded", async () => {
    decode.mockRejectedValueOnce(new Error("decode failed"));

    await expect(compressMealPhoto(photoFile())).rejects.toThrow("decode failed");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:meal");
  });

  it("fails when the canvas context is unavailable", async () => {
    getContext.mockReturnValueOnce(null);

    await expect(compressMealPhoto(photoFile())).rejects.toThrow(
      "Canvas is unavailable."
    );
  });
});
