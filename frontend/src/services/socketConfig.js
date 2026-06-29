export const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

export const SOCKET_URL = getSocketUrl();

const isHostedHttpsSocket = (serverUrl) => (
  serverUrl.startsWith('https://')
  && !serverUrl.includes('localhost')
  && !serverUrl.includes('127.0.0.1')
);

export const getSocketOptions = (serverUrl = SOCKET_URL) => ({
  transports: isHostedHttpsSocket(serverUrl) ? ['websocket'] : ['websocket', 'polling'],
  withCredentials: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10
});
