import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private connectedClients: Map<string, Socket> = new Map();
  private rooms: Map<string, { clientId: string; peerId: string }[]> =
    new Map();

  handleConnection(socket: Socket): void {
    const clientId = socket.id;
    this.connectedClients.set(clientId, socket);

    // Send client id to the sender
    socket.emit('connected', clientId);

    // Update guest count and broadcast to all connected clients
    this.updateGuestCountAndBroadcast(socket);

    console.log(`Client connected: ${clientId}`);
  }

  handleDisconnect(socket: Socket): void {
    const clientId = socket.id;

    this.connectedClients.delete(clientId);

    // Remove the client from any rooms it may have joined
    this.rooms.forEach((clients, room) => {
      const index = clients.findIndex((client) => client.clientId === clientId);
      if (index !== -1) {
        clients.splice(index, 1);
        this.sendToRoom(room, 'message', `${clientId} left the room`);

        // Send client id to room as client leaves
        this.sendToRoom(room, 'leaveRoom', clientId);

        // Check if the room is empty after removing the client
        if (clients.length < 2) {
          // Remove the room if it's empty
          this.rooms.delete(room);
        }
      }
    });

    // Update guest count and broadcast to all connected clients
    this.updateGuestCountAndBroadcast(socket);

    console.log(`Client disconnected: ${clientId}`);
  }

  private updateGuestCountAndBroadcast(socket: Socket): void {
    const guestCount = this.connectedClients.size;

    // Broadcast the updated guest count to all connected clients except the sender
    socket.broadcast.emit('guestCount', guestCount);

    // Send the guest count to the sender as well
    socket.emit('guestCount', guestCount);
  }

  joinRoom(clientId: string, peerId: string): void {
    const availableRoom = this.findAvailableRoom();
    const generatedRoomName = availableRoom || this.generateRandomRoomName();

    let clientsInRoom = this.rooms.get(generatedRoomName) || [];

    // Check if the room has space
    if (clientsInRoom.length < 2) {
      // Join the existing room
      clientsInRoom.push({ clientId, peerId });
      this.sendToRoom(
        generatedRoomName,
        'message',
        `${clientId} joined the room`,
      );

      // Send the list of existing clients to all clients in the room
      const existingClients = clientsInRoom.map((client) => ({
        clientId: client.clientId,
        peerId: client.peerId,
      }));

      this.sendToRoom(generatedRoomName, 'guestParticipants', existingClients);

      // Update the room
      this.rooms.set(generatedRoomName, clientsInRoom);
    } else {
      // Create a new room if the existing one is full
      clientsInRoom = [{ clientId, peerId }];
      this.sendToRoom(
        generatedRoomName,
        'message',
        `${clientId} joined the room`,
      );

      // Create new room
      this.rooms.set(generatedRoomName, clientsInRoom);
    }
  }

  private sendToRoom(roomName: string, event: string, data: any): void {
    const clientsInRoom = this.rooms.get(roomName) || [];

    this.connectedClients.forEach((socket, clientId) => {
      // Check if the client is in the room based on clientId
      const isInRoom = clientsInRoom.some(
        (client) => client.clientId === clientId,
      );

      if (isInRoom) {
        socket.emit(event, data);
      }
    });
  }

  //     // Room is full, send a message to the client
  //     this.sendToClient(clientId, 'message', 'Room is full');
  private sendToClient(clientId: string, event: string, data: any): void {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  private generateRandomRoomName(): string {
    return Math.random().toString(36).substring(2);
  }

  private findAvailableRoom(): string | undefined {
    // Find a room with one client (i.e., an available room)
    const availableRoom = Array.from(this.rooms.keys()).find((roomName) => {
      const clientsInRoom = this.rooms.get(roomName);
      return clientsInRoom && clientsInRoom.length === 1;
    });

    return availableRoom;
  }
}
