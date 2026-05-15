import { supabase } from './supabase';

/**
 * Supabase Storage Utility
 * Handles file uploads to predefined buckets.
 */

type BucketName = 'brand-assets' | 'product-media' | 'verification-docs' | 'brand-logos' | 'product-images' | 'product-videos' | 'brand-reels' | 'delicacies-media' | 'delicacies-videos';

const SKIP_THRESHOLD = 5 * 1024 * 1024; // 5MB fast-track
const TARGET_SIZE = 1280; // Standard HD
const OPTIMIZATION_TIMEOUT = 8000; // 8 seconds safety limit

/**
 * Robust image optimization with fallback
 */
async function optimizeImage(file: File): Promise<File> {
  const isBasicImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  
  // 1. Instant Bypass for non-images, heavy formats (HEIC), or small files
  if (!isBasicImage || file.size < SKIP_THRESHOLD) {
    return file;
  }

  return new Promise((resolve) => {
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();
    
    // Safety timeout: If resizing hangs, return original file instead of failing
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(imgUrl);
      console.warn('Image optimization timed out, using original.');
      resolve(file);
    }, OPTIMIZATION_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > TARGET_SIZE || height > TARGET_SIZE) {
        if (width > height) {
          height *= TARGET_SIZE / width;
          width = TARGET_SIZE;
        } else {
          width *= TARGET_SIZE / height;
          height = TARGET_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(imgUrl);
        resolve(file); // Fallback
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(imgUrl);
        if (!blob) {
          resolve(file);
          return;
        }
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.70);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(imgUrl);
      resolve(file); // Final fallback: if it can't be rendered, just upload raw
    };

    img.src = imgUrl;
  });
}

export async function uploadFile(
  file: File, 
  bucket: BucketName, 
  path: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string | null; error: string | null }> {
  try {
    if (onProgress) onProgress(2); // Start bar immediately
    
    // Heavy lifting: Optimize if needed, otherwise instant fast-track
    const fileToUpload = await optimizeImage(file);

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const isImage = file.type.startsWith('image/');

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type, // 💡 Speed tip: Always set content type explicitly
        onUploadProgress: (progress: any) => {
          if (onProgress) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            // Optimization takes a tiny fraction, so we start at 2% and go to 99%
            const scaledPercent = 2 + (percent * 0.97);
            onProgress(Math.min(99, Math.round(scaledPercent)));
          }
        }
      } as any);

    if (uploadError) {
      throw uploadError;
    }

    if (onProgress) onProgress(100);

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { url: publicUrl, error: null };

  } catch (error: any) {
    console.error('Upload error:', error);
    return { url: null, error: error.message || 'Failed to upload file' };
  }
}

/**
 * Deletes a file from Supabase Storage
 */
export async function deleteFile(bucket: BucketName, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('Delete error:', error);
  return !error;
}
