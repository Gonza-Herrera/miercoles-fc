/**
 * Bootstrap database contract derived from the PR05 migration.
 * Replace this file with `npm run supabase:types` whenever the schema changes.
 * The CLI-generated output remains the source of truth once a local database is available.
 */

export type GroupMemberRole = 'ADMIN' | 'MEMBER';
export type EventStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'SETTLEMENT' | 'CLOSED';
export type AttendanceResponse = 'UNKNOWN' | 'YES' | 'NO';
export type ActualAttendanceStatus = 'UNSET' | 'YES' | 'NO';
export type PaymentCategory = 'COURT' | 'DINNER';
export type PaymentStatus = 'PENDING' | 'PAID';

interface TableDefinition<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
}

export interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupInsert {
  id?: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  profile_id: string | null;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
  role: GroupMemberRole;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberInsert {
  id?: string;
  group_id: string;
  profile_id?: string | null;
  display_name: string;
  nickname?: string | null;
  avatar_url?: string | null;
  role?: GroupMemberRole;
  created_at?: string;
  updated_at?: string;
}

export interface GroupInvitationRow {
  id: string;
  group_id: string;
  group_member_id: string;
  token_hash: string;
  created_by: string;
  expires_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface GroupInvitationInsert {
  id?: string;
  group_id: string;
  group_member_id: string;
  token_hash: string;
  created_by: string;
  expires_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
}

export interface EventRow {
  id: string;
  group_id: string;
  created_by: string;
  title: string | null;
  starts_at: string;
  location: string | null;
  court_price_minor: number | null;
  currency_code: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface EventInsert {
  id?: string;
  group_id: string;
  created_by: string;
  title?: string | null;
  starts_at: string;
  location?: string | null;
  court_price_minor?: number | null;
  currency_code?: string;
  status?: EventStatus;
  created_at?: string;
  updated_at?: string;
}

export interface EventParticipantRow {
  id: string;
  event_id: string;
  group_member_id: string | null;
  guest_display_name: string | null;
  football_response: AttendanceResponse;
  dinner_response: AttendanceResponse;
  actual_football: ActualAttendanceStatus;
  actual_dinner: ActualAttendanceStatus;
  created_at: string;
  updated_at: string;
}

export interface EventParticipantInsert {
  id?: string;
  event_id: string;
  group_member_id?: string | null;
  guest_display_name?: string | null;
  football_response?: AttendanceResponse;
  dinner_response?: AttendanceResponse;
  actual_football?: ActualAttendanceStatus;
  actual_dinner?: ActualAttendanceStatus;
  created_at?: string;
  updated_at?: string;
}

export interface TeamRow {
  id: string;
  event_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TeamInsert {
  id?: string;
  event_id: string;
  name: string;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMemberRow {
  id: string;
  event_id: string;
  team_id: string;
  event_participant_id: string;
  created_at: string;
}

export interface TeamMemberInsert {
  id?: string;
  event_id: string;
  team_id: string;
  event_participant_id: string;
  created_at?: string;
}

export interface EventManagerRow {
  id: string;
  event_id: string;
  team_id: string;
  group_member_id: string;
  created_at: string;
}

export interface EventManagerInsert {
  id?: string;
  event_id: string;
  team_id: string;
  group_member_id: string;
  created_at?: string;
}

export interface DinnerExpenseRow {
  id: string;
  event_id: string;
  description: string;
  amount_minor: number;
  paid_by_group_member_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DinnerExpenseInsert {
  id?: string;
  event_id: string;
  description: string;
  amount_minor: number;
  paid_by_group_member_id?: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRow {
  id: string;
  event_id: string;
  event_participant_id: string;
  category: PaymentCategory;
  amount_minor: number;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInsert {
  id?: string;
  event_id: string;
  event_participant_id: string;
  category: PaymentCategory;
  amount_minor: number;
  status?: PaymentStatus;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<ProfileRow, ProfileInsert>;
      groups: TableDefinition<GroupRow, GroupInsert>;
      group_members: TableDefinition<GroupMemberRow, GroupMemberInsert>;
      group_invitations: TableDefinition<GroupInvitationRow, GroupInvitationInsert>;
      events: TableDefinition<EventRow, EventInsert>;
      event_participants: TableDefinition<EventParticipantRow, EventParticipantInsert>;
      teams: TableDefinition<TeamRow, TeamInsert>;
      team_members: TableDefinition<TeamMemberRow, TeamMemberInsert>;
      event_managers: TableDefinition<EventManagerRow, EventManagerInsert>;
      dinner_expenses: TableDefinition<DinnerExpenseRow, DinnerExpenseInsert>;
      payments: TableDefinition<PaymentRow, PaymentInsert>;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      group_member_role: GroupMemberRole;
      event_status: EventStatus;
      attendance_response: AttendanceResponse;
      actual_attendance_status: ActualAttendanceStatus;
      payment_category: PaymentCategory;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
