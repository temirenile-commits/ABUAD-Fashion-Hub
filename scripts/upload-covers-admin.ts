import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@supabase/supabase-js';

const execAsync = util.promisify(exec);

// Let's create an explicit admin client using the anon key with a temporary RLS policy or service role if available, 
// or using the storage API which allows anon uploads if policy permits (we created an anon upload policy earlier).
const supabaseUrl = 'https://prbukzquzqayzodhxdgf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYnVrenF1enFheXpvZGh4ZGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODYwMDEsImV4cCI6MjA5MTk2MjAwMX0.m67ae7ZyJtqFbx04X2q-zY9aW4BVjDZkNznbRduZfTw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // First, let's create a temporary policy to allow anon uploads/updates on brand-reels storage & reels table if needed,
  // or we can use SQL execution via MCP tool. But wait, we can also execute SQL to update thumbnail_url.
  // Let's first generate and upload covers.
  
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

      const { data, error: uploadError } = await supabase.storage
        .from('brand-reels')
        .upload(storagePath, coverBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) {
        console.error(`Upload error for ${reel.id}:`, uploadError);
      } else {
        console.log(`Uploaded successfully:`, data);
      }

      try { fs.unlinkSync(tmpCoverPath); } catch {}

      const coverUrl = `${supabaseUrl}/storage/v1/object/public/brand-reels/${storagePath}`;
      console.log(`Cover URL: ${coverUrl}`);

      // Update database using SQL or supabase client
      const { error: dbError } = await supabase
        .from('reels')
        .update({ thumbnail_url: coverUrl })
        .eq('id', reel.id);

      if (dbError) {
        console.error(`DB Update error for ${reel.id}:`, dbError);
      } else {
        console.log(`DB Updated for ${reel.id}`);
      }

    } catch (err) {
      console.error(`Error for ${reel.id}:`, err);
      try { fs.unlinkSync(tmpCoverPath); } catch {}
    }
  }
}

run();
