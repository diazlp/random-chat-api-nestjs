import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  GameChallengeTitle,
  ChallengeResponseType,
  GameChallengeCommand,
} from './socket.enum';
import { TriviaService } from '../trivia/trivia.service';

@Injectable()
export class SocketService {
  constructor(private readonly triviaService: TriviaService) {}

  private readonly _SYSCLIENT: string = 'system';
  private connectedClients: Map<string, Socket> = new Map();
  private rooms: Map<
    string,
    { clientId: string; peerId: string; isGameReady?: boolean }[]
  > = new Map();
  private roomGames: Map<
    string,
    {
      currentGame: string;
      currentChallenge: any;
    }
  > = new Map();

  private getClientIndex(clients: any[], clientId: string): number {
    return clients.findIndex((client) => client.clientId === clientId);
  }

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
      const index = this.getClientIndex(clients, clientId);

      if (index !== -1) {
        clients.splice(index, 1);
        this.sendToRoom(room, 'message', `${clientId} left the room`);

        // Send client id to room as client leaves
        this.sendToRoom(room, 'leaveRandomRoom', clientId);

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

  joinRandomRoom(clientId: string, peerId: string): void {
    const availableRoom = this.findAvailableRoom();
    const generatedRoomName = availableRoom || this.generateRandomRoomName();

    let clientsInRoom = this.rooms.get(generatedRoomName) || [];

    // Check if the client is already in the room
    if (clientsInRoom.some((client) => client.clientId === clientId)) {
      // Client is already in the room, do not perform any action
      return;
    }

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

  leaveRandomRoom(clientId: string, peerId: string): void {
    // Remove the client from any rooms it may have joined
    this.rooms.forEach((clients, room) => {
      const index = this.getClientIndex(clients, clientId);

      if (index !== -1) {
        const senderInfo = clients[index];

        // Send a message to all clients in the room about the client leaving
        this.sendToRoom(
          room,
          'message',
          `${senderInfo.clientId} left the room`,
        );

        // Send client id to room as client leaves
        this.sendToRoom(room, 'leaveRandomRoom', senderInfo.clientId);

        // Remove the sender from the clients list
        clients.splice(index, 1);

        // Check if the room is empty after removing the client
        if (clients.length < 2) {
          // Remove the room if it's empty
          this.rooms.delete(room);
        }
      }
    });
  }

  sendRandomMessage(
    clientId: string,
    payload: { clientId: string; message: string; time: Date },
  ) {
    this.rooms.forEach((clients, room) => {
      const index = this.getClientIndex(clients, clientId);

      if (index !== -1) {
        this.sendToRoom(room, 'sendRandomMessage', payload);

        // Check if all clients in the room are in a game challenge
        const isGameChat = clients.every((client) => client.isGameReady);
        if (isGameChat) {
          clients.every((client) => client.isGameReady) &&
            this.sendGameMessage(room, payload.message, payload.clientId);
        }
      }
    });
  }

  userSelectGame(clientId: string, title: string) {
    this.rooms.forEach((clients, room) => {
      const index = this.getClientIndex(clients, clientId);

      if (index !== -1) {
        clients[index].isGameReady = true;

        // Initiate game room title
        this.roomGames.set(room, {
          currentGame: title,
          currentChallenge: {},
        });

        this.sendToRoom(room, 'userSelectGame', {
          title,
          clientId,
        });
      }
    });
  }

  userResponseGameReq(clientId: string, response: string) {
    this.rooms.forEach((clients, room) => {
      const index = this.getClientIndex(clients, clientId);

      if (index !== -1) {
        if (response === ChallengeResponseType.Accepted) {
          clients[index].isGameReady = true;

          // Accept game challenge by sending all the game participants
          this.sendToRoom(room, 'acceptGameChallenge', clients);

          // Signal to send the first question
          this.sendGameMessage(room, GameChallengeCommand.NEXT);
        } else {
          // Remove the game room if the challenge is rejected
          this.roomGames.delete(room);

          this.sendToRoom(room, 'rejectGameChallenge', {});
        }
      }
    });
  }

  private sendGameMessage(
    room: string,
    clientMessage: string,
    clientId?: string,
  ) {
    // Retrieve the game state from the roomGames map
    const gameState = this.roomGames.get(room);

    const { currentGame, currentChallenge } = gameState;

    if (currentGame === GameChallengeTitle.Trivia) {
      switch (clientMessage) {
        case GameChallengeCommand.NEXT:
          this.sendGameQuestion(room, currentGame);
          break;

        case GameChallengeCommand.STOP:
          this.stopGameChallenge(room);
          break;

        case GameChallengeCommand.HINT:
          this.sendGameHint(room, currentChallenge.hint);
          break;

        default:
          if (
            clientMessage.toLowerCase() ===
            currentChallenge.answer.toLowerCase()
          ) {
            this.sendChallengeHasGuessed(room, clientId);
          }
          break;
      }
    }
  }

  private sendGameQuestion(room: string, currentGame: string) {
    setTimeout(() => {
      const trivia = this.triviaService.getRandomTrivia();
      this.roomGames.set(room, { currentGame, currentChallenge: trivia });

      this.sendToRoom(room, 'sendGameChallenge', {
        clientId: this._SYSCLIENT,
        message: trivia.question,
        time: new Date(),
      });
    }, 1000);
  }

  private stopGameChallenge(room: string) {
    this.roomGames.delete(room);

    const clients = this.rooms.get(room);
    if (clients) {
      clients.forEach((client) => {
        delete client.isGameReady;
      });
    }

    this.sendToRoom(room, 'sendGameChallenge', {
      clientId: this._SYSCLIENT,
      message: 'Game challenge has ended.',
      time: new Date(),
    });

    this.sendToRoom(room, 'stopGameChallenge', {});
  }

  private sendGameHint(room: string, gameHint: string) {
    this.sendToRoom(room, 'sendGameChallenge', {
      clientId: this._SYSCLIENT,
      message: gameHint,
      time: new Date(),
    });
  }

  private sendChallengeHasGuessed(room: string, clientId?: string) {
    this.sendToRoom(room, 'guessedGameChallenge', clientId);
  }
}
