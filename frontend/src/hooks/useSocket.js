import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (serverUrl) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('Connecting to server:', serverUrl);
    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    
    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('✅ Connected to server with ID:', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Disconnected from server');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [serverUrl]);

  return { socket, isConnected };
};

export default useSocket;