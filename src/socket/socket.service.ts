import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private connectedClients: Map<string, Socket> = new Map();
  private rooms: Map<string, string[]> = new Map();

  handleConnection(socket: Socket): void {
    const clientId = socket.id;
    this.connectedClients.set(clientId, socket);

    socket.emit('connected', clientId);
    console.log(`Client connected: ${clientId}`);
  }

  handleDisconnect(socket: Socket): void {
    const clientId = socket.id;

    this.connectedClients.delete(clientId);

    // Remove the client from any rooms it may have joined
    this.rooms.forEach((clients, room) => {
      const index = clients.indexOf(clientId);
      if (index !== -1) {
        clients.splice(index, 1);
        this.sendToRoom(room, 'message', `${clientId} left the room`);

        // Check if the room is empty after removing the client
        if (clients.length === 0) {
          // Remove the room if it's empty
          this.rooms.delete(room);
        }
      }
    });

    console.log(`Client disconnected: ${clientId}`);
  }

  // joinRoom(clientId: string): void {
  //   // Find an available room or create a new one
  //   const availableRoom = this.findAvailableRoom()

  //   // Create a new room with a random name
  //   const generatedRoomName = this.generateRandomRoomName()

  //   // Check if the room has space
  //   const clientsInRoom = this.rooms.get(availableRoom);
  //   if (clientsInRoom.length < 2) {
  //     // Join the room
  //     clientsInRoom.push(clientId);
  //     this.sendToRoom(availableRoom, 'message', `${clientId} joined the room`);
  //   } else {
  //     // make new room here with generatedRoomName <-------------

  //     // Room is full, send a message to the client
  //     this.sendToClient(clientId, 'message', 'Room is full');
  //   }
  // }

  joinRoom(clientId: string): void {
    // Find an available room or create a new one
    const availableRoom = this.findAvailableRoom();

    // Check if the room has space
    if (availableRoom) {
      const clientsInRoom = this.rooms.get(availableRoom);
      if (clientsInRoom.length < 2) {
        // Join the existing room
        clientsInRoom.push(clientId);
        this.sendToRoom(
          availableRoom,
          'message',
          `${clientId} joined the room`,
        );
        return;
      }
    }

    // Create a new room with a generated name
    const generatedRoomName = this.generateRandomRoomName();

    // Create the room if it doesn't exist
    this.rooms.set(generatedRoomName, [clientId]);

    // Join the room
    this.sendToRoom(
      generatedRoomName,
      'message',
      `${clientId} joined the room`,
    );
  }

  private sendToRoom(roomName: string, event: string, data: any): void {
    this.connectedClients.forEach((socket, clientId) => {
      if (this.rooms.get(roomName)?.includes(clientId)) {
        socket.emit(event, data);
      }
    });
  }

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
