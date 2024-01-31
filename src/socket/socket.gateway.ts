import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
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

  @SubscribeMessage('joinRandomRoom')
  handleJoinRandomRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() peerId: string,
  ): void {
    const clientId = client.id;
    this.socketService.joinRandomRoom(clientId, peerId);
  }

  @SubscribeMessage('leaveRandomRoom')
  handleLeaveRandomRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() peerId: string,
  ): void {
    const clientId = client.id;
    this.socketService.leaveRandomRoom(clientId, peerId);
  }
}
