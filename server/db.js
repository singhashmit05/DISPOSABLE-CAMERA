const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
let sqliteDb = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  console.log('⚡ Using Supabase for Database operations');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.log('💾 Using Local SQLite Database');
  // Ensure database directory exists
  const dbDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  sqliteDb = new Database(path.join(dbDir, 'flashback.db'));
  
  // Create tables if they do not exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS rolls (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      photo_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      thumbnail TEXT,
      author_name TEXT NOT NULL,
      session_id TEXT NOT NULL,
      roll_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      likes INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS photo_likes (
      photo_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      PRIMARY KEY (photo_id, session_id)
    );
  `);

  // Migration: add roll_id column if it doesn't exist (for existing databases)
  try {
    sqliteDb.exec(`ALTER TABLE photos ADD COLUMN roll_id TEXT DEFAULT NULL`);
  } catch (e) {
    // Column already exists — ignore
  }
}

// ──────────────────────────────────────────────
// ROLL OPERATIONS
// ──────────────────────────────────────────────

function generateSlug(name) {
  // Create a URL-friendly slug from the roll name + a short random suffix
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 30);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

async function createRoll({ id, name, description, created_by, session_id }) {
  const slug = generateSlug(name);

  if (supabase) {
    const { data, error } = await supabase
      .from('rolls')
      .insert([{ id, slug, name, description, created_by, session_id }])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO rolls (id, slug, name, description, created_by, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    stmt.run(id, slug, name, description || '', created_by, session_id);
    return sqliteDb.prepare('SELECT * FROM rolls WHERE id = ?').get(id);
  }
}

async function getRollBySlug(slug) {
  if (supabase) {
    const { data, error } = await supabase
      .from('rolls')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  } else {
    return sqliteDb.prepare('SELECT * FROM rolls WHERE slug = ?').get(slug);
  }
}

async function getRollById(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from('rolls')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  } else {
    return sqliteDb.prepare('SELECT * FROM rolls WHERE id = ?').get(id);
  }
}

async function listRolls(page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  if (supabase) {
    const { data, error } = await supabase
      .from('rolls')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  } else {
    return sqliteDb.prepare(`
      SELECT * FROM rolls
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
}

async function incrementRollPhotoCount(rollId) {
  if (supabase) {
    // Fetch current count and increment
    const { data } = await supabase
      .from('rolls')
      .select('photo_count')
      .eq('id', rollId)
      .single();
    const newCount = (data?.photo_count || 0) + 1;
    await supabase.from('rolls').update({ photo_count: newCount }).eq('id', rollId);
  } else {
    sqliteDb.prepare('UPDATE rolls SET photo_count = photo_count + 1 WHERE id = ?').run(rollId);
  }
}

// ──────────────────────────────────────────────
// PHOTO OPERATIONS
// ──────────────────────────────────────────────

// Get paginated photos, optionally filtered by roll_id
async function getPhotos(page = 1, limit = 20, rollId = null) {
  const offset = (page - 1) * limit;
  
  if (supabase) {
    let query = supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (rollId) {
      query = query.eq('roll_id', rollId);
    } else {
      query = query.is('roll_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    return data || [];
  } else {
    if (rollId) {
      return sqliteDb.prepare(`
        SELECT * FROM photos
        WHERE roll_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(rollId, limit, offset);
    } else {
      return sqliteDb.prepare(`
        SELECT * FROM photos
        WHERE roll_id IS NULL
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);
    }
  }
}

// Add a new photo
async function addPhoto({ id, url, thumbnail, author_name, session_id, roll_id }) {
  if (supabase) {
    const { data, error } = await supabase
      .from('photos')
      .insert([{ id, url, thumbnail, author_name, session_id, roll_id: roll_id || null }])
      .select()
      .single();
      
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    return data;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO photos (id, url, thumbnail, author_name, session_id, roll_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    stmt.run(id, url, thumbnail, author_name, session_id, roll_id || null);
    
    // Retrieve the newly created record
    return sqliteDb.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  }
}

// Toggle like
async function toggleLike(photoId, sessionId) {
  if (supabase) {
    // Check if like exists
    const { data: existingLike, error: checkError } = await supabase
      .from('photo_likes')
      .select('*')
      .eq('photo_id', photoId)
      .eq('session_id', sessionId)
      .maybeSingle();
      
    if (checkError) throw checkError;
    
    if (existingLike) {
      // Remove like
      const { error: deleteError } = await supabase
        .from('photo_likes')
        .delete()
        .eq('photo_id', photoId)
        .eq('session_id', sessionId);
        
      if (deleteError) throw deleteError;
      
      const { data: photoData } = await supabase
        .from('photos')
        .select('likes')
        .eq('id', photoId)
        .single();
        
      const currentLikes = Math.max(0, (photoData?.likes || 0) - 1);
      
      const { error: updateError } = await supabase
        .from('photos')
        .update({ likes: currentLikes })
        .eq('id', photoId);
        
      if (updateError) throw updateError;
      return currentLikes;
    } else {
      // Add like
      const { error: insertError } = await supabase
        .from('photo_likes')
        .insert([{ photo_id: photoId, session_id: sessionId }]);
        
      if (insertError) throw insertError;
      
      const { data: photoData } = await supabase
        .from('photos')
        .select('likes')
        .eq('id', photoId)
        .single();
        
      const currentLikes = (photoData?.likes || 0) + 1;
      
      const { error: updateError } = await supabase
        .from('photos')
        .update({ likes: currentLikes })
        .eq('id', photoId);
        
      if (updateError) throw updateError;
      return currentLikes;
    }
  } else {
    // Transaction for atomic update in SQLite
    const transaction = sqliteDb.transaction(() => {
      const likeStmt = sqliteDb.prepare('SELECT 1 FROM photo_likes WHERE photo_id = ? AND session_id = ?');
      const hasLiked = likeStmt.get(photoId, sessionId);
      
      if (hasLiked) {
        sqliteDb.prepare('DELETE FROM photo_likes WHERE photo_id = ? AND session_id = ?').run(photoId, sessionId);
        sqliteDb.prepare('UPDATE photos SET likes = MAX(0, likes - 1) WHERE id = ?').run(photoId);
      } else {
        sqliteDb.prepare('INSERT INTO photo_likes (photo_id, session_id) VALUES (?, ?)').run(photoId, sessionId);
        sqliteDb.prepare('UPDATE photos SET likes = likes + 1 WHERE id = ?').run(photoId);
      }
      
      return sqliteDb.prepare('SELECT likes FROM photos WHERE id = ?').get(photoId).likes;
    });
    
    return transaction();
  }
}

module.exports = {
  getPhotos,
  addPhoto,
  toggleLike,
  createRoll,
  getRollBySlug,
  getRollById,
  listRolls,
  incrementRollPhotoCount
};
