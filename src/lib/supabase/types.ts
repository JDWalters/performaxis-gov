export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      appraisal_assessment_meta: {
        Row: {
          appraisal_cycle_id: string
          assessment_date: string | null
          assessment_type: string | null
          chair_signature: string | null
          employee_comments: string | null
          employee_signature: string | null
          employer_comments: string | null
          id: string
          panel_members: string | null
          quarter: number
          updated_at: string
        }
        Insert: {
          appraisal_cycle_id: string
          assessment_date?: string | null
          assessment_type?: string | null
          chair_signature?: string | null
          employee_comments?: string | null
          employee_signature?: string | null
          employer_comments?: string | null
          id?: string
          panel_members?: string | null
          quarter: number
          updated_at?: string
        }
        Update: {
          appraisal_cycle_id?: string
          assessment_date?: string | null
          assessment_type?: string | null
          chair_signature?: string | null
          employee_comments?: string | null
          employee_signature?: string | null
          employer_comments?: string | null
          id?: string
          panel_members?: string | null
          quarter?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appraisal_assessment_meta_appraisal_cycle_id_fkey"
            columns: ["appraisal_cycle_id"]
            isOneToOne: false
            referencedRelation: "appraisal_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          appraisal_cycle_id: string
          created_at: string
          employee_signatory: string | null
          employer_signatory: string | null
          id: string
          pdf_url: string | null
          sign_date: string | null
          sign_place: string | null
          status: string
        }
        Insert: {
          appraisal_cycle_id: string
          created_at?: string
          employee_signatory?: string | null
          employer_signatory?: string | null
          id?: string
          pdf_url?: string | null
          sign_date?: string | null
          sign_place?: string | null
          status?: string
        }
        Update: {
          appraisal_cycle_id?: string
          created_at?: string
          employee_signatory?: string | null
          employer_signatory?: string | null
          id?: string
          pdf_url?: string | null
          sign_date?: string | null
          sign_place?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_appraisal_cycle_id_fkey"
            columns: ["appraisal_cycle_id"]
            isOneToOne: false
            referencedRelation: "appraisal_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      appraisal_competency_ratings: {
        Row: {
          appraisal_cycle_id: string
          comment: string | null
          competency_id: string
          created_at: string
          id: string
          mgr_rating: number | null
          panel_rating: number | null
          quarter: number
          self_rating: number | null
        }
        Insert: {
          appraisal_cycle_id: string
          comment?: string | null
          competency_id: string
          created_at?: string
          id?: string
          mgr_rating?: number | null
          panel_rating?: number | null
          quarter: number
          self_rating?: number | null
        }
        Update: {
          appraisal_cycle_id?: string
          comment?: string | null
          competency_id?: string
          created_at?: string
          id?: string
          mgr_rating?: number | null
          panel_rating?: number | null
          quarter?: number
          self_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appraisal_competency_ratings_appraisal_cycle_id_fkey"
            columns: ["appraisal_cycle_id"]
            isOneToOne: false
            referencedRelation: "appraisal_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appraisal_competency_ratings_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
        ]
      }
      appraisal_cycles: {
        Row: {
          created_at: string
          employee_id: string
          financial_year_id: string
          id: string
          policy_template_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          financial_year_id: string
          id?: string
          policy_template_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          financial_year_id?: string
          id?: string
          policy_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appraisal_cycles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appraisal_cycles_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appraisal_cycles_policy_template_id_fkey"
            columns: ["policy_template_id"]
            isOneToOne: false
            referencedRelation: "policy_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      appraisal_kpis: {
        Row: {
          annual_target: string | null
          appraisal_cycle_id: string
          baseline: string | null
          calc_config: Json
          created_at: string
          id: string
          kpa: string | null
          name: string
          poe: string | null
          unit_of_measure: string | null
          weight: number
          weight_locked: boolean
        }
        Insert: {
          annual_target?: string | null
          appraisal_cycle_id: string
          baseline?: string | null
          calc_config?: Json
          created_at?: string
          id?: string
          kpa?: string | null
          name: string
          poe?: string | null
          unit_of_measure?: string | null
          weight?: number
          weight_locked?: boolean
        }
        Update: {
          annual_target?: string | null
          appraisal_cycle_id?: string
          baseline?: string | null
          calc_config?: Json
          created_at?: string
          id?: string
          kpa?: string | null
          name?: string
          poe?: string | null
          unit_of_measure?: string | null
          weight?: number
          weight_locked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appraisal_kpis_appraisal_cycle_id_fkey"
            columns: ["appraisal_cycle_id"]
            isOneToOne: false
            referencedRelation: "appraisal_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      appraisal_ratings: {
        Row: {
          actual: string | null
          appraisal_kpi_id: string
          comment: string | null
          corrective_action: string | null
          created_at: string
          evidence_url: string | null
          id: string
          inputs: Json
          mgr_rating: number | null
          na: boolean
          panel_rating: number | null
          quarter: number
          self_rating: number | null
          target_value: string | null
        }
        Insert: {
          actual?: string | null
          appraisal_kpi_id: string
          comment?: string | null
          corrective_action?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          inputs?: Json
          mgr_rating?: number | null
          na?: boolean
          panel_rating?: number | null
          quarter: number
          self_rating?: number | null
          target_value?: string | null
        }
        Update: {
          actual?: string | null
          appraisal_kpi_id?: string
          comment?: string | null
          corrective_action?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          inputs?: Json
          mgr_rating?: number | null
          na?: boolean
          panel_rating?: number | null
          quarter?: number
          self_rating?: number | null
          target_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appraisal_ratings_appraisal_kpi_id_fkey"
            columns: ["appraisal_kpi_id"]
            isOneToOne: false
            referencedRelation: "appraisal_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          org_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      competencies: {
        Row: {
          created_at: string
          driving_text: string | null
          group_name: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          driving_text?: string | null
          group_name?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          driving_text?: string | null
          group_name?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          contract: string | null
          created_at: string
          empno: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          position: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["employee_role"]
        }
        Insert: {
          contract?: string | null
          created_at?: string
          empno?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          position?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
        }
        Update: {
          contract?: string | null
          created_at?: string
          empno?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          position?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          label: string
          org_id: string
          start_year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          label: string
          org_id: string
          start_year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          label?: string
          org_id?: string
          start_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_years_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_library: {
        Row: {
          calc_config: Json
          created_at: string
          description: string | null
          id: string
          idp_ref: string | null
          kpa: string | null
          name: string
          org_id: string
          target_type: string
          unit_of_measure: string | null
        }
        Insert: {
          calc_config?: Json
          created_at?: string
          description?: string | null
          id?: string
          idp_ref?: string | null
          kpa?: string | null
          name: string
          org_id: string
          target_type?: string
          unit_of_measure?: string | null
        }
        Update: {
          calc_config?: Json
          created_at?: string
          description?: string | null
          id?: string
          idp_ref?: string | null
          kpa?: string | null
          name?: string
          org_id?: string
          target_type?: string
          unit_of_measure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_library_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_results: {
        Row: {
          actual: string | null
          comment: string | null
          corrective_action: string | null
          created_at: string
          evidence_url: string | null
          id: string
          inputs: Json
          quarter: number
          scorecard_kpi_id: string
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          actual?: string | null
          comment?: string | null
          corrective_action?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          inputs?: Json
          quarter: number
          scorecard_kpi_id: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          actual?: string | null
          comment?: string | null
          corrective_action?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          inputs?: Json
          quarter?: number
          scorecard_kpi_id?: string
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_results_scorecard_kpi_id_fkey"
            columns: ["scorecard_kpi_id"]
            isOneToOne: false
            referencedRelation: "scorecard_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          created_at: string
          id: string
          quarter: number
          scorecard_kpi_id: string
          target_value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          quarter: number
          scorecard_kpi_id: string
          target_value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          quarter?: number
          scorecard_kpi_id?: string
          target_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_scorecard_kpi_id_fkey"
            columns: ["scorecard_kpi_id"]
            isOneToOne: false
            referencedRelation: "scorecard_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          invited_by: string | null
          org_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["org_kind"]
          metadata: Json
          name: string
          parent_id: string | null
          path: unknown
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["org_kind"]
          metadata?: Json
          name: string
          parent_id?: string | null
          path: unknown
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["org_kind"]
          metadata?: Json
          name?: string
          parent_id?: string | null
          path?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "orgs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      policy_templates: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_locked: boolean
          name: string
          org_id: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_locked?: boolean
          name: string
          org_id: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_locked?: boolean
          name?: string
          org_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          scope_type: Database["public"]["Enums"]["scope_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          scope_type: Database["public"]["Enums"]["scope_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          scope_type?: Database["public"]["Enums"]["scope_type"]
        }
        Relationships: []
      }
      scorecard_kpis: {
        Row: {
          created_at: string
          id: string
          idp_ref: string | null
          kpa: string | null
          kpi_library_id: string | null
          name: string
          ref_code: string | null
          scorecard_id: string
          target_type: string
          unit_of_measure: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          idp_ref?: string | null
          kpa?: string | null
          kpi_library_id?: string | null
          name: string
          ref_code?: string | null
          scorecard_id: string
          target_type?: string
          unit_of_measure?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          idp_ref?: string | null
          kpa?: string | null
          kpi_library_id?: string | null
          name?: string
          ref_code?: string | null
          scorecard_id?: string
          target_type?: string
          unit_of_measure?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_kpis_kpi_library_id_fkey"
            columns: ["kpi_library_id"]
            isOneToOne: false
            referencedRelation: "kpi_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecard_kpis_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecards: {
        Row: {
          created_at: string
          financial_year_id: string
          id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          financial_year_id: string
          id?: string
          org_id: string
        }
        Update: {
          created_at?: string
          financial_year_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecards_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_org_access: { Args: { target_org_id: string }; Returns: boolean }
      has_employee_access: {
        Args: { required_permission: string; target_employee_id: string }
        Returns: boolean
      }
      has_org_access: {
        Args: { required_permission: string; target_org_id: string }
        Returns: boolean
      }
      my_accessible_orgs: {
        Args: never
        Returns: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["org_kind"]
          metadata: Json
          name: string
          parent_id: string | null
          path: unknown
        }[]
        SetofOptions: {
          from: "*"
          to: "orgs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_memberships: {
        Args: never
        Returns: {
          membership_id: string
          org_id: string
          org_kind: Database["public"]["Enums"]["org_kind"]
          org_name: string
          role_name: string
          scope_type: Database["public"]["Enums"]["scope_type"]
        }[]
      }
    }
    Enums: {
      employee_role: "MM" | "DIR" | "STAFF"
      org_kind:
        | "national"
        | "provincial"
        | "district"
        | "municipality"
        | "department"
      scope_type: "node_and_descendants" | "node_only" | "employee_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      employee_role: ["MM", "DIR", "STAFF"],
      org_kind: [
        "national",
        "provincial",
        "district",
        "municipality",
        "department",
      ],
      scope_type: ["node_and_descendants", "node_only", "employee_only"],
    },
  },
} as const
