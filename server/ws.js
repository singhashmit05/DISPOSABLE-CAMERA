const { WebSocketServer } = require('ws');

let wss = null;

function init(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    // Safely parse URL paths on incoming upgrade requests
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch (err) {
      console.error('WebSocket upgrade error:', err);
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log('🔌 Client connected via WebSocket');

    ws.on('close', () => {
      console.log('🔌 Client disconnected from WebSocket');
    });

    ws.onerror = (err) => {
      console.error('WebSocket socket client error:', err);
    };
  });
}

function broadcast(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(payload);
    }
  });
}

function broadcastNewPhoto(photo) {
  broadcast({
    type: 'NEW_PHOTO',
    photo
  });
}

function broadcastLikeUpdate(photoId, likes) {
  broadcast({
    type: 'LIKE_UPDATE',
    photoId,
    likes
  });
}

module.exports = {
  init,
  broadcastNewPhoto,
  broadcastLikeUpdate
};
