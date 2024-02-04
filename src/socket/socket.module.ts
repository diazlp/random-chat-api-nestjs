import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { TriviaService } from 'src/trivia/trivia.service';

@Module({
  providers: [SocketGateway, SocketService, TriviaService],
})
export class SocketModule {}
