import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OracleService } from './database/oracle.service.js';

describe('AppController', () => {
  let appController: AppController;
  const oracleService = {
    checkConnection: vi.fn(),
  };

  beforeEach(async () => {
    oracleService.checkConnection.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: OracleService, useValue: oracleService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should report that the API is healthy', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });

    it('should report the live Oracle connection', async () => {
      const oracleHealth = {
        status: 'connected' as const,
        databaseTime: '2026-09-16T07:00:00.000Z',
      };
      oracleService.checkConnection.mockResolvedValue(oracleHealth);

      await expect(appController.getOracleHealth()).resolves.toEqual(
        oracleHealth,
      );
    });
  });
});
