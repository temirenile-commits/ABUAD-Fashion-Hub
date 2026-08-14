import { exec } from 'child_process';
import util from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execAsync = util.promisify(exec);

async function test() {
  console.log('FFmpeg path:', ffmpegStatic);
  const cmd = `"${ffmpegStatic}" -version`;
  const { stdout } = await execAsync(cmd);
  console.log(stdout);
}

test().catch(console.error);
