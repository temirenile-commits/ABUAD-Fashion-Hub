import { exec } from 'child_process';
import util from 'util';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';

const execAsync = util.promisify(exec);

async function test() {
  const videoUrl = 'https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-cw6amw3g.mp4';
  console.log('Downloading video...');
  const res = await fetch(videoUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync('/tmp/test_orig.mp4', buffer);

  console.log('Running normalization...');
  const start = Date.now();
  const cmd = `"${ffmpegStatic}" -i "/tmp/test_orig.mp4" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a_orig];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a_null];[a_orig][a_null]amix=inputs=2:duration=first[a]" -map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k "/tmp/test_norm.ts" -y`;
  
  try {
    const { stdout, stderr } = await execAsync(cmd);
    console.log('Normalization took:', (Date.now() - start) / 1000, 'seconds');
  } catch (err: any) {
    console.error('Error:', err.message);
    console.error('stderr:', err.stderr);
  }
}

test().catch(console.error);
