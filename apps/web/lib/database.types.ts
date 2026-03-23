export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          customer_id: string;
          date: string;
          ends_at: string;
          id: string;
          salon_id: string;
          service_id: string;
          staff_member_id: string;
          status: "pending" | "confirmed" | "cancelled";
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id: string;
          date: string;
          ends_at: string;
          id?: string;
          salon_id: string;
          service_id: string;
          staff_member_id: string;
          status?: "pending" | "confirmed" | "cancelled";
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          customer_id?: string;
          date?: string;
          ends_at?: string;
          id?: string;
          salon_id?: string;
          service_id?: string;
          staff_member_id?: string;
          status?: "pending" | "confirmed" | "cancelled";
        };
      };
      customers: {
        Row: {
          auth_user_id: string;
          created_at: string;
          id: string;
          name: string;
          salon_id: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          id?: string;
          name: string;
          salon_id: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          salon_id?: string;
        };
      };
      salon_post_comments: {
        Row: {
          body: string;
          created_at: string;
          customer_id: string;
          customer_name: string;
          id: string;
          post_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          customer_id?: string;
          customer_name?: string;
          id?: string;
          post_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          customer_id?: string;
          customer_name?: string;
          id?: string;
          post_id?: string;
        };
      };
      salon_post_images: {
        Row: {
          created_at: string;
          id: string;
          image_path: string;
          post_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_path: string;
          post_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_path?: string;
          post_id?: string;
          sort_order?: number;
        };
      };
      salon_post_likes: {
        Row: {
          created_at: string;
          customer_id: string;
          post_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string;
          post_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          post_id?: string;
        };
      };
      salon_vacancy_alerts: {
        Row: {
          appointment_id: string;
          body: string;
          created_at: string;
          created_by: string;
          ends_at: string;
          headline: string;
          id: string;
          salon_id: string;
          service_id: string;
          staff_member_id: string | null;
          starts_at: string;
        };
        Insert: {
          appointment_id: string;
          body: string;
          created_at?: string;
          created_by: string;
          ends_at: string;
          headline: string;
          id?: string;
          salon_id: string;
          service_id: string;
          staff_member_id?: string | null;
          starts_at: string;
        };
        Update: {
          appointment_id?: string;
          body?: string;
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          headline?: string;
          id?: string;
          salon_id?: string;
          service_id?: string;
          staff_member_id?: string | null;
          starts_at?: string;
        };
      };
      salon_business_hours: {
        Row: {
          closes_at: string | null;
          created_at: string;
          is_open: boolean;
          opens_at: string | null;
          salon_id: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          closes_at?: string | null;
          created_at?: string;
          is_open?: boolean;
          opens_at?: string | null;
          salon_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          closes_at?: string | null;
          created_at?: string;
          is_open?: boolean;
          opens_at?: string | null;
          salon_id?: string;
          updated_at?: string;
          weekday?: number;
        };
      };
      staff_blocks: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          salon_id: string;
          staff_member_id: string;
          starts_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          salon_id: string;
          staff_member_id: string;
          starts_at: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          salon_id?: string;
          staff_member_id?: string;
          starts_at?: string;
        };
      };
      staff_members: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
          role: string | null;
          salon_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name: string;
          role?: string | null;
          salon_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          role?: string | null;
          salon_id?: string;
          updated_at?: string;
        };
      };
      staff_service_assignments: {
        Row: {
          created_at: string;
          service_id: string;
          staff_member_id: string;
        };
        Insert: {
          created_at?: string;
          service_id: string;
          staff_member_id: string;
        };
        Update: {
          created_at?: string;
          service_id?: string;
          staff_member_id?: string;
        };
      };
      salon_posts: {
        Row: {
          caption: string | null;
          created_at: string;
          created_by_user_id: string;
          id: string;
          image_path: string;
          salon_id: string;
          service_id: string | null;
          title: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          created_by_user_id?: string;
          id?: string;
          image_path: string;
          salon_id: string;
          service_id?: string | null;
          title: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          created_by_user_id?: string;
          id?: string;
          image_path?: string;
          salon_id?: string;
          service_id?: string | null;
          title?: string;
        };
      };
      salons: {
        Row: {
          brand_color: string;
          created_at: string;
          id: string;
          join_code: string;
          logo_path: string | null;
          name: string;
          owner_user_id: string;
          slot_step_minutes: number;
          tagline: string | null;
          timezone: string;
          updated_at: string;
          whatsapp_phone: string | null;
        };
        Insert: {
          brand_color?: string;
          created_at?: string;
          id?: string;
          join_code?: string;
          logo_path?: string | null;
          name: string;
          owner_user_id: string;
          slot_step_minutes?: number;
          tagline?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
        Update: {
          brand_color?: string;
          created_at?: string;
          id?: string;
          join_code?: string;
          logo_path?: string | null;
          name?: string;
          owner_user_id?: string;
          slot_step_minutes?: number;
          tagline?: string | null;
          timezone?: string;
          updated_at?: string;
          whatsapp_phone?: string | null;
        };
      };
      services: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          duration: number;
          id: string;
          image_path: string | null;
          name: string;
          price: number;
          salon_id: string;
          sort_order: number;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description?: string | null;
          duration: number;
          id?: string;
          image_path?: string | null;
          name: string;
          price: number;
          salon_id: string;
          sort_order?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          duration?: number;
          id?: string;
          image_path?: string | null;
          name?: string;
          price?: number;
          salon_id?: string;
          sort_order?: number;
        };
      };
    };
    Functions: {
      cancel_appointment: {
        Args: {
          appointment_uuid: string;
          cancellation_reason_input?: string | null;
        };
        Returns: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          customer_id: string;
          date: string;
          ends_at: string;
          id: string;
          salon_id: string;
          service_id: string;
          staff_member_id: string;
          status: "pending" | "confirmed" | "cancelled";
        };
      };
      create_staff_block: {
        Args: {
          block_reason?: string | null;
          local_end: string;
          local_start: string;
          staff_member_uuid: string;
        };
        Returns: {
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          salon_id: string;
          staff_member_id: string;
          starts_at: string;
        };
      };
      generate_join_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_day_availability: {
        Args: {
          service_uuid: string;
          target_day: string;
        };
        Returns: Json;
      };
      get_owner_dashboard_intelligence: {
        Args: {
          lapsed_limit_input?: number | null;
          top_customer_limit_input?: number | null;
          top_service_limit_input?: number | null;
        };
        Returns: Json;
      };
      get_smart_schedule_opportunities: {
        Args: {
          target_day?: string | null;
        };
        Returns: Json;
      };
    };
  };
};
