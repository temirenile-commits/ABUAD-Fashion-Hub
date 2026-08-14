import ffmpegStatic from 'ffmpeg-static';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

async function test() {
  const tmpDir = os.tmpdir();
  const requestId = 'test9999';
  const localOriginalPath = path.join(tmpDir, `orig_${requestId}.mp4`);
  const localOutroPath = path.join(tmpDir, `outro_${requestId}.mp4`);
  const localOutputPath = path.join(tmpDir, `final_${requestId}.mp4`);

  console.log('1. Downloading original...');
  const res = await fetch('https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-cw6amw3g.mp4');
  fs.writeFileSync(localOriginalPath, Buffer.from(await res.arrayBuffer()));

  console.log('2. Copying outro...');
  fs.copyFileSync('/home/ubuntu/upload/20260814_000930.mp4', localOutroPath);

  console.log('3. Running corrected filter_complex concat...');
  // Input 0: original video (has video + audio)
  // Input 1: outro video (has video only)
  // Input 2: anullsrc (silent audio)
  // We trim or use anullsrc matched to outro duration. Actually, we can use apad or generate silence with same duration as outro, or use tpad/anullsrc with `-shortest`.
  // Even simpler: use anullsrc looped or trimmed, or just use -sseof / aevalsrc.
  // Actually, FFmpeg has an easier way: generate silent audio on the fly or use `anullsrc`.
  
  const cmd = `"${ffmpegStatic}" -i "${localOriginalPath}" -i "${localOutroPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v0];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];[1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v1];[2:a]atrim=duration=5.208[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k "${localOutputPath}" -y`;

  const start = Date.now();
  await execAsync(cmd);
  console.log('SUCCESS! Concat took:', (Date.now() - start) / 1000, 'seconds. Size:', fs.statSync(localOutputPath).size);
}

test().catch(console.error);
