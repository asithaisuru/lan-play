import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { getSocketOptions } from '../services/socketConfig';

export const useSocket = (serverUrl, enabled = true) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const serverUrlRef = useRef(serverUrl);

  useEffect(() => {
    if (!enabled) {
      setSocket(null);
      setIsConnected(false);
      return undefined;
    }

    const url = serverUrlRef.current;
    const socketInstance = io(url, getSocketOptions(url));

    socketInstance.on('connect', () => setIsConnected(true));
    socketInstance.on('disconnect', () => setIsConnected(false));

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [enabled]);

  return { socket, isConnected };
};

export default useSocket;
