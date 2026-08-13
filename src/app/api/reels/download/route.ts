import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegStatic from 'ffmpeg-static';

const execAsync = util.promisify(exec);

// Resolve ffmpeg binary path safely
let ffmpegPath = 'ffmpeg';
if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
  ffmpegPath = ffmpegStatic;
}

export async function GET(req: NextRequest) {
  const tmpDir = os.tmpdir();
  const requestId = Math.random().toString(36).substring(2, 9);
  const localOriginalPath = path.join(tmpDir, `orig_${requestId}.mp4`);
  const localOutroPath = path.join(tmpDir, `outro_${requestId}.mp4`);
  const localOutputPath = path.join(tmpDir, `final_${requestId}.mp4`);

  const searchParams = new URL(req.url).searchParams;
  const reelId = searchParams.get('id');

  const logContext: any = {
    requestId,
    reelId,
    temporaryDirectory: tmpDir,
    ffmpegPath,
    steps: []
  };

  try {
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

    logContext.sourceVideo = reel.video_url;

    // 1. Download original reel video
    logContext.steps.push('fetching_original');
    const origRes = await fetch(reel.video_url);
    if (!origRes.ok) {
      console.error('[DOWNLOAD] Failed to fetch original video:', origRes.status);
      return NextResponse.json({ error: 'ORIGINAL_VIDEO_FETCH_FAILED' }, { status: 502 });
    }
    const origBuffer = Buffer.from(await origRes.arrayBuffer());
    fs.writeFileSync(localOriginalPath, origBuffer);

    // 2. Retrieve Branded Outro from Supabase Storage
    logContext.steps.push('fetching_outro');
    const outroPath = 'master/mastercart-reel-outro.mp4';
    logContext.outroAsset = outroPath;
    
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('brand-reels')
      .getPublicUrl(outroPath);
      
    const outroRes = await fetch(publicUrlData.publicUrl);
    if (!outroRes.ok) {
      console.error('[DOWNLOAD] Branded outro asset unavailable at:', publicUrlData.publicUrl, 'Status:', outroRes.status);
      return NextResponse.json({ 
        error: 'OUTRO_ASSET_UNAVAILABLE',
        message: 'Branded outro asset unavailable. Please contact support.' 
      }, { status: 500 });
    }
    
    const outroBuffer = Buffer.from(await outroRes.arrayBuffer());
    fs.writeFileSync(localOutroPath, outroBuffer);

    // 3. Process and Concatenate using single FFmpeg filter_complex command
    logContext.steps.push('processing_and_concatenating');
    
    // Get outro duration dynamically using ffprobe or assume 5.2 seconds
    let outroDuration = '5.208';
    try {
      // Simple ffprobe to get exact duration of outro
      const { stdout } = await execAsync(`"${ffmpegPath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localOutroPath}"`);
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) {
        outroDuration = parsed.toString();
      }
    } catch (e) {
      // fallback to default 5.208
    }

    const ffmpegCmd = `"${ffmpegPath}" -i "${localOriginalPath}" -i "${localOutroPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v0];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v1];[2:a]atrim=duration=${outroDuration}[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k "${localOutputPath}" -y`;

    logContext.ffmpegCommand = ffmpegCmd;

    try {
      await execAsync(ffmpegCmd);
    } catch (err: any) {
      console.error('[REEL DOWNLOAD ERROR]', {
        ...logContext,
        error: err.message,
        exitCode: err.code,
        stderr: err.stderr,
        stdout: err.stdout
      });
      return NextResponse.json({ error: 'VIDEO_PROCESSING_FAILED' }, { status: 500 });
    }

    if (!fs.existsSync(localOutputPath)) {
      console.error('[DOWNLOAD] Final output file not found after processing');
      return NextResponse.json({ error: 'OUTPUT_GENERATION_FAILED' }, { status: 500 });
    }

    const finalVideoBuffer = fs.readFileSync(localOutputPath);
    const sanitizedTitle = (reel.title || 'Reel').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MasterCart_Reel_${sanitizedTitle}.mp4`;

    // Cleanup temp files
    cleanupFiles([localOriginalPath, localOutroPath, localOutputPath]);

    return new NextResponse(finalVideoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': finalVideoBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('[REEL DOWNLOAD ERROR] Unexpected:', {
      ...logContext,
      error: err.message,
      stack: err.stack
    });
    cleanupFiles([localOriginalPath, localOutroPath, localOutputPath]);
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
