import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const execAsync = util.promisify(exec);

const supabaseUrl = 'https://prbukzquzqayzodhxdgf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYnVrenF1enFheXpvZGh4ZGdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4NjAwMSwiZXhwIjoyMDkxOTYyMDAxfQ.service_role_placeholder'; // We will use direct storage upload via node fetch or admin client if possible

// Let's use fetch API with service role or update directly
async function run() {
  const reels = [
    {
      id: '93d8b63a-4232-476a-8f95-561584f3954c',
      brand_id: '6746054c-0b89-4e8d-9ba4-0b0327643741',
      video_url: 'https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-10im51zs.mp4'
    },
    {
      id: '5ed96e42-a672-40c2-b513-b833ae56752e',
      brand_id: '6746054c-0b89-4e8d-9ba4-0b0327643741',
      video_url: 'https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-s6c25b6c.mp4'
    },
    {
      id: '577c6b4c-328d-4b53-8898-a8d0fc9e6ebe',
      brand_id: '6746054c-0b89-4e8d-9ba4-0b0327643741',
      video_url: 'https://prbukzquzqayzodhxdgf.supabase.co/storage/v1/object/public/brand-reels/reel-6746054c-0b89-4e8d-9ba4-0b0327643741-cw6amw3g.mp4'
    }
  ];

  for (const reel of reels) {
    const tmpDir = os.tmpdir();
    const tmpCoverPath = path.join(tmpDir, `cover_${reel.id}.webp`);
    console.log(`Extracting cover for ${reel.id}...`);

    try {
      try {
        await execAsync(`ffmpeg -ss 00:00:01 -i "${reel.video_url}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
      } catch {
        await execAsync(`ffmpeg -ss 00:00:00 -i "${reel.video_url}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
      }

      if (!fs.existsSync(tmpCoverPath)) {
        console.error(`Failed to extract frame for ${reel.id}`);
        continue;
      }

      const coverBuffer = fs.readFileSync(tmpCoverPath);
      const storagePath = `covers/${reel.brand_id}/${reel.id}.webp`;

      // Upload via Supabase REST API / storage endpoint
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/brand-reels/${storagePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
          'Content-Type': 'image/webp',
          'x-upsert': 'true'
        },
        body: coverBuffer
      });

      console.log(`Upload status for ${reel.id}:`, uploadRes.status);
      const resText = await uploadRes.text();
      console.log(`Upload response:`, resText);

      try { fs.unlinkSync(tmpCoverPath); } catch {}

      const coverUrl = `${supabaseUrl}/storage/v1/object/public/brand-reels/${storagePath}`;
      console.log(`Generated Cover URL: ${coverUrl}`);

    } catch (err) {
      console.error(`Error for ${reel.id}:`, err);
      try { fs.unlinkSync(tmpCoverPath); } catch {}
    }
  }
}

run();
