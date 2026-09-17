export interface EmployeeProfile {
  employeeId: string | null;
  employeeCode: string | null;
  fullName: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
}

export interface AuthenticatedUser {
  userId: string;
  account: string;
  displayName: string;
  groupIds: string[];
  groupId: string | null;
  groupName: string | null;
  employee: EmployeeProfile;
  menuCodes: string[];
  source: 'V_NGUOIDUNG_DIABAN';
}

export interface SessionPayload {
  sub: string;
  account: string;
  groupIds: string[];
  groupId: string | null;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}
