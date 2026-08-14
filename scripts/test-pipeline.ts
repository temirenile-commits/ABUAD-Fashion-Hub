import ffmpegStatic from 'ffmpeg-static';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

async function test() {
  const tmpDir = os.tmpdir();
  const requestId = 'test1234';
  const localOriginalPath = path.join(tmpDir, `orig_${requestId}.mp4`);
  const localOutroPath = path.join(tmpDir, `outro_${requestId}.mp4`);
  const localNormOrigPath = path.join(tmpDir, `norm_orig_${requestId}.ts`);
  const localNormOutroPath = path.join(tmpDir, `norm_outro_${requestId}.ts`);
  const localOutputPath = path.join(tmpDir, `final_${requestId}.mp4`);
  const listFilePath = path.join(tmpDir, `list_${requestId}.txt`);

  console.log('1. Downloading original...');
  const res = await fetch('https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-cw6amw3g.mp4');
  fs.writeFileSync(localOriginalPath, Buffer.from(await res.arrayBuffer()));

  console.log('2. Downloading outro (local or fallback)...');
  // Copy local outro for test
  fs.copyFileSync('/home/ubuntu/upload/20260814_000930.mp4', localOutroPath);

  console.log('3. Normalizing original...');
  await execAsync(`"${ffmpegStatic}" -i "${localOriginalPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v];[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a_orig];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a_null];[a_orig][a_null]amix=inputs=2:duration=first[a]" -map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k "${localNormOrigPath}" -y`);

  console.log('4. Normalizing outro...');
  await execAsync(`"${ffmpegStatic}" -i "${localOutroPath}" -f lavfi -i anullsrc=r=44100:cl=stereo -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p[v];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a]" -map "[v]" -map "[a]" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k -shortest "${localNormOutroPath}" -y`);

  console.log('5. Creating list...');
  fs.writeFileSync(listFilePath, `file '${localNormOrigPath}'\nfile '${localNormOutroPath}'\n`);

  console.log('6. Concatenating...');
  await execAsync(`"${ffmpegStatic}" -f concat -safe 0 -i "${listFilePath}" -c copy "${localOutputPath}" -y`);

  console.log('SUCCESS! Output size:', fs.statSync(localOutputPath).size);
}

test().catch(console.error);
