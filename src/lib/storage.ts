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
  // 🚀 Optimization: Skip compression if the file is already small (< 500KB)
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) {
    return file;
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
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
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
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
    // Logos get high res (2000px), docs get optimized res (800px)
    const isLogo = bucket === 'brand-logos' || bucket === 'product-images';
    const compressedFile = await compressImage(file, isLogo ? 2000 : 800);
    
    if (onProgress) onProgress(30); // Starting upload...

    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    if (onProgress) onProgress(100); // Complete!

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
