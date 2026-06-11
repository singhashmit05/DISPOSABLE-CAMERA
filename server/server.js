const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const storage = require('./storage');
const wsServer = require('./ws');
require('dotenv').config();

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from local uploads folder
app.use('/uploads', express.static(storage.uploadsDir));

// Rate limit uploads: max 5 photos per IP per 10 minutes
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { error: 'Too many developing requests! You can only develop 5 photos per 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Configure Multer for processing in-memory buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format! Only JPG, PNG, HEIC, and WebP are allowed.'));
    }
  }
});

// ──────────────────────────────────────────────
// ROLL ROUTES
// ──────────────────────────────────────────────

// POST /api/rolls - Create a new roll
app.post('/api/rolls', async (req, res) => {
  try {
    const { name, description, author_name, session_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Roll name is required' });
    }
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const rollId = crypto.randomUUID();
    const roll = await db.createRoll({
      id: rollId,
      name: name.trim(),
      description: (description || '').trim(),
      created_by: author_name || 'Anonymous',
      session_id
    });

    res.status(201).json({ success: true, roll });
  } catch (err) {
    console.error('Error creating roll:', err);
    res.status(500).json({ error: err.message || 'Failed to create roll' });
  }
});

// GET /api/rolls - List all rolls (paginated)
app.get('/api/rolls', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const rolls = await db.listRolls(page, limit);
    res.json({ success: true, rolls });
  } catch (err) {
    console.error('Error listing rolls:', err);
    res.status(500).json({ error: 'Failed to list rolls' });
  }
});

// GET /api/rolls/:slug - Get a single roll by slug
app.get('/api/rolls/:slug', async (req, res) => {
  try {
    const roll = await db.getRollBySlug(req.params.slug);
    if (!roll) {
      return res.status(404).json({ error: 'Roll not found' });
    }
    res.json({ success: true, roll });
  } catch (err) {
    console.error('Error fetching roll:', err);
    res.status(500).json({ error: 'Failed to fetch roll' });
  }
});

// ──────────────────────────────────────────────
// PHOTO ROUTES
// ──────────────────────────────────────────────

// GET /api/photos - Fetch paginated photos (optionally filtered by roll_id)
app.get('/api/photos', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const rollId = req.query.roll_id || null;

  try {
    const photos = await db.getPhotos(page, limit, rollId);
    res.json({ success: true, photos });
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to retrieve photo roll' });
  }
});

// POST /api/photos/upload - Upload and develop photo
app.post('/api/photos/upload', uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    const { author_name, session_id, roll_id } = req.body;
    
    if (!author_name || !session_id) {
      return res.status(400).json({ error: 'Author name and session ID are required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo captured or provided' });
    }

    const fileId = crypto.randomUUID();
    
    // Process buffers through Sharp (resizing + compression) and store
    const { url, thumbnail } = await storage.processAndStore(req.file.buffer, fileId);

    // Save record to DB (SQLite or Supabase)
    const photo = await db.addPhoto({
      id: fileId,
      url,
      thumbnail,
      author_name,
      session_id,
      roll_id: roll_id || null
    });

    // If this belongs to a roll, increment its photo_count
    if (roll_id) {
      try {
        await db.incrementRollPhotoCount(roll_id);
      } catch (e) {
        console.error('Failed to increment roll photo count:', e);
      }
    }

    // Notify all connected clients via websocket
    wsServer.broadcastNewPhoto(photo);

    res.status(201).json({ success: true, photo });
  } catch (err) {
    console.error('Error developing photo:', err);
    res.status(500).json({ error: err.message || 'Developing process failed' });
  }
});

// POST /api/photos/:id/like - Toggle reactions
app.post('/api/photos/:id/like', async (req, res) => {
  const photoId = req.params.id;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'Session token is required to react' });
  }

  try {
    const updatedLikesCount = await db.toggleLike(photoId, session_id);
    
    // Broadcast live like updates
    wsServer.broadcastLikeUpdate(photoId, updatedLikesCount);

    res.json({ success: true, photoId, likes: updatedLikesCount });
  } catch (err) {
    console.error('Error reacting to photo:', err);
    res.status(500).json({ error: 'Like transaction failed' });
  }
});

// Health check route
app.get('/api/session', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large! Max is 10MB.' });
    }
  }
  res.status(400).json({ error: err.message || 'Something went wrong' });
});

// Start Express server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Flashback server running on port ${PORT}`);
});

// Bind WebSocket Server upgrade listener
wsServer.init(server);
