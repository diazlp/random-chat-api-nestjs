import { Module } from '@nestjs/common';
import { TriviaService } from './trivia.service';

@Module({
  providers: [TriviaService],
})
export class TriviaModule {}
