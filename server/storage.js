const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Local uploads directory config
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

if (!supabase) {
  // Ensure folders exist locally
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
  if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
}

/**
 * Process uploaded image and return URLs
 * @param {Buffer} buffer - Raw file buffer
 * @param {string} filename - Unique file name base
 * @returns {Promise<{url: string, thumbnail: string}>}
 */
async function processAndStore(buffer, filename) {
  // Replace characters to form a clean filename
  const cleanFilename = `${filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}.jpg`;
  
  // 1. Process Main Photo (Max 1200px wide, jpeg compression)
  const mainPhotoBuffer = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
    
  // 2. Process Thumbnail (Max 400px wide, jpeg compression)
  const thumbnailBuffer = await sharp(buffer)
    .resize({ width: 400 })
    .jpeg({ quality: 75 })
    .toBuffer();

  if (supabase) {
    console.log('☁️ Uploading to Supabase Storage...');
    
    // Upload main photo
    const { data: mainData, error: mainError } = await supabase.storage
      .from('photos')
      .upload(`photos/${cleanFilename}`, mainPhotoBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });
      
    if (mainError) throw mainError;
    
    // Upload thumbnail
    const { data: thumbData, error: thumbError } = await supabase.storage
      .from('photos')
      .upload(`thumbnails/${cleanFilename}`, thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });
      
    if (thumbError) throw thumbError;
    
    // Get public URL
    const { data: mainPublicUrl } = supabase.storage
      .from('photos')
      .getPublicUrl(`photos/${cleanFilename}`);
      
    const { data: thumbPublicUrl } = supabase.storage
      .from('photos')
      .getPublicUrl(`thumbnails/${cleanFilename}`);

    return {
      url: mainPublicUrl.publicUrl,
      thumbnail: thumbPublicUrl.publicUrl
    };
  } else {
    console.log('📂 Saving to local storage...');
    
    const mainPath = path.join(photosDir, cleanFilename);
    const thumbPath = path.join(thumbnailsDir, cleanFilename);
    
    await fs.promises.writeFile(mainPath, mainPhotoBuffer);
    await fs.promises.writeFile(thumbPath, thumbnailBuffer);
    
    return {
      url: `/uploads/photos/${cleanFilename}`,
      thumbnail: `/uploads/thumbnails/${cleanFilename}`
    };
  }
}

module.exports = {
  processAndStore,
  uploadsDir
};
