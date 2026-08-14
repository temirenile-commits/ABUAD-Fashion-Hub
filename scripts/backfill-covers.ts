import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

const supabaseUrl = 'https://prbukzquzqayzodhxdgf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYnVrenF1enFheXpvZGh4ZGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODYwMDEsImV4cCI6MjA5MTk2MjAwMX0.m67ae7ZyJtqFbx04X2q-zY9aW4BVjDZkNznbRduZfTw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfill() {
  console.log('Fetching all reels...');
  const { data: reels, error } = await supabase
    .from('reels')
    .select('id, brand_id, video_url, thumbnail_url');

  if (error) {
    console.error('Error fetching reels:', error);
    return;
  }

  console.log(`Found ${reels?.length || 0} total reels.`);

  for (const reel of reels || []) {
    console.log(`Processing reel ${reel.id} (${reel.video_url})...`);
    const tmpDir = os.tmpdir();
    const tmpCoverPath = path.join(tmpDir, `cover_${reel.id}.webp`);

    try {
      try {
        await execAsync(`ffmpeg -ss 00:00:01 -i "${reel.video_url}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
      } catch {
        await execAsync(`ffmpeg -ss 00:00:00 -i "${reel.video_url}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
      }

      if (!fs.existsSync(tmpCoverPath)) {
        console.error(`Failed to extract frame for reel ${reel.id}`);
        continue;
      }

      const coverBuffer = fs.readFileSync(tmpCoverPath);
      const storagePath = `covers/${reel.brand_id}/${reel.id}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('brand-reels')
        .upload(storagePath, coverBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

      try { fs.unlinkSync(tmpCoverPath); } catch {}

      if (uploadError) {
        console.error(`Failed to upload cover for reel ${reel.id}:`, uploadError);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from('brand-reels')
        .getPublicUrl(storagePath);

      const coverUrl = publicUrlData.publicUrl;

      await supabase
        .from('reels')
        .update({ thumbnail_url: coverUrl })
        .eq('id', reel.id);

      console.log(`Successfully backfilled cover for reel ${reel.id}: ${coverUrl}`);
    } catch (err) {
      console.error(`Error processing reel ${reel.id}:`, err);
      try { fs.unlinkSync(tmpCoverPath); } catch {}
    }
  }

  console.log('Backfill complete!');
}

backfill();
