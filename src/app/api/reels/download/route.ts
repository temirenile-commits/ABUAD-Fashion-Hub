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
      return NextResponse.json({ error: 'Reel ID is required' }, { status: 400 });
    }

    // Fetch reel from authoritative table
    const { data: reel, error: reelError } = await supabaseAdmin
      .from('reels')
      .select('id, video_url, title, status')
      .eq('id', reelId)
      .single();

    if (reelError || !reel || reel.status === 'deleted') {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    // 1. Download original reel video
    const origRes = await fetch(reel.video_url);
    if (!origRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch original video' }, { status: 502 });
    }
    const origBuffer = Buffer.from(await origRes.arrayBuffer());
    fs.writeFileSync(localOriginalPath, origBuffer);

    // 2. Upload/ensure outro asset in storage or use local fallback
    // For reliability, we upload the provided master outro to brand-reels/master/outro.mp4 if not present,
    // or we can read it from the local upload path if available.
    const localUploadedOutro = '/home/ubuntu/upload/20260814_000930.mp4';
    let outroBuffer: Buffer;
    if (fs.existsSync(localUploadedOutro)) {
      outroBuffer = fs.readFileSync(localUploadedOutro);
    } else {
      // Fallback: try fetching from Supabase storage
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('brand-reels')
        .getPublicUrl('master/outro.mp4');
      const outroRes = await fetch(publicUrlData.publicUrl);
      if (!outroRes.ok) {
        return NextResponse.json({ error: 'Branded outro asset unavailable' }, { status: 500 });
      }
      outroBuffer = Buffer.from(await outroRes.arrayBuffer());
    }
    fs.writeFileSync(localOutroPath, outroBuffer);

    // 3. Normalize both videos to uniform dimensions (1080x1920 vertical 9:16 with padding if needed), fps (30), sample rate (44100Hz), h264/aac
    // Scale and pad original video to fit 1080x1920 without distortion
    await execAsync(`ffmpeg -i "${localOriginalPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -ar 44100 -ac 2 "${localNormOrigPath}" -y`);

    // Normalize outro video similarly
    await execAsync(`ffmpeg -i "${localOutroPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -ar 44100 -ac 2 "${localNormOutroPath}" -y`);

    // 4. Create concat list file
    fs.writeFileSync(listFilePath, `file '${localNormOrigPath}'\nfile '${localNormOutroPath}'\n`);

    // 5. Concatenate using ffmpeg concat demuxer
    await execAsync(`ffmpeg -f concat -safe 0 -i "${listFilePath}" -c copy "${localOutputPath}" -y`);

    if (!fs.existsSync(localOutputPath)) {
      throw new Error('Failed to generate concatenated video');
    }

    const finalVideoBuffer = fs.readFileSync(localOutputPath);
    const sanitizedTitle = (reel.title || 'Reel').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MasterCart_Reel_${sanitizedTitle}.mp4`;

    // Cleanup temp files
    try {
      fs.unlinkSync(localOriginalPath);
      fs.unlinkSync(localOutroPath);
      fs.unlinkSync(localNormOrigPath);
      fs.unlinkSync(localNormOutroPath);
      fs.unlinkSync(localOutputPath);
      fs.unlinkSync(listFilePath);
    } catch {}

    return new NextResponse(finalVideoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': finalVideoBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Error generating reel download with outro:', err);
    // Cleanup on error
    try {
      if (fs.existsSync(localOriginalPath)) fs.unlinkSync(localOriginalPath);
      if (fs.existsSync(localOutroPath)) fs.unlinkSync(localOutroPath);
      if (fs.existsSync(localNormOrigPath)) fs.unlinkSync(localNormOrigPath);
      if (fs.existsSync(localNormOutroPath)) fs.unlinkSync(localNormOutroPath);
      if (fs.existsSync(localOutputPath)) fs.unlinkSync(localOutputPath);
      if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
    } catch {}

    return NextResponse.json({ error: 'Couldn\'t prepare this Reel for download. Please try again.' }, { status: 500 });
  }
}
