import { useEffect, useRef } from 'react';

export const useRoomJoin = ({
  socket,
  isConnected,
  roomCode,
  username,
  clientId,
  isPlayerDevice = false,
  enabled = true
}) => {
  const lastJoinRef = useRef({ socketId: '', joinKey: '' });
  const socketId = socket?.id || '';

  useEffect(() => {
    const normalizedRoomCode = String(roomCode || '').trim().toUpperCase();
    const normalizedUsername = String(username || '').trim();
    const normalizedClientId = String(clientId || '').trim();

    if (
      !enabled ||
      !socket ||
      !isConnected ||
      !socketId ||
      !normalizedRoomCode ||
      !normalizedUsername ||
      !normalizedClientId
    ) return;

    const joinKey = [
      normalizedRoomCode,
      normalizedUsername,
      normalizedClientId,
      isPlayerDevice ? 'player' : 'room'
    ].join('|');

    if (
      lastJoinRef.current.socketId === socketId &&
      lastJoinRef.current.joinKey === joinKey
    ) return;

    socket.emit('join-room', {
      roomCode: normalizedRoomCode,
      username: normalizedUsername,
      clientId: normalizedClientId,
      ...(isPlayerDevice ? { isPlayerDevice: true } : {})
    });

    lastJoinRef.current = { socketId, joinKey };
  }, [
    clientId,
    enabled,
    isConnected,
    isPlayerDevice,
    roomCode,
    socket,
    socketId,
    username
  ]);
};

export default useRoomJoin;
