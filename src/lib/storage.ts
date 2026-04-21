import { supabase } from './supabase';

/**
 * Supabase Storage Utility
 * Handles file uploads to predefined buckets.
 */

type BucketName = 'brand-assets' | 'product-media' | 'verification-docs' | 'brand-logos' | 'product-images' | 'product-videos';

/**
 * Compresses an image file before upload.
 */
async function compressImage(file: File, maxWidth: number = 1600): Promise<File> {
  // 🚀 Optimization: Skip compression if the file is NOT an image or is already small
  if (!file.type.startsWith('image/') || file.size < 800 * 1024) {
    return file;
  }
  
  return new Promise((resolve) => {
    // 💡 Performance Fix: Use URL.createObjectURL instead of FileReader for speed
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;
      
      // Use provided maxWidth (e.g. 800 for docs, 2000 for logos)
      if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      } else if (height > maxWidth) {
        width *= maxWidth / height;
        height = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        // Clean up memory
        URL.revokeObjectURL(imgUrl);
        
        if (blob) {
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        } else {
          resolve(file);
        }
      }, 'image/jpeg', 0.82);
    };

    img.onerror = () => {
      URL.revokeObjectURL(imgUrl);
      resolve(file);
    };
  });
}

export async function uploadFile(
  file: File, 
  bucket: BucketName, 
  path: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string | null; error: string | null }> {
  try {
    // 💡 CONDITIONAL COMPRESSION:
    // 1. Detect if it's an image. If not (PDF, Doc), skip optimization entirely for 0ms delay.
    const isImage = file.type.startsWith('image/');
    const isLogo = bucket === 'brand-logos' || bucket === 'product-images';
    
    let fileToUpload = file;
    if (isImage) {
      if (onProgress) onProgress(5); // Show tiny progress for optimization phase
      fileToUpload = await compressImage(file, isLogo ? 2000 : 800);
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        // 💡 PROGRESS FIX: Cast to 'any' to bypass missing type in some SDK versions
        onUploadProgress: (progress: any) => {
          if (onProgress) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            // Ensure optimization phase is accounted for
            const truePercent = isImage ? 10 + (percent * 0.9) : percent;
            onProgress(Math.min(99, Math.round(truePercent)));
          }
        }
      } as any);

    if (uploadError) {
      throw uploadError;
    }

    if (onProgress) onProgress(100);

    // Get Public URL
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
