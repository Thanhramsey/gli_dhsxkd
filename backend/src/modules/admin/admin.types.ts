export interface AdminUser {
  id: string;
  account: string;
  displayName: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  unitName: string | null;
  status: number;
  groupIds: string[];
  groupNames: string[];
}

export interface AdminGroup {
  id: string;
  name: string;
  menuIds: string[];
  userCount: number;
}

export interface EmployeeOption {
  id: string;
  code: string;
  name: string;
  unitName: string | null;
}

export interface ReportGroup {
  id: string;
  name: string;
  note: string | null;
  reportCount: number;
}

export interface ReportDefinition {
  id: string;
  name: string;
  sql: string | null;
  parameters: Array<string | null>;
  reportView: string | null;
  reportExport: string | null;
  groupId: string | null;
  groupName: string | null;
  procedurePackage: string | null;
}
