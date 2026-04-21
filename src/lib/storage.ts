import { supabase } from './supabase';

/**
 * Supabase Storage Utility
 * Handles file uploads to predefined buckets.
 */

type BucketName = 'brand-assets' | 'product-media' | 'verification-docs' | 'brand-logos' | 'product-images' | 'product-videos';

/**
 * Compresses an image file before upload.
 */
async function compressImage(file: File): Promise<File> {
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
        
        // Calculate new dimensions (max 1200px width/height)
        const MAX_SIZE = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Try WebP first, fallback to JPEG for older browsers
        const format = 'image/webp';
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            // Fallback to JPEG if WebP isn't supported or fails
            canvas.toBlob((bgBlob) => {
              if (bgBlob) {
                const jpegFile = new File([bgBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(jpegFile);
              } else {
                resolve(file);
              }
            }, 'image/jpeg', 0.8);
          }
        }, format, 0.8);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export async function uploadFile(
  file: File, 
  bucket: BucketName, 
  path: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // 💡 COMPRESS THE FILE BEFORE UPLOAD!
    const compressedFile = await compressImage(file);
    
    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from(bucket)
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

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
