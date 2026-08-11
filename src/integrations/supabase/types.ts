export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      certificates: {
        Row: {
          certificate_number: string;
          course_title: string;
          created_at: string;
          id: string;
          issued_at: string;
          mentor_name: string;
          revoked_at: string | null;
          student_name: string;
          updated_at: string;
          user_id: string;
          verification_code: string;
        };
        Insert: {
          certificate_number: string;
          course_title?: string;
          created_at?: string;
          id?: string;
          issued_at?: string;
          mentor_name?: string;
          revoked_at?: string | null;
          student_name: string;
          updated_at?: string;
          user_id: string;
          verification_code: string;
        };
        Update: {
          certificate_number?: string;
          course_title?: string;
          created_at?: string;
          id?: string;
          issued_at?: string;
          mentor_name?: string;
          revoked_at?: string | null;
          student_name?: string;
          updated_at?: string;
          user_id?: string;
          verification_code?: string;
        };
        Relationships: [];
      };
      course_meetings: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_published: boolean;
          meeting_url: string;
          position: number;
          starts_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          is_published?: boolean;
          meeting_url?: string;
          position: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_published?: boolean;
          meeting_url?: string;
          position?: number;
          starts_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_invites: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          expires_at: string | null;
          id: string;
          status: string;
          token_hash: string;
          updated_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          status?: string;
          token_hash: string;
          updated_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          status?: string;
          token_hash?: string;
          updated_at?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [];
      };
      homework_messages: {
        Row: {
          attachments: Json;
          author_id: string | null;
          author_role: string;
          body: string;
          created_at: string;
          id: string;
          submission_id: string;
        };
        Insert: {
          attachments?: Json;
          author_id?: string | null;
          author_role: string;
          body?: string;
          created_at?: string;
          id?: string;
          submission_id: string;
        };
        Update: {
          attachments?: Json;
          author_id?: string | null;
          author_role?: string;
          body?: string;
          created_at?: string;
          id?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_messages_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "homework_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_submissions: {
        Row: {
          content: string;
          created_at: string;
          feedback: string | null;
          id: string;
          lesson_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["homework_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          feedback?: string | null;
          id?: string;
          lesson_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["homework_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          feedback?: string | null;
          id?: string;
          lesson_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["homework_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_submissions_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          id: string;
          lesson_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          lesson_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_attempts: {
        Row: {
          answers: Json;
          created_at: string;
          disqualified: boolean;
          finished_at: string | null;
          id: string;
          lesson_id: string;
          passed: boolean | null;
          percentage: number | null;
          question_order: Json;
          score: number | null;
          started_at: string;
          timed_out: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          disqualified?: boolean;
          finished_at?: string | null;
          id?: string;
          lesson_id: string;
          passed?: boolean | null;
          percentage?: number | null;
          question_order: Json;
          score?: number | null;
          started_at?: string;
          timed_out?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          disqualified?: boolean;
          finished_at?: string | null;
          id?: string;
          lesson_id?: string;
          passed?: boolean | null;
          percentage?: number | null;
          question_order?: Json;
          score?: number | null;
          started_at?: string;
          timed_out?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          content_md: string;
          created_at: string;
          day_number: number;
          description: string;
          homework_md: string;
          id: string;
          title: string;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          content_md?: string;
          created_at?: string;
          day_number: number;
          description?: string;
          homework_md?: string;
          id?: string;
          title: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          content_md?: string;
          created_at?: string;
          day_number?: number;
          description?: string;
          homework_md?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "student";
      homework_status: "pending" | "approved" | "rejected" | "awaiting_mentor";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
      homework_status: ["pending", "approved", "rejected", "awaiting_mentor"],
    },
  },
} as const;
