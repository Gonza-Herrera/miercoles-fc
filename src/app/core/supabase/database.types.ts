export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      dinner_expenses: {
        Row: {
          amount_minor: number;
          created_at: string;
          created_by: string;
          description: string;
          event_id: string;
          id: string;
          paid_by_group_member_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          created_by: string;
          description: string;
          event_id: string;
          id?: string;
          paid_by_group_member_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          created_by?: string;
          description?: string;
          event_id?: string;
          id?: string;
          paid_by_group_member_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dinner_expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dinner_expenses_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dinner_expenses_paid_by_group_member_id_fkey';
            columns: ['paid_by_group_member_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id'];
          },
        ];
      };
      event_managers: {
        Row: {
          created_at: string;
          event_id: string;
          group_member_id: string;
          id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          group_member_id: string;
          id?: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          group_member_id?: string;
          id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_managers_group_member_id_fkey';
            columns: ['group_member_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_managers_team_event_fk';
            columns: ['team_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id', 'event_id'];
          },
        ];
      };
      event_participants: {
        Row: {
          actual_dinner: Database['public']['Enums']['actual_attendance_status'];
          actual_football: Database['public']['Enums']['actual_attendance_status'];
          created_at: string;
          dinner_response: Database['public']['Enums']['attendance_response'];
          event_id: string;
          football_response: Database['public']['Enums']['attendance_response'];
          group_member_id: string | null;
          guest_display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          actual_dinner?: Database['public']['Enums']['actual_attendance_status'];
          actual_football?: Database['public']['Enums']['actual_attendance_status'];
          created_at?: string;
          dinner_response?: Database['public']['Enums']['attendance_response'];
          event_id: string;
          football_response?: Database['public']['Enums']['attendance_response'];
          group_member_id?: string | null;
          guest_display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          actual_dinner?: Database['public']['Enums']['actual_attendance_status'];
          actual_football?: Database['public']['Enums']['actual_attendance_status'];
          created_at?: string;
          dinner_response?: Database['public']['Enums']['attendance_response'];
          event_id?: string;
          football_response?: Database['public']['Enums']['attendance_response'];
          group_member_id?: string | null;
          guest_display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_participants_group_member_id_fkey';
            columns: ['group_member_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          court_price_minor: number | null;
          created_at: string;
          created_by: string;
          currency_code: string;
          group_id: string;
          id: string;
          location: string | null;
          starts_at: string;
          status: Database['public']['Enums']['event_status'];
          title: string | null;
          updated_at: string;
        };
        Insert: {
          court_price_minor?: number | null;
          created_at?: string;
          created_by: string;
          currency_code?: string;
          group_id: string;
          id?: string;
          location?: string | null;
          starts_at: string;
          status?: Database['public']['Enums']['event_status'];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          court_price_minor?: number | null;
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          group_id?: string;
          id?: string;
          location?: string | null;
          starts_at?: string;
          status?: Database['public']['Enums']['event_status'];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          group_id: string;
          group_member_id: string;
          id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          group_id: string;
          group_member_id: string;
          id?: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          group_id?: string;
          group_member_id?: string;
          id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_invitations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_invitations_member_group_fk';
            columns: ['group_member_id', 'group_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id', 'group_id'];
          },
        ];
      };
      group_members: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          group_id: string;
          id: string;
          nickname: string | null;
          profile_id: string | null;
          role: Database['public']['Enums']['group_member_role'];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          group_id: string;
          id?: string;
          nickname?: string | null;
          profile_id?: string | null;
          role?: Database['public']['Enums']['group_member_role'];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          group_id?: string;
          id?: string;
          nickname?: string | null;
          profile_id?: string | null;
          role?: Database['public']['Enums']['group_member_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount_minor: number;
          category: Database['public']['Enums']['payment_category'];
          created_at: string;
          event_id: string;
          event_participant_id: string;
          id: string;
          paid_at: string | null;
          status: Database['public']['Enums']['payment_status'];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          category: Database['public']['Enums']['payment_category'];
          created_at?: string;
          event_id: string;
          event_participant_id: string;
          id?: string;
          paid_at?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          category?: Database['public']['Enums']['payment_category'];
          created_at?: string;
          event_id?: string;
          event_participant_id?: string;
          id?: string;
          paid_at?: string | null;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_participant_event_fk';
            columns: ['event_participant_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'event_participants';
            referencedColumns: ['id', 'event_id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          created_at: string;
          event_id: string;
          event_participant_id: string;
          id: string;
          team_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          event_participant_id: string;
          id?: string;
          team_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          event_participant_id?: string;
          id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_members_participant_event_fk';
            columns: ['event_participant_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'event_participants';
            referencedColumns: ['id', 'event_id'];
          },
          {
            foreignKeyName: 'team_members_team_event_fk';
            columns: ['team_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id', 'event_id'];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          position: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          position: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teams_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_group_invitation: {
        Args: { p_raw_token: string };
        Returns: {
          group_id: string;
          group_member_id: string;
          group_name: string;
          member_display_name: string;
          status: string;
        }[];
      };
      create_group_invitation: {
        Args: { p_group_member_id: string };
        Returns: {
          expires_at: string;
          group_id: string;
          group_member_id: string;
          group_name: string;
          member_display_name: string;
          raw_token: string;
        }[];
      };
      get_group_invitation_preview: {
        Args: { p_raw_token: string };
        Returns: {
          expires_at: string;
          group_name: string;
          member_display_name: string;
          status: string;
        }[];
      };
      list_invitable_group_members: {
        Args: never;
        Returns: {
          group_id: string;
          group_member_id: string;
          group_name: string;
          member_display_name: string;
        }[];
      };
      revoke_group_invitation: {
        Args: { p_group_member_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      actual_attendance_status: 'UNSET' | 'YES' | 'NO';
      attendance_response: 'UNKNOWN' | 'YES' | 'NO';
      event_status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'SETTLEMENT' | 'CLOSED';
      group_member_role: 'ADMIN' | 'MEMBER';
      payment_category: 'COURT' | 'DINNER';
      payment_status: 'PENDING' | 'PAID';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      actual_attendance_status: ['UNSET', 'YES', 'NO'],
      attendance_response: ['UNKNOWN', 'YES', 'NO'],
      event_status: ['DRAFT', 'OPEN', 'IN_PROGRESS', 'SETTLEMENT', 'CLOSED'],
      group_member_role: ['ADMIN', 'MEMBER'],
      payment_category: ['COURT', 'DINNER'],
      payment_status: ['PENDING', 'PAID'],
    },
  },
} as const;
