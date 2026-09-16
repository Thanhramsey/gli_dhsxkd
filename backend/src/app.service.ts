import { Injectable } from '@nestjs/common';
import {
  OracleHealth,
  OracleService,
} from './database/oracle.service.js';

@Injectable()
export class AppService {
  constructor(private readonly oracleService: OracleService) {}

  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  getOracleHealth(): Promise<OracleHealth> {
    return this.oracleService.checkConnection();
  }
}
