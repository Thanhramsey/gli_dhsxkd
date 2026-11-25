import { describe, expect, it, vi } from 'vitest';
import { OracleService } from '../../database/oracle.service.js';
import { KpiService } from './kpi.service.js';

describe('KpiService.v2Report', () => {
  it('keeps TTCSKH and TTKDGP as independent PTM units and includes them in province totals', async () => {
    const executeQuery = vi.fn().mockResolvedValue([
      { UNIT_GROUP: 'TTVT', UNIT_CODE: '1', AREA_ID: '101', AREA_NAME: 'An Khê' },
    ]);
    const executeProcedure = vi.fn().mockImplementation((_package, _procedure, binds) => {
      const current = binds.P_MONTH.val === '202610';
      return Promise.resolve({ outBinds: { RSOUT: ['DTPTM_FIBER', 'SLPTM_FIBER'].flatMap(MA_KPI => [
        { MA_KPI, NHOM_DVI: 'TTVT', MA_DV: '1', THUCHIEN_THANG: 10 },
        { MA_KPI, NHOM_DVI: 'TTCSKH', MA_DV: '1', TEN_DV: 'TTCSKH', THUCHIEN_THANG: current ? 20 : 15 },
        { MA_KPI, NHOM_DVI: 'TTKDGP', MA_DV: '1', TEN_DV: 'TTKDGP', THUCHIEN_THANG: current ? 30 : 25 },
        { MA_KPI, NHOM_DVI: 'TOANTINH', MA_DV: '237', THUCHIEN_THANG: 999 },
      ]) } });
    });
    const service = new KpiService({ executeQuery, executeProcedure } as unknown as OracleService);
    const report = await service.v2Report('2026-10', 'ptm');
    expect(report.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitCode: '237', monthlyRevenue: 60, monthlyChange: 10 }),
      expect.objectContaining({ unitCode: '101', monthlyRevenue: 10, isTerritory: true }),
      expect.objectContaining({ unitCode: 'TTCSKH:1', monthlyRevenue: 20, monthlyChange: 5, isTerritory: false }),
      expect.objectContaining({ unitCode: 'TTKDGP:1', monthlyRevenue: 30, monthlyChange: 5, isTerritory: false }),
    ]));
    expect(report.subscriberRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ unitCode: '237', monthlyCount: 60, change: 10 }),
      expect.objectContaining({ unitCode: 'TTCSKH:1', monthlyCount: 20, isTerritory: false }),
      expect.objectContaining({ unitCode: 'TTKDGP:1', monthlyCount: 30, isTerritory: false }),
    ]));
    const ttvt = await service.v2Report('2026-10', 'ptm', 'ttvt');
    expect(ttvt.rows.map(row => row.unitCode)).toEqual(['237', '101']);
    const trend = await service.v2UnitTrend({ month: '2026-01', kpi: 'DTPTM_FIBER', unitCode: 'TTCSKH:1', group: 'ptm' });
    expect(trend.rows[0]?.monthlyRevenue).toBe(15);
  });

  it.each(['area', 'ttvt', 'vnpt'] as const)('compares PTM with the preceding month for scope %s, including January rollover', async unitScope => {
    const executeQuery = vi.fn().mockResolvedValue([
      { UNIT_GROUP: 'TTVT', UNIT_CODE: '1', AREA_ID: '101', AREA_NAME: 'An Khê' },
      { UNIT_GROUP: 'VNPT', UNIT_CODE: 'A1', AREA_ID: '101', AREA_NAME: 'An Khê' },
    ]);
    const executeProcedure = vi.fn().mockImplementation((_package, _procedure, binds) => {
      const current = binds.P_MONTH.val === '202601';
      return Promise.resolve({ outBinds: { RSOUT: [
        { MA_KPI: 'DTPTM_FIBER', NHOM_DVI: 'TTVT', MA_DV: '1', THUCHIEN_THANG: current ? 80 : 100 },
        { MA_KPI: 'DTPTM_FIBER', NHOM_DVI: 'VNPT', MA_DV: 'A1', THUCHIEN_THANG: current ? 50 : 0 },
        { MA_KPI: 'SLPTM_CAMERA', NHOM_DVI: 'TTVT', MA_DV: '1', THUCHIEN_THANG: current ? 8 : 10, THUCHIEN_LK: 8 },
        { MA_KPI: 'SLPTM_CAMERA', NHOM_DVI: 'VNPT', MA_DV: 'A1', THUCHIEN_THANG: current ? 5 : 0, THUCHIEN_LK: 5 },
        ...(current ? [{ MA_KPI: 'DTPTM_MESH', NHOM_DVI: 'TTVT', MA_DV: '1', THUCHIEN_THANG: 10 }] : []),
      ] } });
    });
    const service = new KpiService({ executeQuery, executeProcedure } as unknown as OracleService);
    const report = await service.v2Report('2026-01', 'ptm', unitScope);
    expect(executeProcedure.mock.calls.map(call => call[2].P_MONTH.val)).toEqual(['202601', '202512']);
    const change = unitScope === 'area' ? 30 : unitScope === 'ttvt' ? -20 : 50;
    expect(report.rows.filter(row => row.kpi === 'DTPTM_FIBER').map(row => row.monthlyChange)).toEqual([change, change]);
    expect(report.rows.filter(row => row.kpi === 'DTPTM_MESH').every(row => row.monthlyChange === null)).toBe(true);
    expect(report.rows.every(row => row.kpi.startsWith('DTPTM_'))).toBe(true);
    const count = unitScope === 'area' ? 13 : unitScope === 'ttvt' ? 8 : 5;
    const previousCount = unitScope === 'vnpt' ? 0 : 10;
    expect(report.subscriberRows).toEqual([
      expect.objectContaining({ kpi: 'SLPTM_CAMERA', unitCode: '237', monthlyCount: count, previousCount, change: count - previousCount, cumulativeCount: count }),
      expect.objectContaining({ kpi: 'SLPTM_CAMERA', unitCode: '101', monthlyCount: count, previousCount, change: count - previousCount, cumulativeCount: count }),
    ]);
  });

  it('reads every C3 KPI, including a new code, and keeps zero plans distinct from missing data', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{
      KPI: 'F1.FIBER_C3', MA_DV: '237', TEN_DV: 'GLI', BIEUDO: 'Tổng doanh thu Dịch vụ FIBER',
      DOANH_THU: 33_000_000_000, KE_HOACH_THANG: 34_000_000_000,
      DOANH_THU_LK: 320_000_000_000, KE_HOACH_LK_THANG: 327_000_000_000,
      KE_HOACH_LK_NAM: 394_000_000_000, XEP_HANG: 0, XEP_HANG_LK_THANG: 0,
      XEP_HANG_LK_NAM: 0, TANG_GIAM: 1_500_000_000, CON_LAI_NAM: 74_000_000_000,
    }, {
      KPI: 'F1.DITT_C3', MA_DV: '237.301', TEN_DV: 'An Khê', BIEUDO: 'Tổng doanh thu Dịch vụ Internet trực tiếp',
      DOANH_THU: 3_500_000, KE_HOACH_THANG: 0,
      DOANH_THU_LK: 10_500_000, KE_HOACH_LK_THANG: 0,
      KE_HOACH_LK_NAM: 0, XEP_HANG: 3, XEP_HANG_LK_THANG: 5,
      XEP_HANG_LK_NAM: 7, TANG_GIAM: -500_000, CON_LAI_NAM: -10_500_000,
    }, {
      KPI: 'F9.NEW_C3', MA_DV: '237', TEN_DV: 'GLI', BIEUDO: 'Tổng doanh thu dịch vụ mới',
      DOANH_THU: 5_000_000, KE_HOACH_THANG: null,
      DOANH_THU_LK: 20_000_000, KE_HOACH_LK_THANG: null,
      KE_HOACH_LK_NAM: null, XEP_HANG: null,
    }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);

    const result = await service.v2Report('2026-10');

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/XEP_HANG_LK_THANG, XEP_HANG_LK_NAM, TANG_GIAM, CON_LAI_NAM[\s\S]*FROM NBH_CDS_NEW\.TONGHOP_KPI_ALL[\s\S]*REGEXP_LIKE\(TRIM\(KPI\), :kpiPattern\)/),
      { reportMonth: expect.objectContaining({ val: '202610' }), kpiPattern: expect.objectContaining({ val: '_C3$' }) },
    );
    expect(result).toEqual({ month: '2026-10', rows: [expect.objectContaining({
      kpi: 'F1.FIBER_C3', unitCode: '237', monthlyRevenue: 33_000_000_000,
      monthlyPlan: 34_000_000_000, annualPlan: 394_000_000_000,
      cumulativeRank: 0, annualRank: 0, monthlyChange: 1_500_000_000, remainingAnnual: 74_000_000_000,
    }), expect.objectContaining({
      kpi: 'F1.DITT_C3', unitCode: '237.301', monthlyRevenue: 3_500_000,
      monthlyPlan: 0, cumulativePlan: 0, rank: 3, cumulativeRank: 5, annualRank: 7,
      monthlyChange: -500_000, remainingAnnual: -10_500_000,
    }), expect.objectContaining({
      kpi: 'F9.NEW_C3', chartName: 'Tổng doanh thu dịch vụ mới', monthlyPlan: null,
    })] });
  });

  it('lists months for all C3 KPIs', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{ REPORT_MONTH: '202611' }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);
    expect(await service.v2Months()).toEqual({ months: ['202611'] });
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('REGEXP_LIKE(TRIM(KPI), :kpiPattern)'),
      { kpiPattern: expect.objectContaining({ val: '_C3$' }) },
    );
  });

  it('loads maintenance KPIs and available months using the C3_DT suffix', async () => {
    const executeQuery = vi.fn()
      .mockResolvedValueOnce([{ REPORT_MONTH: '202610' }])
      .mockResolvedValueOnce([{
        KPI: 'F2.2_FIBER_C3_DT', MA_DV: '237', TEN_DV: 'GLI', BIEUDO: 'Doanh thu duy trì Fiber',
        DOANH_THU: 1_000_000, KE_HOACH_THANG: 2_000_000,
      }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);

    expect(await service.v2Months('maintenance')).toEqual({ months: ['202610'] });
    const report = await service.v2Report('2026-10', 'maintenance');

    expect(report.rows).toEqual([expect.objectContaining({ kpi: 'F2.2_FIBER_C3_DT', monthlyRevenue: 1_000_000 })]);
    expect(executeQuery.mock.calls[0]?.[1]).toEqual({ kpiPattern: expect.objectContaining({ val: '_C3_DT$' }) });
    expect(executeQuery.mock.calls[1]?.[1]).toEqual({
      reportMonth: expect.objectContaining({ val: '202610' }),
      kpiPattern: expect.objectContaining({ val: '_C3_DT$' }),
    });
  });

  it('sums TTVT and VNPT by DIABAN_ID and supports separate PTM scopes', async () => {
    const executeQuery = vi.fn()
      .mockResolvedValueOnce([{ REPORT_MONTH: '202610' }])
      .mockResolvedValue([{ UNIT_GROUP: 'TTVT', UNIT_CODE: '1', AREA_ID: '101', AREA_NAME: 'An Khê' },
        { UNIT_GROUP: 'VNPT', UNIT_CODE: 'A1', AREA_ID: '101', AREA_NAME: 'An Khê' },
        { UNIT_GROUP: 'TTVT', UNIT_CODE: '2', AREA_ID: '102', AREA_NAME: 'Quy Nhơn' }]);
    const executeProcedure = vi.fn().mockResolvedValue({ outBinds: { RSOUT: [
      { MA_KPI: 'DTPTM_FIBER', TEN_KPI: 'Doanh thu PTM Fiber', NHOM_DVI: 'TOANTINH', MA_DV: 'GLI', TEN_DV: 'Gia Lai', KE_HOACH_THANG: 300, THUCHIEN_THANG: 250, KE_HOACH_THANG_LK: 1000, THUCHIEN_LK: 900, KE_HOACH_NAM: 2000 },
      { MA_KPI: 'DTPTM_FIBER', TEN_KPI: 'Doanh thu PTM Fiber', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: 100, THUCHIEN_THANG: 90, KE_HOACH_THANG_LK: 200, THUCHIEN_LK: 180, KE_HOACH_NAM: 500 },
      { MA_KPI: 'DTPTM_FIBER', TEN_KPI: 'Doanh thu PTM Fiber', NHOM_DVI: 'VNPT', MA_DV: 'A1', TEN_DV: 'VNPT An Khê', KE_HOACH_THANG: 50, THUCHIEN_THANG: 60, KE_HOACH_THANG_LK: 100, THUCHIEN_LK: 120, KE_HOACH_NAM: 250 },
      { MA_KPI: 'DTPTM_FIBER', TEN_KPI: 'Doanh thu PTM Fiber', NHOM_DVI: 'TTVT', MA_DV: '2', TEN_DV: 'Quy Nhơn', KE_HOACH_THANG: 100, THUCHIEN_THANG: 120, KE_HOACH_THANG_LK: 200, THUCHIEN_LK: 240, KE_HOACH_NAM: 500 },
      { MA_KPI: 'DTPTM_MYTV', TEN_KPI: 'Doanh thu PTM MyTV', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: 0, THUCHIEN_THANG: 10, KE_HOACH_THANG_LK: 0, THUCHIEN_LK: 30, KE_HOACH_NAM: 0 },
      { MA_KPI: 'DTPTM_MESH', TEN_KPI: 'Doanh thu PTM Mesh', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: 40, THUCHIEN_THANG: 36, KE_HOACH_THANG_LK: 80, THUCHIEN_LK: 72, KE_HOACH_NAM: 150 },
      { MA_KPI: 'DTPTM_CAMERA', TEN_KPI: 'Doanh thu PTM Camera', NHOM_DVI: 'TTVT', MA_DV: '2', TEN_DV: 'Quy Nhơn', KE_HOACH_THANG: 50, THUCHIEN_THANG: 55, KE_HOACH_THANG_LK: 100, THUCHIEN_LK: 105, KE_HOACH_NAM: 220 },
      { MA_KPI: 'SLPTM_FIBER', TEN_KPI: 'Thuê bao PTM Fiber', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: 20, THUCHIEN_THANG: 15 },
    ] } });
    const service = new KpiService({ executeQuery, executeProcedure } as unknown as OracleService);

    expect(await service.v2Months('ptm')).toEqual({ months: ['202610'] });
    const report = await service.v2Report('2026-10', 'ptm');

    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('NBH_CDS_NEW.GLI_TH_CHITIEUGB'));
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining("REGEXP_LIKE(TRIM(UPPER(MA_KPI)), '^DTPTM_[A-Z0-9_]+$')"));
    expect(executeProcedure).toHaveBeenCalledWith('NBH_CDS_NEW.BCGIAOBAN_GLI', 'SP_VIEW_PTM', expect.objectContaining({
      P_MONTH: expect.objectContaining({ val: '202610' }),
      RSOUT: expect.objectContaining({ dir: expect.any(Number) }),
    }));
    expect(report.rows).toHaveLength(9);
    expect(report.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kpi: 'DTPTM_FIBER', unitCode: '237', monthlyRevenue: 270, monthlyPlan: 250, cumulativeRevenue: 540, cumulativePlan: 500, annualPlan: 1250 }),
      expect.objectContaining({ kpi: 'DTPTM_FIBER', unitCode: '102', rank: 1, cumulativeRank: 1, annualRank: 1 }),
      expect.objectContaining({ kpi: 'DTPTM_FIBER', unitCode: '101', monthlyRevenue: 150, monthlyPlan: 150, cumulativeRevenue: 300, cumulativePlan: 300, annualPlan: 750, rank: 2 }),
      expect.objectContaining({ kpi: 'DTPTM_MYTV', unitCode: '101', rank: null, remainingAnnual: null }),
      expect.objectContaining({ kpi: 'DTPTM_MESH', unitCode: '101', monthlyRevenue: 36, rank: 1 }),
      expect.objectContaining({ kpi: 'DTPTM_CAMERA', unitCode: '102', monthlyRevenue: 55, rank: 1 }),
    ]));
    const ttvt = await service.v2Report('2026-10', 'ptm', 'ttvt');
    const vnpt = await service.v2Report('2026-10', 'ptm', 'vnpt');
    expect(ttvt.rows.find(row => row.kpi === 'DTPTM_FIBER' && row.unitCode === '101')).toMatchObject({ monthlyRevenue: 90, monthlyPlan: 100 });
    expect(vnpt.rows).toEqual([
      expect.objectContaining({ kpi: 'DTPTM_FIBER', unitCode: '237', monthlyRevenue: 60 }),
      expect.objectContaining({ kpi: 'DTPTM_FIBER', unitCode: '101', monthlyRevenue: 60 }),
    ]);
  });
});

describe('KpiService.v2UnitTrend', () => {
  it('builds PTM unit history from monthly bound procedure calls', async () => {
    const executeProcedure = vi.fn().mockImplementation((_package, _procedure, binds) => {
      const january = binds.P_MONTH.val === '202601';
      return Promise.resolve({ outBinds: { RSOUT: [{
        MA_KPI: 'DTPTM_FIBER', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê',
        KE_HOACH_THANG: 20, THUCHIEN_THANG: january ? 10 : 15,
        KE_HOACH_THANG_LK: january ? 20 : 40, THUCHIEN_LK: january ? 10 : 25,
        KE_HOACH_NAM: 100,
      }, {
        MA_KPI: 'DTPTM_FIBER', NHOM_DVI: 'VNPT', MA_DV: 'A1', TEN_DV: 'VNPT An Khê',
        KE_HOACH_THANG: 5, THUCHIEN_THANG: january ? 2 : 4,
        KE_HOACH_THANG_LK: january ? 5 : 10, THUCHIEN_LK: january ? 2 : 6,
        KE_HOACH_NAM: 20,
      }] } });
    });
    const executeQuery = vi.fn().mockResolvedValue([{ UNIT_GROUP: 'TTVT', UNIT_CODE: '1', AREA_ID: '101', AREA_NAME: 'An Khê' },
      { UNIT_GROUP: 'VNPT', UNIT_CODE: 'A1', AREA_ID: '101', AREA_NAME: 'An Khê' }]);
    const service = new KpiService({ executeProcedure, executeQuery } as unknown as OracleService);

    const result = await service.v2UnitTrend({ month: '2026-02', kpi: 'DTPTM_FIBER', unitCode: '101', group: 'ptm' });

    expect(executeProcedure).toHaveBeenCalledTimes(2);
    expect(executeProcedure.mock.calls.map(call => call[2].P_MONTH.val)).toEqual(['202601', '202602']);
    expect(result.rows).toEqual([
      expect.objectContaining({ month: '2026-01', monthlyRevenue: 12, monthlyPlan: 25, monthlyChange: null, remainingAnnual: 108 }),
      expect.objectContaining({ month: '2026-02', monthlyRevenue: 19, monthlyPlan: 25, monthlyChange: 7, remainingAnnual: 89 }),
    ]);
  });

  it('binds KPI, unit and months, and keeps missing months empty', async () => {
    const executeQuery = vi.fn().mockResolvedValue([
      { REPORT_MONTH: '202601', DOANH_THU: 1_000_000, KE_HOACH_THANG: 2_000_000, DOANH_THU_LK: 1_000_000, KE_HOACH_LK_THANG: 2_000_000, KE_HOACH_LK_NAM: 24_000_000, TANG_GIAM: 100_000, CON_LAI_NAM: 23_000_000 },
      { REPORT_MONTH: '202603', DOANH_THU: 3_000_000, KE_HOACH_THANG: 0, DOANH_THU_LK: 4_000_000, KE_HOACH_LK_THANG: 6_000_000, KE_HOACH_LK_NAM: 24_000_000 },
    ]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);

    const result = await service.v2UnitTrend({ month: '2026-03', kpi: 'F1.FIBER_C3', unitCode: '237.301' });

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/TANG_GIAM, CON_LAI_NAM[\s\S]*ROW_NUMBER\(\)[\s\S]*THANG_DULIEU[\s\S]*FROM NBH_CDS_NEW\.TONGHOP_KPI_ALL/),
      expect.objectContaining({
        kpi: expect.objectContaining({ val: 'F1.FIBER_C3' }),
        unitCode: expect.objectContaining({ val: '237.301' }),
        firstMonth: expect.objectContaining({ val: '202601' }),
        reportMonth: expect.objectContaining({ val: '202603' }),
      }),
    );
    expect(result.rows).toEqual([
      expect.objectContaining({ month: '2026-01', monthlyRevenue: 1_000_000, monthlyChange: 100_000, remainingAnnual: 23_000_000 }),
      expect.objectContaining({ month: '2026-02', monthlyRevenue: null, monthlyPlan: null, monthlyChange: null, remainingAnnual: null }),
      expect.objectContaining({ month: '2026-03', monthlyRevenue: 3_000_000, monthlyPlan: 0 }),
    ]);
  });
});

describe('KpiService.v2SubscriberReport', () => {
  it('binds the report month and maps PTM/HUY counts without replacing missing values with zero', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{
      KPI: 'FIBER_PTM_C3', MA_DV: '237', TEN_DV: 'GLI', DICH_VU: 'FIBER', CHI_TIEU: 'PTM',
      NAM_TRUOC: 2025, NAM_NAY: 2026, SL_NAM_TRUOC: 1357, SL_NAM_NAY: 1405, TANG_GIAM: 48,
    }, {
      KPI: 'MESH_TL_C3', MA_DV: '237', TEN_DV: 'GLI', DICH_VU: 'MESH', CHI_TIEU: 'HUY',
      NAM_TRUOC: 2025, NAM_NAY: 2026, SL_NAM_TRUOC: null, SL_NAM_NAY: 0, TANG_GIAM: null,
    }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);

    const result = await service.v2SubscriberReport('2026-10');

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM NBH_CDS_NEW.TONGHOP_KPI_SOLUONG_C3'),
      { reportMonth: expect.objectContaining({ val: '202610' }) },
    );
    expect(result.rows).toEqual([
      expect.objectContaining({ kpi: 'FIBER_PTM_C3', service: 'FIBER', indicator: 'PTM', previousCount: 1357, currentCount: 1405, change: 48 }),
      expect.objectContaining({ kpi: 'MESH_TL_C3', indicator: 'HUY', previousCount: null, currentCount: 0, change: null }),
    ]);
  });
});

describe('KpiService.fiberPsc', () => {
  it('binds the selected month and keeps Fiber and MyTV rows separate for each unit', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({ outBinds: { RSOUT: [
      { NHOM_DICHVUGB: 'FIBER', NHOM_DVI: null, MA_DV: '237', TEN_DV: 'Viễn thông Gia Lai', TBPSC_THANG: 120, TBPSCTT_THANG: 90,
        DT_THUCHIEN_THANG: 250000000, DT_THUCHIEN_LK: 1000000000, DT_KE_HOACH_THANG: 300000000,
        DT_KE_HOACH_THANG_LK: 1200000000, DT_KE_HOACH_NAM: 3600000000 },
      { NHOM_DICHVUGB: 'FIBER', NHOM_DVI: 'DB_CHUNG', MA_DV: '1', TEN_DV: 'An Khê', TBPSC_THANG: 20, TBPSCTT_THANG: null,
        DT_THUCHIEN_THANG: 50000000, DT_THUCHIEN_LK: 200000000, DT_KE_HOACH_THANG: 0,
        DT_KE_HOACH_THANG_LK: 220000000, DT_KE_HOACH_NAM: 700000000 },
      { NHOM_DICHVUGB: 'MYTV', NHOM_DVI: 'DB_CHUNG', MA_DV: '1', TEN_DV: 'An Khê', TBPSC_THANG: 7, TBPSCTT_THANG: 5,
        DT_THUCHIEN_THANG: 8000000, DT_THUCHIEN_LK: 40000000, DT_KE_HOACH_THANG: 9000000,
        DT_KE_HOACH_THANG_LK: 45000000, DT_KE_HOACH_NAM: 130000000 },
    ] } });
    const executeQuery = vi.fn().mockResolvedValue([
      { MA_DV: '237', NHOM_DVI: 'TOANTINH' },
      { MA_DV: '1', NHOM_DVI: 'TTVT' },
    ]);
    const service = new KpiService({ executeProcedure, executeQuery } as unknown as OracleService);

    const result = await service.fiberPsc('2026-11');

    expect(executeProcedure).toHaveBeenCalledWith('NBH_CDS_NEW.BCGIAOBAN_GLI', 'SP_VIEW_PSC', expect.objectContaining({
      P_MONTH: expect.objectContaining({ val: '202611' }),
      RSOUT: expect.objectContaining({ dir: expect.any(Number) }),
    }));
    expect(result.rows).toEqual([
      expect.objectContaining({ service: 'FIBER', unitGroup: 'TOANTINH', unitCode: '237', monthlyPscSubscribers: 120, monthlyNetPscSubscribers: 90, monthlyRevenue: 250000000, annualRevenuePlan: 3600000000 }),
      expect.objectContaining({ service: 'FIBER', unitGroup: 'TTVT', unitCode: '1', monthlyNetPscSubscribers: null, monthlyRevenuePlan: 0 }),
      expect.objectContaining({ service: 'MYTV', unitGroup: 'TTVT', unitCode: '1', monthlyPscSubscribers: 7, monthlyRevenue: 8000000 }),
    ]);
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('FROM v_donvi_diaban'));
  });
});

describe('KpiService.fiberDevelopment', () => {
  it('calls SP_VIEW_PTM with a bound month and keeps Fiber and MyTV indicators', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({ outBinds: { RSOUT: [
      { MA_KPI: 'DTPTM_FIBER', TEN_KPI: 'Doanh thu PTM Fiber', NHOM_DVI: 'TOANTINH', MA_DV: '237', TEN_DV: 'Gia Lai', KE_HOACH_THANG: 100, THUCHIEN_THANG: 90 },
      { MA_KPI: 'SLPTM_FIBER', TEN_KPI: 'Thuê bao PTM Fiber', NHOM_DVI: 'TOANTINH', MA_DV: '237', TEN_DV: 'Gia Lai', KE_HOACH_THANG: 10, THUCHIEN_THANG: 9 },
      { MA_KPI: 'DTPTM_MYTV', TEN_KPI: 'Doanh thu PTM MyTV', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: 20, THUCHIEN_THANG: 0 },
      { MA_KPI: 'SLPTM_MYTV', TEN_KPI: 'Thuê bao PTM MyTV', NHOM_DVI: 'TTVT', MA_DV: '1', TEN_DV: 'An Khê', KE_HOACH_THANG: null, THUCHIEN_THANG: 3 },
    ] } });
    const service = new KpiService({ executeProcedure } as unknown as OracleService);

    const result = await service.fiberDevelopment('2026-10');

    expect(executeProcedure).toHaveBeenCalledWith('NBH_CDS_NEW.BCGIAOBAN_GLI', 'SP_VIEW_PTM', expect.objectContaining({
      P_MONTH: expect.objectContaining({ val: '202610' }),
      RSOUT: expect.objectContaining({ dir: expect.any(Number) }),
    }));
    expect(result.rows.map(row => row.kpi)).toEqual(['DTPTM_FIBER', 'SLPTM_FIBER', 'DTPTM_MYTV', 'SLPTM_MYTV']);
    expect(result.rows[2]).toEqual(expect.objectContaining({ unitGroup: 'TTVT', unitCode: '1', plan: 20, actual: 0 }));
    expect(result.rows[3]).toEqual(expect.objectContaining({ plan: null, actual: 3 }));
  });
});

describe('KpiService.trend', () => {
  it('maps the procedure pivot into monthly rows from January to the selected month', async () => {
    const executeProcedure = vi.fn().mockResolvedValue({
      outBinds: {
        P_RESULT: [{
          BIEUDO: 'Vina trả sau',
          SL_TB_20260101: 10,
          DOANH_THU_20260101: 100,
          SL_TB_20260201: 20,
          DOANH_THU_20260201: null,
        }],
      },
    });
    const service = new KpiService({ executeProcedure } as unknown as OracleService);

    const result = await service.trend({ month: '2026-02', procedure: 'TONG_HOP_KPI_VINA_TS' });

    expect(result.rows).toEqual([
      { month: '2026-01', subscribers: 10, revenue: 100 },
      { month: '2026-02', subscribers: 20, revenue: null },
    ]);
    expect(executeProcedure).toHaveBeenCalledWith(
      'NBH_CDS_NEW.MA_KPI_GLI_TONG',
      'TONG_HOP_KPI_VINA_TS',
      expect.objectContaining({
        P_TUNGAY: expect.objectContaining({ val: '01/01/2026' }),
        P_DENNGAY: expect.objectContaining({ val: '28/02/2026' }),
      }),
    );
  });

  it.each([
    ['TONG_HOP_KPI_BRCD', 'F1.FIBER_C2'],
    ['TONG_HOP_KPI_MYTV', 'F1.MYTV_C2'],
    ['TONG_HOP_KPI_TSL', 'F4.3_C2'],
    ['TONG_HOP_KPI_CNTT', 'F4.1_C2'],
  ] as const)('reads %s from the selected snapshot without invoking a procedure', async (procedure, kpi) => {
    const executeQuery = vi.fn().mockResolvedValue([{
      THANG: '202609', KY_CUOC: 20260901, THANG_DULIEU: '202609', KPI: kpi,
      DOANH_THU: 200, KE_HOACH_THANG: 20, TY_LE_THANG: 1000,
      DOANH_THU_LK: 1500, KE_HOACH_LK_THANG: 180, TY_LE_LK_THANG: 833.33,
      KE_HOACH_LK_NAM: 240, TY_LE_LK_NAM: 625,
    }]);
    const executeProcedure = vi.fn();
    const service = new KpiService({ executeQuery, executeProcedure } as unknown as OracleService);
    const result = await service.trend({ month: '2026-09', procedure });

    expect(executeProcedure).not.toHaveBeenCalled();
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('FROM NBH_CDS_NEW.TONGHOP_KPI'), expect.objectContaining({
      KPI: expect.objectContaining({ val: kpi }),
      THANG_DULIEU: expect.objectContaining({ val: '202609' }),
    }));
    expect(result.rows).toEqual([expect.objectContaining({
      month: '2026-09', snapshotMonth: '2026-09', revenue: 200, plan: 20, completionRate: 1000,
      cumulativeRevenue: 1500, cumulativePlan: 180, cumulativeRate: 833.33, annualPlan: 240, annualRate: 625,
    })]);
  });

  it('chooses the latest snapshot for CNTT independently of the other KPIs', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{ LATEST_MONTH: '202609' }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);
    expect(await service.latestMonth('TONG_HOP_KPI_CNTT')).toEqual({ month: '2026-09' });
    expect(executeQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE KPI = :KPI'), expect.objectContaining({
      KPI: expect.objectContaining({ val: 'F4.1_C2' }),
    }));
  });

  it('keeps missing snapshot metrics null and uses the billing period when THANG is absent', async () => {
    const executeQuery = vi.fn().mockResolvedValue([{ THANG: null, KY_CUOC: 20260301, THANG_DULIEU: '202609' }]);
    const service = new KpiService({ executeQuery } as unknown as OracleService);
    expect((await service.trend({ month: '2026-09', procedure: 'TONG_HOP_KPI_TSL' })).rows).toEqual([
      expect.objectContaining({ month: '2026-03', revenue: null, plan: null, completionRate: null, annualRate: null }),
    ]);
    executeQuery.mockResolvedValue([]);
    expect((await service.trend({ month: '2026-10', procedure: 'TONG_HOP_KPI_TSL' })).rows).toEqual([]);
  });
});
