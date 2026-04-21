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
  // 🚀 FAST-TRACK: Skip compression if the file is NOT an image or is already "fast enough" (< 1.5MB)
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) {
    return file;
  }
  
  return new Promise((resolve) => {
    // 💡 Performance: Use URL.createObjectURL instead of FileReader
    const imgUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;
      
      // HD Scaling (1280px is often faster and sharper for documents)
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
        URL.revokeObjectURL(imgUrl);
        
        if (blob) {
          // 💡 Network Optimization: 0.70 quality provides a massive speed boost on 4G/Slow connections
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        } else {
          resolve(file);
        }
      }, 'image/jpeg', 0.70);
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
    const isImage = file.type.startsWith('image/');
    const isLogo = bucket === 'brand-logos' || bucket === 'product-images';
    
    let fileToUpload = file;
    if (isImage) {
      if (onProgress) onProgress(2); // Start bar immediately
      // Documents Optimized at 1280px (HD), Logos at 2000px
      fileToUpload = await compressImage(file, isLogo ? 2000 : 1280);
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${path}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileToUpload.type, // 💡 Speed tip: Always set content type explicitly
        onUploadProgress: (progress: any) => {
          if (onProgress) {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            const truePercent = isImage ? 5 + (percent * 0.95) : percent;
            onProgress(Math.min(99, Math.round(truePercent)));
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
