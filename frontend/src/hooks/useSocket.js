import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = (serverUrl) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const serverUrlRef = useRef(serverUrl);

  useEffect(() => {
    const url = serverUrlRef.current;
    const socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
};

export default useSocket;
