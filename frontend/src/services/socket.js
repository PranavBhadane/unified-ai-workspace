import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (!this.socket) {
      this.socket = io('http://127.0.0.1:5000', {
        transports: ['websocket', 'polling'],
        withCredentials: true
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected to backend events stream');
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
      });
    }
    return this.socket;
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (!this.socket) this.connect();
    this.socket.emit(event, data);
  }
}

export const socketService = new SocketService();
export default socketService;
