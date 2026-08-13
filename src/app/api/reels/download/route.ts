import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

export async function GET(req: NextRequest) {
  const tmpDir = os.tmpdir();
  const requestId = Math.random().toString(36).substring(2, 9);
  const localOriginalPath = path.join(tmpDir, `orig_${requestId}.mp4`);
  const localOutroPath = path.join(tmpDir, `outro_${requestId}.mp4`);
  const localNormOrigPath = path.join(tmpDir, `norm_orig_${requestId}.ts`);
  const localNormOutroPath = path.join(tmpDir, `norm_outro_${requestId}.ts`);
  const localOutputPath = path.join(tmpDir, `final_${requestId}.mp4`);
  const listFilePath = path.join(tmpDir, `list_${requestId}.txt`);

  try {
    const { searchParams } = new URL(req.url);
    const reelId = searchParams.get('id');

    if (!reelId) {
      return NextResponse.json({ error: 'REEL_ID_MISSING' }, { status: 400 });
    }

    // Fetch reel from authoritative table
    const { data: reel, error: reelError } = await supabaseAdmin
      .from('reels')
      .select('id, video_url, title, status')
      .eq('id', reelId)
      .single();

    if (reelError || !reel || reel.status === 'deleted') {
      console.error('[DOWNLOAD] Reel not found:', reelId, reelError);
      return NextResponse.json({ error: 'REEL_NOT_FOUND' }, { status: 404 });
    }

    // 1. Download original reel video
    console.log('[DOWNLOAD] Fetching original video:', reel.video_url);
    const origRes = await fetch(reel.video_url);
    if (!origRes.ok) {
      console.error('[DOWNLOAD] Failed to fetch original video:', origRes.status);
      return NextResponse.json({ error: 'ORIGINAL_VIDEO_FETCH_FAILED' }, { status: 502 });
    }
    const origBuffer = Buffer.from(await origRes.arrayBuffer());
    fs.writeFileSync(localOriginalPath, origBuffer);

    // 2. Retrieve Branded Outro from Supabase Storage
    // The authoritative path is brand-reels/master/mastercart-reel-outro.mp4
    const outroPath = 'master/mastercart-reel-outro.mp4';
    console.log('[DOWNLOAD] Fetching branded outro from storage:', outroPath);
    
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('brand-reels')
      .getPublicUrl(outroPath);
      
    const outroRes = await fetch(publicUrlData.publicUrl);
    if (!outroRes.ok) {
      console.error('[DOWNLOAD] Branded outro asset unavailable at:', publicUrlData.publicUrl, 'Status:', outroRes.status);
      // Detailed error for internal logging, clean message for user
      return NextResponse.json({ 
        error: 'OUTRO_ASSET_UNAVAILABLE',
        message: 'Branded outro asset unavailable. Please contact support.' 
      }, { status: 500 });
    }
    
    const outroBuffer = Buffer.from(await outroRes.arrayBuffer());
    fs.writeFileSync(localOutroPath, outroBuffer);

    // 3. Normalize both videos using FFmpeg
    console.log('[DOWNLOAD] Normalizing videos with FFmpeg...');
    
    // Normalize original video
    try {
      await execAsync(`ffmpeg -i "${localOriginalPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -ar 44100 -ac 2 "${localNormOrigPath}" -y`);
    } catch (ffmpegErr) {
      console.error('[DOWNLOAD] FFmpeg normalization failed for original:', ffmpegErr);
      return NextResponse.json({ error: 'VIDEO_PROCESSING_FAILED' }, { status: 500 });
    }

    // Normalize outro video
    try {
      await execAsync(`ffmpeg -i "${localOutroPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -ar 44100 -ac 2 "${localNormOutroPath}" -y`);
    } catch (ffmpegErr) {
      console.error('[DOWNLOAD] FFmpeg normalization failed for outro:', ffmpegErr);
      return NextResponse.json({ error: 'OUTRO_PROCESSING_FAILED' }, { status: 500 });
    }

    // 4. Create concat list file
    fs.writeFileSync(listFilePath, `file '${localNormOrigPath}'\nfile '${localNormOutroPath}'\n`);

    // 5. Concatenate using ffmpeg concat demuxer
    console.log('[DOWNLOAD] Concatenating videos...');
    try {
      await execAsync(`ffmpeg -f concat -safe 0 -i "${listFilePath}" -c copy "${localOutputPath}" -y`);
    } catch (concatErr) {
      console.error('[DOWNLOAD] FFmpeg concatenation failed:', concatErr);
      return NextResponse.json({ error: 'VIDEO_CONCATENATION_FAILED' }, { status: 500 });
    }

    if (!fs.existsSync(localOutputPath)) {
      console.error('[DOWNLOAD] Final output file not found after concatenation');
      return NextResponse.json({ error: 'OUTPUT_GENERATION_FAILED' }, { status: 500 });
    }

    const finalVideoBuffer = fs.readFileSync(localOutputPath);
    const sanitizedTitle = (reel.title || 'Reel').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MasterCart_Reel_${sanitizedTitle}.mp4`;

    // Cleanup temp files
    cleanupFiles([localOriginalPath, localOutroPath, localNormOrigPath, localNormOutroPath, localOutputPath, listFilePath]);

    return new NextResponse(finalVideoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': finalVideoBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('[DOWNLOAD] Unexpected error:', err);
    cleanupFiles([localOriginalPath, localOutroPath, localNormOrigPath, localNormOutroPath, localOutputPath, listFilePath]);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

function cleanupFiles(files: string[]) {
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {
      console.error('[DOWNLOAD] Cleanup failed for:', file, err);
    }
  });
}
