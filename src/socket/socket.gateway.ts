import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SocketService } from './socket.service';

@WebSocketGateway()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly socketService: SocketService) {}

  handleConnection(socket: Socket): void {
    this.socketService.handleConnection(socket);
  }

  handleDisconnect(socket: Socket): void {
    this.socketService.handleDisconnect(socket);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket): void {
    const clientId = client.id;
    this.socketService.joinRoom(clientId);
  }
}
