export interface MenuItem {
  id: string;
  parentId: string | null;
  name: string;
  title: string;
  code: string;
  path: string | null;
  component: string | null;
  redirect: string | null;
  icon: string | null;
  orderNo: number;
  status: string | null;
  show: string | null;
  affix: string | null;
  isHeading: boolean;
  children: MenuItem[];
}

export interface UserGroup {
  id: string;
  name: string;
}
