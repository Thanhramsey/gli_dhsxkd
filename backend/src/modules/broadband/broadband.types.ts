export const BROADBAND_PROCEDURES = {
  'ptm-employee': {
    procedure: 'TONGHOP_PTM_NV',
    title: 'Phát triển mới theo nhân viên phát triển',
    hasAreaFilter: false,
  },
  'ptm-location': {
    procedure: 'TONGHOP_PTM_DB',
    title: 'Phát triển mới theo địa bàn',
    hasAreaFilter: false,
  },
  'ptm-area': {
    procedure: 'TONGHOP_PTM_KV',
    title: 'Phát triển mới theo khu vực',
    hasAreaFilter: true,
  },
  'xgspon-location': {
    procedure: 'TONGHOP_XGSPON_DB',
    title: 'Thuê bao XGSPON theo địa bàn',
    hasAreaFilter: false,
  },
  'xgspon-employee': {
    procedure: 'TONGHOP_XGSPON_NVPT',
    title: 'Thuê bao XGSPON theo nhân viên phát triển',
    hasAreaFilter: false,
  },
  'cancel-location': {
    procedure: 'TONGHOP_HUY_DB',
    title: 'Thuê bao hủy theo địa bàn',
    hasAreaFilter: false,
  },
  'cancel-area': {
    procedure: 'TONGHOP_HUY_KV',
    title: 'Thuê bao hủy theo khu vực',
    hasAreaFilter: true,
  },
} as const;

export type BroadbandProcedureKey = keyof typeof BROADBAND_PROCEDURES;

export interface BroadbandProcedureResult {
  key: BroadbandProcedureKey;
  procedure: string;
  title: string;
  rows: Array<Record<string, unknown>>;
}
