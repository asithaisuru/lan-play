import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (serverUrl) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    
    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
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
