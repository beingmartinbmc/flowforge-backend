import { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer } from 'ws';
import { parse } from 'url';

// Store active connections
const connections = new Map<string, any>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!wss) {
    // Initialize WebSocket server
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, request) => {
      const { query } = parse(request.url || '', true);
      const userId = query.userId as string;
      
      if (userId) {
        connections.set(userId, ws);
        console.log(`WebSocket connected: ${userId}`);
      }

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message received:', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        if (userId) {
          connections.delete(userId);
          console.log(`WebSocket disconnected: ${userId}`);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (userId) {
          connections.delete(userId);
        }
      });
    });
  }

  // Handle upgrade request
  if (req.headers.upgrade === 'websocket') {
    // @ts-ignore
    wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
      wss!.emit('connection', ws, req);
    });
  } else {
    res.status(400).json({ error: 'Expected WebSocket upgrade' });
  }
}

// Export function to broadcast updates
export function broadcastUpdate(userId: string, event: string, data: any) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
    try {
      ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error broadcasting update:', error);
      connections.delete(userId);
    }
  }
}

// Export function to broadcast to all connected clients
export function broadcastToAll(event: string, data: any) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  
  connections.forEach((ws, userId) => {
    if (ws.readyState === 1) {
      try {
        ws.send(message);
      } catch (error) {
        console.error(`Error broadcasting to ${userId}:`, error);
        connections.delete(userId);
      }
    }
  });
}
