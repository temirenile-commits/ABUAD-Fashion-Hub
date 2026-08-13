import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

async function generateAndUploadReelCover(videoUrl: string, brandId: string, reelId: string): Promise<string | null> {
  const tmpDir = os.tmpdir();
  const tmpCoverPath = path.join(tmpDir, `cover_${reelId}.webp`);

  try {
    try {
      await execAsync(`ffmpeg -ss 00:00:01 -i "${videoUrl}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
    } catch {
      await execAsync(`ffmpeg -ss 00:00:00 -i "${videoUrl}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
    }

    if (!fs.existsSync(tmpCoverPath)) {
      return null;
    }

    const coverBuffer = fs.readFileSync(tmpCoverPath);
    const storagePath = `covers/${brandId}/${reelId}.webp`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('brand-reels')
      .upload(storagePath, coverBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    try { fs.unlinkSync(tmpCoverPath); } catch {}

    if (uploadError) {
      console.error('Failed to upload backfill cover:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('brand-reels')
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error in backfill cover generation:', err);
    try { fs.unlinkSync(tmpCoverPath); } catch {}
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Fetch reels without cover_url or where cover_url is null
    const { data: reels, error } = await supabaseAdmin
      .from('reels')
      .select('id, brand_id, video_url, cover_url')
      .is('cover_url', null)
      .neq('status', 'deleted');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];
    for (const reel of reels || []) {
      const coverUrl = await generateAndUploadReelCover(reel.video_url, reel.brand_id, reel.id);
      if (coverUrl) {
        await supabaseAdmin
          .from('reels')
          .update({ cover_url: coverUrl })
          .eq('id', reel.id);
        results.push({ reel_id: reel.id, cover_url: coverUrl, status: 'success' });
      } else {
        results.push({ reel_id: reel.id, status: 'failed' });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err: any) {
    console.error('Backfill error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
