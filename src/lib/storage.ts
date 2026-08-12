import { supabase } from './supabase';

/**
 * MasterCart Image Upload & Optimization Pipeline
 *
 * Key behaviours:
 *  1. All images converted to WebP at 85% quality before upload.
 *  2. Thumbnails (≤600px, 80% quality) generated in-browser and uploaded
 *     alongside the full-res version as `<name>_thumb.webp`.
 *  3. Files >5 MB are automatically resized to max 1280px.
 *  4. Files <100 KB are fast-tracked (still converted to WebP, skips resize).
 *  5. Non-image files (videos, documents) bypass compression completely.
 *  6. Fallback: if canvas fails the original file is uploaded unmodified.
 */

type BucketName =
  | 'brand-assets'
  | 'product-media'
  | 'verification-docs'
  | 'brand-logos'
  | 'product-images'
  | 'product-videos'
  | 'brand-reels'
  | 'delicacies-media'
  | 'delicacies-videos'
  | 'payout_proofs'
  | 'products';

// ── Configuration ────────────────────────────────────────────────────────────
const MAX_DIMENSION   = 1280;   // Full-res max width/height (px)
const THUMB_DIMENSION = 600;    // Thumbnail max width/height (px)
const FULL_QUALITY    = 0.85;   // WebP quality for full-res (0–1)
const THUMB_QUALITY   = 0.80;   // WebP quality for thumbnails (0–1)
const TINY_THRESHOLD  = 100 * 1024;  // <100 KB → skip resize, still WebP
const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5 MB hard upload limit
const OPT_TIMEOUT     = 10_000; // Canvas timeout safety (ms)

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOptimizableImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type);
}

/**
 * Resizes an HTMLImageElement onto a canvas respecting `maxDim`.
 * Returns a Blob in WebP format at the given quality.
 */
function canvasToWebPBlob(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height / width) * maxDim);
        width  = maxDim;
      } else {
        width  = Math.round((width / height) * maxDim);
        height = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

/**
 * Loads a File into an HTMLImageElement and resolves with both
 * a full-res WebP Blob and a thumbnail WebP Blob.
 * Falls back to `null` blobs on any error so uploads still succeed.
 */
async function optimizeImage(file: File): Promise<{
  full: File;
  thumb: File | null;
}> {
  if (!isOptimizableImage(file)) {
    return { full: file, thumb: null };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    const timeout = setTimeout(() => {
      cleanup();
      console.warn('[MasterCart] Image optimization timed out – uploading original.');
      resolve({ full: file, thumb: null });
    }, OPT_TIMEOUT);

    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ full: file, thumb: null });
    };

    img.onload = async () => {
      clearTimeout(timeout);
      cleanup();

      try {
        const isTiny = file.size < TINY_THRESHOLD;

        // Full-res: only resize if big, but always convert to WebP
        const fullMaxDim = isTiny ? Math.max(img.width, img.height) : MAX_DIMENSION;
        const fullBlob   = await canvasToWebPBlob(img, fullMaxDim, FULL_QUALITY);

        // Thumbnail: always generate
        const thumbBlob = await canvasToWebPBlob(img, THUMB_DIMENSION, THUMB_QUALITY);

        const baseName = file.name.replace(/\.[^.]+$/, '');

        const fullFile  = fullBlob
          ? new File([fullBlob],  `${baseName}.webp`,        { type: 'image/webp' })
          : file;

        const thumbFile = thumbBlob
          ? new File([thumbBlob], `${baseName}_thumb.webp`,  { type: 'image/webp' })
          : null;

        resolve({ full: fullFile, thumb: thumbFile });
      } catch (err) {
        console.error('[MasterCart] Canvas error:', err);
        resolve({ full: file, thumb: null });
      }
    };

    img.src = objectUrl;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface UploadResult {
  url:      string | null;
  thumbUrl: string | null;
  error:    string | null;
}

/**
 * Uploads an image (or any file) to Supabase Storage with:
 *  - Automatic WebP conversion & compression
 *  - Automatic thumbnail generation
 *  - Progress callback support
 *
 * @param file        The file to upload (raw from <input>)
 * @param bucket      Target Supabase storage bucket
 * @param pathPrefix  Path prefix / folder inside the bucket
 * @param onProgress  Optional callback receiving 0-100 progress
 */
export async function uploadFile(
  file: File,
  bucket: BucketName,
  pathPrefix: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    if (onProgress) onProgress(2);

    // The live `brand-assets` bucket has a 5 MB limit. Validate only that
    // bucket here so video/document workflows in other buckets retain their
    // existing behaviour.
    if (bucket === 'brand-assets' && file.size > MAX_FILE_SIZE) {
      throw new Error('Brand assets must be 5 MB or smaller.');
    }

    if (bucket === 'brand-assets' && !file.type.startsWith('image/')) {
      throw new Error('Brand assets must be image files.');
    }

    // ── Optimize ──────────────────────────────────────────────────────────
    const { full: optimizedFull, thumb: optimizedThumb } = isOptimizableImage(file)
      ? await optimizeImage(file)
      : { full: file, thumb: null };

    const uid        = Math.random().toString(36).substring(2, 10);
    const baseName   = optimizedFull.name.replace(/\.[^.]+$/, '');
    const ext        = optimizedFull.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'bin');
    const fullPath   = `${pathPrefix}-${uid}.${ext}`;
    const thumbPath  = `${pathPrefix}-${uid}_thumb.webp`;

    if (onProgress) onProgress(10);

    // ── Upload full-res ───────────────────────────────────────────────────
    const { error: fullError } = await supabase.storage
      .from(bucket)
      .upload(fullPath, optimizedFull, {
        cacheControl: '31536000', // 1 year cache
        upsert: false,
        contentType: optimizedFull.type,
      } as any);

    if (fullError) throw fullError;

    if (onProgress) onProgress(60);

    // Upload the thumbnail before returning its URL. The previous
    // fire-and-forget upload caused transient 400s when the image optimizer
    // requested `_thumb.webp` before Storage had created the object.
    let thumbPublicUrl: string | null = null;
    if (optimizedThumb) {
      const { error: thumbError } = await supabase.storage
        .from(bucket)
        .upload(thumbPath, optimizedThumb, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/webp',
        } as any);

      if (thumbError) {
        console.error('[MasterCart] Thumbnail upload failed:', {
          code: (thumbError as any).code,
          message: thumbError.message,
          details: (thumbError as any).details,
          hint: (thumbError as any).hint,
          bucket,
          path: thumbPath,
        });
      } else {
        thumbPublicUrl = supabase.storage.from(bucket).getPublicUrl(thumbPath).data.publicUrl;
      }
    }

    if (onProgress) onProgress(90);

    // ── Get public URL ────────────────────────────────────────────────────
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fullPath);

    if (onProgress) onProgress(100);

    return { url: publicUrl, thumbUrl: thumbPublicUrl, error: null };

  } catch (error: any) {
    console.error('[MasterCart] Upload error:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      bucket,
      pathPrefix,
    });
    const details = [error?.message, error?.details, error?.hint].filter(Boolean).join(' — ');
    return { url: null, thumbUrl: null, error: details || 'Upload failed' };
  }
}

/**
 * Deletes a file from Supabase Storage.
 * Also attempts to delete the companion thumbnail if present.
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<boolean> {
  const paths = [path];

  // If this is a full-res image, also remove its thumbnail
  const thumbPath = path.replace(/(\.[^.]+)$/, '_thumb.webp');
  if (thumbPath !== path) paths.push(thumbPath);

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) console.error('[MasterCart] Delete error:', error);
  return !error;
}

/**
 * Given a full-res Supabase image URL, returns the companion thumbnail URL.
 * Returns the original URL if no thumbnail convention can be applied.
 */
export function toThumbUrl(fullUrl: string): string {
  if (!fullUrl) return fullUrl;
  // Insert _thumb before the last extension
  return fullUrl.replace(/(\.[a-z0-9]+)(\?.*)?$/i, '_thumb.webp$2');
}
