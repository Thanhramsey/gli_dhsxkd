import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import oracledb from 'oracledb';
import { OracleService } from '../../database/oracle.service.js';
import { BroadbandQueryDto } from './dto/broadband-query.dto.js';
import {
  BROADBAND_PROCEDURES,
  BroadbandProcedureKey,
  BroadbandProcedureResult,
} from './broadband.types.js';

const PACKAGE_NAME = 'NBH_CDS_NEW.PACK_BR';

@Injectable()
export class BroadbandService {
  constructor(private readonly oracleService: OracleService) {}

  async units(): Promise<Array<{ id: number; name: string }>> {
    const rows = await this.oracleService.executeQuery<{
      DONVI_ID: unknown;
      TEN_DV: unknown;
    }>(
      `SELECT DONVI_ID, TEN_DV
         FROM DON_VI
        WHERE DONVI_ID IS NOT NULL
        ORDER BY TEN_DV, DONVI_ID`,
    );

    return rows
      .map((row) => ({
        id: Number(row.DONVI_ID),
        name: String(row.TEN_DV ?? row.DONVI_ID).trim(),
      }))
      .filter((unit) => Number.isFinite(unit.id));
  }

  procedures() {
    return Object.entries(BROADBAND_PROCEDURES).map(([key, value]) => ({
      key,
      title: value.title,
      procedure: value.procedure,
    }));
  }

  async execute(
    key: string,
    input: BroadbandQueryDto,
  ): Promise<BroadbandProcedureResult> {
    if (!this.isProcedureKey(key)) {
      throw new NotFoundException('Không tìm thấy báo cáo băng rộng');
    }
    this.assertDateRange(input.fromDate, input.toDate);

    const definition = BROADBAND_PROCEDURES[key];
    const binds: oracledb.BindParameters = {
      P_FROM: {
        dir: oracledb.BIND_IN,
        type: oracledb.STRING,
        val: this.toOracleDate(input.fromDate),
      },
      P_TO: {
        dir: oracledb.BIND_IN,
        type: oracledb.STRING,
        val: this.toOracleDate(input.toDate),
      },
      P_DONVI: {
        dir: oracledb.BIND_IN,
        type: oracledb.NUMBER,
        val: input.unitId ?? 0,
      },
    };

    if (definition.hasAreaFilter) {
      binds.P_KHUVUC = {
        dir: oracledb.BIND_IN,
        type: oracledb.NUMBER,
        val: input.areaId ?? 0,
      };
    }

    Object.assign(binds, {
      P_DICHVU: {
        dir: oracledb.BIND_IN,
        type: oracledb.NUMBER,
        val: input.serviceId ?? 0,
      },
      P_LOAITB: {
        dir: oracledb.BIND_IN,
        type: oracledb.NUMBER,
        val: input.subscriberTypeId ?? 0,
      },
      P_CURSOR: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    });

    const result = await this.oracleService.executeProcedure(
      PACKAGE_NAME,
      definition.procedure,
      binds,
    );
    const cursorRows = result.outBinds?.P_CURSOR;

    return {
      key,
      procedure: definition.procedure,
      title: definition.title,
      rows: Array.isArray(cursorRows)
        ? cursorRows as Array<Record<string, unknown>>
        : [],
    };
  }

  private isProcedureKey(value: string): value is BroadbandProcedureKey {
    return Object.hasOwn(BROADBAND_PROCEDURES, value);
  }

  private assertDateRange(fromDate: string, toDate: string): void {
    if (fromDate > toDate) {
      throw new BadRequestException('Từ ngày không được lớn hơn đến ngày');
    }
  }

  private toOracleDate(value: string): string {
    return value.slice(0, 10).replaceAll('-', '');
  }
}
