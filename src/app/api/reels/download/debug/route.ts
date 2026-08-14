import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import fs from 'fs';

const execAsync = util.promisify(exec);

export async function GET(req: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      tmpdir: os.tmpdir(),
      freemem: os.freemem(),
      totalmem: os.totalmem(),
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
    },
    ffmpeg: {},
    tmpWriteTest: false,
  };

  // Check ffmpeg
  try {
    const { stdout, stderr } = await execAsync('ffmpeg -version');
    results.ffmpeg.status = 'available';
    results.ffmpeg.version = stdout.split('\n')[0];
  } catch (err: any) {
    results.ffmpeg.status = 'unavailable';
    results.ffmpeg.error = err.message;
    results.ffmpeg.stderr = err.stderr;
  }

  // Check ffprobe
  try {
    const { stdout } = await execAsync('ffprobe -version');
    results.ffprobe = { status: 'available', version: stdout.split('\n')[0] };
  } catch (err: any) {
    results.ffprobe = { status: 'unavailable', error: err.message };
  }

  // Check /tmp write
  try {
    const testFile = `${os.tmpdir()}/test_${Date.now()}.txt`;
    fs.writeFileSync(testFile, 'test');
    results.tmpWriteTest = fs.readFileSync(testFile, 'utf8') === 'test';
    fs.unlinkSync(testFile);
  } catch (err: any) {
    results.tmpWriteTestError = err.message;
  }

  return NextResponse.json(results);
}
