export interface AuthenticatedRole {
  id: string;
  name: string;
  status: "ACTIVE";
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: AuthenticatedRole;
  permissions: string[];
}

export interface AccessUserRecord {
  id: string;
  name: string;
  email: string;
  active: boolean;
  deletedAt: Date | null;
  role: {
    id: string;
    name: string;
    status: "ACTIVE" | "INACTIVE";
    permissions: string[];
  };
}
