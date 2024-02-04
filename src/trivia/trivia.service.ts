import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { Trivia } from './trivia.interface';

@Injectable()
export class TriviaService {
  private readonly trivia: Trivia[];

  constructor() {
    const triviaFilePath = './src/game/trivia.json';

    try {
      // Read and parse the trivia data from the file
      this.trivia = JSON.parse(fs.readFileSync(triviaFilePath, 'utf-8'));
    } catch (error) {
      Logger.error(`Error loading trivia data: ${error.message}`);
    }
  }

  getRandomTrivia(): Trivia {
    const randomIndex = Math.floor(Math.random() * this.trivia.length);
    return this.trivia[randomIndex];
  }
}
