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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          booking_policy_acknowledged_at?: string | null
          booking_policy_snapshot?: string | null
          booking_policy_version?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_confirmation_requested_at?: string | null
          customer_id: string
          customer_presence_confirmed_at?: string | null
          date: string
          deposit_amount?: number
          deposit_customer_reported_paid_at?: string | null
          deposit_customer_reported_paid_via?: string | null
          deposit_customer_reported_reference?: string | null
          deposit_notes?: string | null
          deposit_paid_at?: string | null
          deposit_payment_provider?: string | null
          deposit_payment_provider_charge_id?: string | null
          deposit_payment_provider_error?: string | null
          deposit_payment_provider_invoice_url?: string | null
          deposit_payment_provider_last_synced_at?: string | null
          deposit_payment_provider_payload?: string | null
          deposit_payment_provider_status?: string | null
          deposit_receipt_content_type?: string | null
          deposit_receipt_path?: string | null
          deposit_receipt_uploaded_at?: string | null
          deposit_reminder_sent_at?: string | null
          deposit_status?: string
          ends_at: string
          id?: string
          one_hour_reminder_sent_at?: string | null
          protection_auto_cancel_lead_minutes?: number
          protection_auto_cancel_pending_deposit?: boolean
          protection_auto_cancel_unconfirmed?: boolean
          protection_confirmation_lead_minutes?: number
          protection_confirmation_required?: boolean
          protection_deposit_reminder_lead_hours?: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          booking_policy_acknowledged_at?: string | null
          booking_policy_snapshot?: string | null
          booking_policy_version?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_confirmation_requested_at?: string | null
          customer_id?: string
          customer_presence_confirmed_at?: string | null
          date?: string
          deposit_amount?: number
          deposit_customer_reported_paid_at?: string | null
          deposit_customer_reported_paid_via?: string | null
          deposit_customer_reported_reference?: string | null
          deposit_notes?: string | null
          deposit_paid_at?: string | null
          deposit_payment_provider?: string | null
          deposit_payment_provider_charge_id?: string | null
          deposit_payment_provider_error?: string | null
          deposit_payment_provider_invoice_url?: string | null
          deposit_payment_provider_last_synced_at?: string | null
          deposit_payment_provider_payload?: string | null
          deposit_payment_provider_status?: string | null
          deposit_receipt_content_type?: string | null
          deposit_receipt_path?: string | null
          deposit_receipt_uploaded_at?: string | null
          deposit_reminder_sent_at?: string | null
          deposit_status?: string
          ends_at?: string
          id?: string
          one_hour_reminder_sent_at?: string | null
          protection_auto_cancel_lead_minutes?: number
          protection_auto_cancel_pending_deposit?: boolean
          protection_auto_cancel_unconfirmed?: boolean
          protection_confirmation_lead_minutes?: number
          protection_confirmation_required?: boolean
          protection_deposit_reminder_lead_hours?: number
          salon_id?: string
          service_id?: string
          staff_member_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          appointment_id: string | null
          error_detail: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_status: string
          received_at: string
          salon_id: string
        }
        Insert: {
          appointment_id?: string | null
          error_detail?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          salon_id: string
        }
        Update: {
          appointment_id?: string | null
          error_detail?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_consent_acceptances: {
        Row: {
          accepted_at: string
          accepted_source: string
          consent_kind: string
          consent_version: string
          created_at: string
          customer_id: string
          document_body: string
          document_title: string
          id: string
          salon_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_source?: string
          consent_kind: string
          consent_version: string
          created_at?: string
          customer_id: string
          document_body: string
          document_title: string
          id?: string
          salon_id: string
        }
        Update: {
          accepted_at?: string
          accepted_source?: string
          consent_kind?: string
          consent_version?: string
          created_at?: string
          customer_id?: string
          document_body?: string
          document_title?: string
          id?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consent_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consent_acceptances_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorite_services: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string
          id?: string
          service_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorite_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorite_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorite_staff_members: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          staff_member_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string
          id?: string
          staff_member_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          staff_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorite_staff_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorite_staff_members_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty_transactions: {
        Row: {
          appointment_id: string | null
          cashback_delta: number
          completed_visit_delta: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          loyalty_program_id: string | null
          metadata: Json
          points_delta: number
          salon_id: string
          transaction_kind: string
        }
        Insert: {
          appointment_id?: string | null
          cashback_delta?: number
          completed_visit_delta?: number
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          loyalty_program_id?: string | null
          metadata?: Json
          points_delta?: number
          salon_id: string
          transaction_kind?: string
        }
        Update: {
          appointment_id?: string | null
          cashback_delta?: number
          completed_visit_delta?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          loyalty_program_id?: string | null
          metadata?: Json
          points_delta?: number
          salon_id?: string
          transaction_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_transactions_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "salon_loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_transactions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_membership_redemptions: {
        Row: {
          appointment_id: string
          created_at: string
          customer_id: string
          id: string
          membership_id: string
          notes: string | null
          quantity: number
          redeemed_at: string
          redemption_kind: string
          reversed_at: string | null
          salon_id: string
          service_id: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          customer_id: string
          id?: string
          membership_id: string
          notes?: string | null
          quantity?: number
          redeemed_at?: string
          redemption_kind?: string
          reversed_at?: string | null
          salon_id: string
          service_id?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          membership_id?: string
          notes?: string | null
          quantity?: number
          redeemed_at?: string
          redemption_kind?: string
          reversed_at?: string | null
          salon_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_membership_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_membership_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_membership_redemptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "customer_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_membership_redemptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_membership_redemptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_memberships: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          notes: string | null
          offer_id: string | null
          price_snapshot: number | null
          salon_id: string
          service_id: string | null
          service_name_snapshot: string
          sessions_included: number
          sessions_used: number
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          notes?: string | null
          offer_id?: string | null
          price_snapshot?: number | null
          salon_id: string
          service_id?: string | null
          service_name_snapshot: string
          sessions_included: number
          sessions_used?: number
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          notes?: string | null
          offer_id?: string | null
          price_snapshot?: number | null
          salon_id?: string
          service_id?: string | null
          service_name_snapshot?: string
          sessions_included?: number
          sessions_used?: number
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "salon_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memberships_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notification_receipts: {
        Row: {
          archived_at: string | null
          customer_id: string
          read_at: string
          source_id: string
          source_type: string
        }
        Insert: {
          archived_at?: string | null
          customer_id: string
          read_at?: string
          source_id: string
          source_type: string
        }
        Update: {
          archived_at?: string | null
          customer_id?: string
          read_at?: string
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_push_tokens: {
        Row: {
          auth_user_id: string
          created_at: string
          customer_id: string
          device_label: string | null
          device_platform: string
          id: string
          is_active: boolean
          last_seen_at: string
          salon_id: string
          token: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          customer_id: string
          device_label?: string | null
          device_platform: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          salon_id: string
          token: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          customer_id?: string
          device_label?: string | null
          device_platform?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          salon_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_push_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_push_tokens_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          allergies: string | null
          asaas_customer_id: string | null
          asaas_customer_synced_at: string | null
          auth_user_id: string
          beauty_goals: string | null
          beauty_products: string | null
          consent_signed_at: string | null
          consent_status: string
          consent_version: string | null
          contraindications: string | null
          created_at: string
          crm_label: string | null
          id: string
          internal_notes: string | null
          last_assessment_at: string | null
          name: string
          phone: string | null
          preferences: string | null
          referral_code: string | null
          referred_by_customer_id: string | null
          salon_id: string
          technical_notes: string | null
        }
        Insert: {
          allergies?: string | null
          asaas_customer_id?: string | null
          asaas_customer_synced_at?: string | null
          auth_user_id: string
          beauty_goals?: string | null
          beauty_products?: string | null
          consent_signed_at?: string | null
          consent_status?: string
          consent_version?: string | null
          contraindications?: string | null
          created_at?: string
          crm_label?: string | null
          id?: string
          internal_notes?: string | null
          last_assessment_at?: string | null
          name: string
          phone?: string | null
          preferences?: string | null
          referral_code?: string | null
          referred_by_customer_id?: string | null
          salon_id: string
          technical_notes?: string | null
        }
        Update: {
          allergies?: string | null
          asaas_customer_id?: string | null
          asaas_customer_synced_at?: string | null
          auth_user_id?: string
          beauty_goals?: string | null
          beauty_products?: string | null
          consent_signed_at?: string | null
          consent_status?: string
          consent_version?: string | null
          contraindications?: string | null
          created_at?: string
          crm_label?: string | null
          id?: string
          internal_notes?: string | null
          last_assessment_at?: string | null
          name?: string
          phone?: string | null
          preferences?: string | null
          referral_code?: string | null
          referred_by_customer_id?: string | null
          salon_id?: string
          technical_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_referred_by_customer_id_fkey"
            columns: ["referred_by_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          access_token_ciphertext: string
          auto_publish_owned_posts: boolean
          connection_status: string
          created_at: string
          facebook_page_access_token_ciphertext: string | null
          facebook_page_id: string | null
          facebook_page_name: string | null
          id: string
          import_story_mentions: boolean
          instagram_user_id: string
          instagram_username: string
          last_error: string | null
          last_sync_at: string | null
          last_webhook_at: string | null
          require_mention_approval: boolean
          salon_id: string
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          auto_publish_owned_posts?: boolean
          connection_status?: string
          created_at?: string
          facebook_page_access_token_ciphertext?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          import_story_mentions?: boolean
          instagram_user_id: string
          instagram_username: string
          last_error?: string | null
          last_sync_at?: string | null
          last_webhook_at?: string | null
          require_mention_approval?: boolean
          salon_id: string
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          auto_publish_owned_posts?: boolean
          connection_status?: string
          created_at?: string
          facebook_page_access_token_ciphertext?: string | null
          facebook_page_id?: string | null
          facebook_page_name?: string | null
          id?: string
          import_story_mentions?: boolean
          instagram_user_id?: string
          instagram_username?: string
          last_error?: string | null
          last_sync_at?: string | null
          last_webhook_at?: string | null
          require_mention_approval?: boolean
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_mentions: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          author_username: string | null
          caption: string | null
          created_at: string
          dedupe_key: string
          external_media_id: string | null
          id: string
          instagram_connection_id: string | null
          media_type: string
          media_url: string | null
          mentioned_at: string | null
          moderation_note: string | null
          moderation_status: string
          permalink: string | null
          platform: string
          published_at: string | null
          published_post_id: string | null
          salon_id: string
          source_type: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          author_username?: string | null
          caption?: string | null
          created_at?: string
          dedupe_key: string
          external_media_id?: string | null
          id?: string
          instagram_connection_id?: string | null
          media_type?: string
          media_url?: string | null
          mentioned_at?: string | null
          moderation_note?: string | null
          moderation_status?: string
          permalink?: string | null
          platform?: string
          published_at?: string | null
          published_post_id?: string | null
          salon_id: string
          source_type?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          author_username?: string | null
          caption?: string | null
          created_at?: string
          dedupe_key?: string
          external_media_id?: string | null
          id?: string
          instagram_connection_id?: string | null
          media_type?: string
          media_url?: string | null
          mentioned_at?: string | null
          moderation_note?: string | null
          moderation_status?: string
          permalink?: string | null
          platform?: string
          published_at?: string | null
          published_post_id?: string | null
          salon_id?: string
          source_type?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_mentions_instagram_connection_id_fkey"
            columns: ["instagram_connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_mentions_published_post_id_fkey"
            columns: ["published_post_id"]
            isOneToOne: false
            referencedRelation: "salon_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_mentions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_webhook_events: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: string
          instagram_connection_id: string | null
          last_error: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          salon_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          instagram_connection_id?: string | null
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          salon_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          instagram_connection_id?: string | null
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_webhook_events_instagram_connection_id_fkey"
            columns: ["instagram_connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_webhook_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_order_items: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          line_total_amount: number
          order_id: string
          product_brand_snapshot: string | null
          product_id: string | null
          product_image_path: string | null
          product_name_snapshot: string
          quantity: number
          salon_id: string
          unit_price_snapshot: number
          unit_snapshot: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          line_total_amount: number
          order_id: string
          product_brand_snapshot?: string | null
          product_id?: string | null
          product_image_path?: string | null
          product_name_snapshot: string
          quantity: number
          salon_id: string
          unit_price_snapshot: number
          unit_snapshot?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          line_total_amount?: number
          order_id?: string
          product_brand_snapshot?: string | null
          product_id?: string | null
          product_image_path?: string | null
          product_name_snapshot?: string
          quantity?: number
          salon_id?: string
          unit_price_snapshot?: number
          unit_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_order_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_order_items_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_orders: {
        Row: {
          cancelled_at: string | null
          cancellation_reason: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_number: number
          ready_at: string | null
          salon_id: string
          source: string
          status: string
          subtotal_amount: number
          total_items: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_number?: never
          ready_at?: string | null
          salon_id: string
          source?: string
          status?: string
          subtotal_amount?: number
          total_items?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_number?: never
          ready_at?: string | null
          salon_id?: string
          source?: string
          status?: string
          subtotal_amount?: number
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_orders_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          previous_stock: number
          product_id: string
          quantity: number
          reason: string | null
          resulting_stock: number
          salon_id: string
          staff_member_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: string
          previous_stock: number
          product_id: string
          quantity: number
          reason?: string | null
          resulting_stock: number
          salon_id?: string
          staff_member_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          previous_stock?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          resulting_stock?: number
          salon_id?: string
          staff_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_products: {
        Row: {
          brand: string | null
          cost_price: number | null
          created_at: string
          current_stock: number
          description: string | null
          id: string
          image_paths: string[]
          is_active: boolean
          max_purchase_quantity: number
          minimum_stock: number
          name: string
          retail_price: number | null
          salon_id: string
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          image_paths?: string[]
          is_active?: boolean
          max_purchase_quantity?: number
          minimum_stock?: number
          name: string
          retail_price?: number | null
          salon_id?: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          cost_price?: number | null
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          image_paths?: string[]
          is_active?: boolean
          max_purchase_quantity?: number
          minimum_stock?: number
          name?: string
          retail_price?: number | null
          salon_id?: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plan_catalog: {
        Row: {
          created_at: string
          currency_code: string
          description: string
          display_name: string
          id: string
          includes_custom_branding: boolean
          includes_feed_video: boolean
          includes_growth_automation: boolean
          includes_priority_support: boolean
          is_default: boolean
          is_public: boolean
          max_monthly_notifications: number | null
          max_services: number | null
          max_staff_members: number | null
          metadata: Json
          monthly_price: number
          sort_order: number
          trial_days: number
          updated_at: string
          yearly_price: number
        }
        Insert: {
          created_at?: string
          currency_code?: string
          description: string
          display_name: string
          id: string
          includes_custom_branding?: boolean
          includes_feed_video?: boolean
          includes_growth_automation?: boolean
          includes_priority_support?: boolean
          is_default?: boolean
          is_public?: boolean
          max_monthly_notifications?: number | null
          max_services?: number | null
          max_staff_members?: number | null
          metadata?: Json
          monthly_price: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
          yearly_price: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          description?: string
          display_name?: string
          id?: string
          includes_custom_branding?: boolean
          includes_feed_video?: boolean
          includes_growth_automation?: boolean
          includes_priority_support?: boolean
          is_default?: boolean
          is_public?: boolean
          max_monthly_notifications?: number | null
          max_services?: number | null
          max_staff_members?: number | null
          metadata?: Json
          monthly_price?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
          yearly_price?: number
        }
        Relationships: []
      }
      salon_business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          is_open: boolean
          opens_at: string | null
          salon_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          is_open?: boolean
          opens_at?: string | null
          salon_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          is_open?: boolean
          opens_at?: string | null
          salon_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_business_hours_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_customer_notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          customer_id: string | null
          id: string
          notification_type: string
          payload: Json
          salon_id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notification_type: string
          payload?: Json
          salon_id: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          notification_type?: string
          payload?: Json
          salon_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_customer_notifications_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_growth_automation_settings: {
        Row: {
          created_at: string
          is_active: boolean
          salon_id: string
          smart_rebook_body_template: string
          smart_rebook_is_active: boolean
          smart_rebook_title: string
          smart_rebook_window_days: number
          updated_at: string
          winback_body_template: string
          winback_discount_percent: number
          winback_inactive_days: number
          winback_title: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          salon_id: string
          smart_rebook_body_template?: string
          smart_rebook_is_active?: boolean
          smart_rebook_title?: string
          smart_rebook_window_days?: number
          updated_at?: string
          winback_body_template?: string
          winback_discount_percent?: number
          winback_inactive_days?: number
          winback_title?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          salon_id?: string
          smart_rebook_body_template?: string
          smart_rebook_is_active?: boolean
          smart_rebook_title?: string
          smart_rebook_window_days?: number
          updated_at?: string
          winback_body_template?: string
          winback_discount_percent?: number
          winback_inactive_days?: number
          winback_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_growth_automation_settings_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_loyalty_programs: {
        Row: {
          cashback_percent: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          points_per_visit: number
          salon_id: string
          tier_one_discount_percent: number
          tier_one_min_visits: number
          tier_one_name: string
          tier_two_discount_percent: number
          tier_two_min_visits: number
          tier_two_name: string
          title: string
          updated_at: string
          vip_discount_percent: number
          vip_min_visits: number
          vip_reward_service_id: string | null
          vip_tier_name: string
        }
        Insert: {
          cashback_percent?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points_per_visit?: number
          salon_id: string
          tier_one_discount_percent?: number
          tier_one_min_visits?: number
          tier_one_name?: string
          tier_two_discount_percent?: number
          tier_two_min_visits?: number
          tier_two_name?: string
          title?: string
          updated_at?: string
          vip_discount_percent?: number
          vip_min_visits?: number
          vip_reward_service_id?: string | null
          vip_tier_name?: string
        }
        Update: {
          cashback_percent?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          points_per_visit?: number
          salon_id?: string
          tier_one_discount_percent?: number
          tier_one_min_visits?: number
          tier_one_name?: string
          tier_two_discount_percent?: number
          tier_two_min_visits?: number
          tier_two_name?: string
          title?: string
          updated_at?: string
          vip_discount_percent?: number
          vip_min_visits?: number
          vip_reward_service_id?: string | null
          vip_tier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_loyalty_programs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_loyalty_programs_vip_reward_service_id_fkey"
            columns: ["vip_reward_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_offers: {
        Row: {
          created_at: string
          description: string | null
          ends_on: string | null
          highlight_text: string | null
          id: string
          is_active: boolean
          kind: string
          membership_service_id: string | null
          membership_sessions_included: number | null
          membership_validity_days: number | null
          price: number | null
          salon_id: string
          sort_order: number
          starts_on: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          highlight_text?: string | null
          id?: string
          is_active?: boolean
          kind: string
          membership_service_id?: string | null
          membership_sessions_included?: number | null
          membership_validity_days?: number | null
          price?: number | null
          salon_id: string
          sort_order?: number
          starts_on?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          highlight_text?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          membership_service_id?: string | null
          membership_sessions_included?: number | null
          membership_validity_days?: number | null
          price?: number | null
          salon_id?: string
          sort_order?: number
          starts_on?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_offers_membership_service_id_fkey"
            columns: ["membership_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_offers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_post_comments: {
        Row: {
          body: string
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          post_id: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_id?: string
          customer_name?: string
          id?: string
          post_id: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string
          customer_name?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_post_comments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "salon_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_post_images: {
        Row: {
          created_at: string
          id: string
          image_path: string
          post_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          post_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "salon_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_post_likes: {
        Row: {
          created_at: string
          customer_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string
          post_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_post_likes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "salon_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_posts: {
        Row: {
          caption: string | null
          created_at: string
          created_by_user_id: string
          external_author_username: string | null
          external_media_url: string | null
          external_permalink: string | null
          external_platform: string | null
          external_thumbnail_url: string | null
          id: string
          image_path: string
          instagram_mention_id: string | null
          post_type: string
          salon_id: string
          service_id: string | null
          source_type: string
          staff_member_id: string | null
          title: string
          video_path: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by_user_id?: string
          external_author_username?: string | null
          external_media_url?: string | null
          external_permalink?: string | null
          external_platform?: string | null
          external_thumbnail_url?: string | null
          id?: string
          image_path: string
          instagram_mention_id?: string | null
          post_type?: string
          salon_id: string
          service_id?: string | null
          source_type?: string
          staff_member_id?: string | null
          title: string
          video_path?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by_user_id?: string
          external_author_username?: string | null
          external_media_url?: string | null
          external_permalink?: string | null
          external_platform?: string | null
          external_thumbnail_url?: string | null
          id?: string
          image_path?: string
          instagram_mention_id?: string | null
          post_type?: string
          salon_id?: string
          service_id?: string | null
          source_type?: string
          staff_member_id?: string | null
          title?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salon_posts_instagram_mention_id_fkey"
            columns: ["instagram_mention_id"]
            isOneToOne: false
            referencedRelation: "instagram_mentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_posts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_posts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_posts_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_referral_events: {
        Row: {
          created_at: string
          id: string
          invited_customer_id: string
          qualified_at: string | null
          qualifying_appointment_id: string | null
          referral_program_id: string | null
          referrer_customer_id: string
          salon_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_customer_id: string
          qualified_at?: string | null
          qualifying_appointment_id?: string | null
          referral_program_id?: string | null
          referrer_customer_id: string
          salon_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_customer_id?: string
          qualified_at?: string | null
          qualifying_appointment_id?: string | null
          referral_program_id?: string | null
          referrer_customer_id?: string
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_referral_events_invited_customer_id_fkey"
            columns: ["invited_customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_events_qualifying_appointment_id_fkey"
            columns: ["qualifying_appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_events_referral_program_id_fkey"
            columns: ["referral_program_id"]
            isOneToOne: false
            referencedRelation: "salon_referral_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_events_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_events_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_referral_programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          required_qualified_referrals: number
          reward_for_invited: string | null
          reward_for_referrer: string
          reward_service_id: string | null
          salon_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          required_qualified_referrals?: number
          reward_for_invited?: string | null
          reward_for_referrer?: string
          reward_service_id?: string | null
          salon_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          required_qualified_referrals?: number
          reward_for_invited?: string | null
          reward_for_referrer?: string
          reward_service_id?: string | null
          salon_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_referral_programs_reward_service_id_fkey"
            columns: ["reward_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_programs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_referral_reward_unlocks: {
        Row: {
          id: string
          latest_referral_event_id: string | null
          redeemed_at: string | null
          referral_program_id: string | null
          referrer_customer_id: string
          required_qualified_referrals: number
          reward_description: string
          reward_service_id: string | null
          reward_service_name: string | null
          salon_id: string
          status: string
          threshold_reached: number
          unlocked_at: string
        }
        Insert: {
          id?: string
          latest_referral_event_id?: string | null
          redeemed_at?: string | null
          referral_program_id?: string | null
          referrer_customer_id: string
          required_qualified_referrals: number
          reward_description: string
          reward_service_id?: string | null
          reward_service_name?: string | null
          salon_id: string
          status?: string
          threshold_reached: number
          unlocked_at?: string
        }
        Update: {
          id?: string
          latest_referral_event_id?: string | null
          redeemed_at?: string | null
          referral_program_id?: string | null
          referrer_customer_id?: string
          required_qualified_referrals?: number
          reward_description?: string
          reward_service_id?: string | null
          reward_service_name?: string | null
          salon_id?: string
          status?: string
          threshold_reached?: number
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_referral_reward_unlocks_latest_referral_event_id_fkey"
            columns: ["latest_referral_event_id"]
            isOneToOne: false
            referencedRelation: "salon_referral_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_reward_unlocks_referral_program_id_fkey"
            columns: ["referral_program_id"]
            isOneToOne: false
            referencedRelation: "salon_referral_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_reward_unlocks_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_reward_unlocks_reward_service_id_fkey"
            columns: ["reward_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_referral_reward_unlocks_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_subscriptions: {
        Row: {
          activated_at: string | null
          billing_interval: string
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_started_at: string | null
          grace_ends_at: string | null
          id: string
          payment_provider: string | null
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          salon_id: string
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          billing_interval?: string
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_started_at?: string | null
          grace_ends_at?: string | null
          id?: string
          payment_provider?: string | null
          plan_id: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          salon_id: string
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          billing_interval?: string
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_started_at?: string | null
          grace_ends_at?: string | null
          id?: string
          payment_provider?: string | null
          plan_id?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          salon_id?: string
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "saas_plan_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_subscriptions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_vacancy_alerts: {
        Row: {
          appointment_id: string
          body: string
          created_at: string
          created_by: string
          ends_at: string
          headline: string
          id: string
          salon_id: string
          service_id: string
          staff_member_id: string | null
          starts_at: string
        }
        Insert: {
          appointment_id: string
          body: string
          created_at?: string
          created_by: string
          ends_at: string
          headline: string
          id?: string
          salon_id: string
          service_id: string
          staff_member_id?: string | null
          starts_at: string
        }
        Update: {
          appointment_id?: string
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          headline?: string
          id?: string
          salon_id?: string
          service_id?: string
          staff_member_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salon_vacancy_alerts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_vacancy_alerts_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_vacancy_alerts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_vacancy_alerts_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          booking_policy_asaas_api_key: string | null
          booking_policy_asaas_environment: string
          booking_policy_asaas_webhook_token: string | null
          booking_policy_auto_cancel_lead_minutes: number
          booking_policy_auto_cancel_pending_deposit: boolean
          booking_policy_auto_cancel_unconfirmed: boolean
          booking_policy_cancellation_window_hours: number
          booking_policy_confirmation_lead_minutes: number
          booking_policy_confirmation_required: boolean
          booking_policy_deposit_amount: number | null
          booking_policy_deposit_reminder_lead_hours: number
          booking_policy_enabled: boolean
          booking_policy_external_checkout_url: string | null
          booking_policy_payment_instructions: string | null
          booking_policy_payment_mode: string
          booking_policy_pix_key: string | null
          booking_policy_pix_recipient_city: string | null
          booking_policy_pix_recipient_name: string | null
          booking_policy_requires_deposit: boolean
          booking_policy_summary: string | null
          booking_policy_title: string
          booking_policy_version: string
          brand_color: string
          business_segment: string
          client_app_config: Json
          created_at: string
          id: string
          join_code: string
          logo_path: string | null
          name: string
          owner_user_id: string
          slot_step_minutes: number
          tagline: string | null
          timezone: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          booking_policy_asaas_api_key?: string | null
          booking_policy_asaas_environment?: string
          booking_policy_asaas_webhook_token?: string | null
          booking_policy_auto_cancel_lead_minutes?: number
          booking_policy_auto_cancel_pending_deposit?: boolean
          booking_policy_auto_cancel_unconfirmed?: boolean
          booking_policy_cancellation_window_hours?: number
          booking_policy_confirmation_lead_minutes?: number
          booking_policy_confirmation_required?: boolean
          booking_policy_deposit_amount?: number | null
          booking_policy_deposit_reminder_lead_hours?: number
          booking_policy_enabled?: boolean
          booking_policy_external_checkout_url?: string | null
          booking_policy_payment_instructions?: string | null
          booking_policy_payment_mode?: string
          booking_policy_pix_key?: string | null
          booking_policy_pix_recipient_city?: string | null
          booking_policy_pix_recipient_name?: string | null
          booking_policy_requires_deposit?: boolean
          booking_policy_summary?: string | null
          booking_policy_title?: string
          booking_policy_version?: string
          brand_color?: string
          business_segment?: string
          client_app_config?: Json
          created_at?: string
          id?: string
          join_code?: string
          logo_path?: string | null
          name: string
          owner_user_id: string
          slot_step_minutes?: number
          tagline?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          booking_policy_asaas_api_key?: string | null
          booking_policy_asaas_environment?: string
          booking_policy_asaas_webhook_token?: string | null
          booking_policy_auto_cancel_lead_minutes?: number
          booking_policy_auto_cancel_pending_deposit?: boolean
          booking_policy_auto_cancel_unconfirmed?: boolean
          booking_policy_cancellation_window_hours?: number
          booking_policy_confirmation_lead_minutes?: number
          booking_policy_confirmation_required?: boolean
          booking_policy_deposit_amount?: number | null
          booking_policy_deposit_reminder_lead_hours?: number
          booking_policy_enabled?: boolean
          booking_policy_external_checkout_url?: string | null
          booking_policy_payment_instructions?: string | null
          booking_policy_payment_mode?: string
          booking_policy_pix_key?: string | null
          booking_policy_pix_recipient_city?: string | null
          booking_policy_pix_recipient_name?: string | null
          booking_policy_requires_deposit?: boolean
          booking_policy_summary?: string | null
          booking_policy_title?: string
          booking_policy_version?: string
          brand_color?: string
          business_segment?: string
          client_app_config?: Json
          created_at?: string
          id?: string
          join_code?: string
          logo_path?: string | null
          name?: string
          owner_user_id?: string
          slot_step_minutes?: number
          tagline?: string | null
          timezone?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration: number
          id: string
          image_path: string | null
          name: string
          price: number
          salon_id: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration: number
          id?: string
          image_path?: string | null
          name: string
          price: number
          salon_id: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration?: number
          id?: string
          image_path?: string | null
          name?: string
          price?: number
          salon_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          salon_id: string
          staff_member_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          salon_id: string
          staff_member_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          salon_id?: string
          staff_member_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_blocks_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_blocks_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          is_open: boolean
          opens_at: string | null
          staff_member_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          is_open?: boolean
          opens_at?: string | null
          staff_member_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          is_open?: boolean
          opens_at?: string | null
          staff_member_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_business_hours_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          commission_flat_fee: number
          commission_rate_percent: number
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          role: string | null
          salon_id: string
          updated_at: string
        }
        Insert: {
          commission_flat_fee?: number
          commission_rate_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          role?: string | null
          salon_id: string
          updated_at?: string
        }
        Update: {
          commission_flat_fee?: number
          commission_rate_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          role?: string | null
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_service_assignments: {
        Row: {
          created_at: string
          service_id: string
          staff_member_id: string
        }
        Insert: {
          created_at?: string
          service_id: string
          staff_member_id: string
        }
        Update: {
          created_at?: string
          service_id?: string
          staff_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_service_assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_service_assignments_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_customer_operational_consent: {
        Args: { consent_version_input?: string }
        Returns: Json
      }
      align_growth_booking_to_habit: {
        Args: {
          base_booking_at: string
          target_isodow: number
          timezone_input?: string
        }
        Returns: string
      }
      archive_customer_notifications: {
        Args: {
          salon_notification_ids?: string[]
          vacancy_alert_ids?: string[]
        }
        Returns: undefined
      }
      assign_customer_membership_package: {
        Args: {
          customer_uuid: string
          notes_input?: string
          offer_uuid: string
          starts_on_input?: string
        }
        Returns: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          notes: string | null
          offer_id: string | null
          price_snapshot: number | null
          salon_id: string
          service_id: string | null
          service_name_snapshot: string
          sessions_included: number
          sessions_used: number
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_appointment_deposit_receipt: {
        Args: {
          appointment_uuid: string
          receipt_content_type_input?: string
          receipt_path_input: string
        }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      build_loyalty_tiers_snapshot: {
        Args: {
          tier_one_discount_percent_input: number
          tier_one_min_visits_input: number
          tier_one_name_input: string
          tier_two_discount_percent_input: number
          tier_two_min_visits_input: number
          tier_two_name_input: string
          vip_discount_percent_input: number
          vip_min_visits_input: number
          vip_tier_name_input: string
        }
        Returns: Json
      }
      cancel_appointment: {
        Args: { appointment_uuid: string; cancellation_reason_input?: string }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_vacancy_alert: {
        Args: { vacancy_alert_uuid: string }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      combo_target_growth_segment: {
        Args: { base_segment: string }
        Returns: string
      }
      confirm_upcoming_appointment_presence: {
        Args: { appointment_uuid: string }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_customer_membership_package: {
        Args: {
          appointment_uuid: string
          membership_uuid?: string
          notes_input?: string
        }
        Returns: {
          appointment_id: string
          created_at: string
          customer_id: string
          id: string
          membership_id: string
          notes: string | null
          quantity: number
          redeemed_at: string
          redemption_kind: string
          reversed_at: string | null
          salon_id: string
          service_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customer_membership_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_appointment: {
        Args: {
          booking_policy_version_input?: string
          preferred_staff_member_uuid?: string
          requested_date: string
          service_uuid: string
        }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_block: {
        Args: {
          block_reason?: string
          local_end: string
          local_start: string
          staff_member_uuid: string
        }
        Returns: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          salon_id: string
          staff_member_id: string
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vacancy_alert_for_appointment: {
        Args: { actor: string; appointment_uuid: string }
        Returns: {
          appointment_id: string
          body: string
          created_at: string
          created_by: string
          ends_at: string
          headline: string
          id: string
          salon_id: string
          service_id: string
          staff_member_id: string | null
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "salon_vacancy_alerts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_customer_id: { Args: never; Returns: string }
      current_customer_salon_id: { Args: never; Returns: string }
      current_owner_salon_id: { Args: never; Returns: string }
      deactivate_customer_push_token: {
        Args: { input_token: string }
        Returns: undefined
      }
      detect_service_growth_segment: {
        Args: { service_category?: string; service_name: string }
        Returns: string
      }
      format_loyalty_currency_label: {
        Args: { value: number }
        Returns: string
      }
      format_loyalty_number_label: { Args: { value: number }; Returns: string }
      generate_customer_referral_code: { Args: never; Returns: string }
      generate_join_code: { Args: never; Returns: string }
      get_available_slots_for_salon: {
        Args: {
          service_duration: number
          target_day: string
          target_salon_id: string
        }
        Returns: {
          ends_at: string
          start_at: string
        }[]
      }
      get_available_staff_slots_for_service: {
        Args: { service_uuid: string; target_day: string }
        Returns: {
          ends_at: string
          staff_member_id: string
          staff_member_name: string
          start_at: string
        }[]
      }
      get_busy_slots: {
        Args: { target_day: string }
        Returns: {
          date: string
          ends_at: string
        }[]
      }
      get_customer_growth_habit: {
        Args: {
          customer_id_input: string
          salon_timezone_input?: string
          service_segment_input?: string
        }
        Returns: {
          confidence: string
          preferred_hour: number
          preferred_isodow: number
          preferred_period_label: string
          preferred_weekday_label: string
          sample_size: number
        }[]
      }
      get_customer_growth_suggestions: { Args: never; Returns: Json }
      get_customer_loyalty_summary: { Args: never; Returns: Json }
      create_customer_product_order: {
        Args: { items_input: Json; notes_input?: string | null }
        Returns: {
          created_at: string
          order_id: string
          order_number: number
          status: string
          subtotal_amount: number
          total_items: number
        }[]
      }
      get_customer_product_catalog: {
        Args: { limit_count?: number }
        Returns: {
          brand: string | null
          current_stock: number
          description: string | null
          id: string
          image_paths: string[]
          max_purchase_quantity: number
          name: string
          retail_price: number
          unit: string
          updated_at: string
        }[]
      }
      get_customer_referral_summary: { Args: never; Returns: Json }
      get_day_availability: {
        Args: { service_uuid: string; target_day: string }
        Returns: Json
      }
      get_owner_appointment_board: {
        Args: {
          board_status_input?: string
          date_from_input?: string
          date_to_input?: string
          page_input?: number
          page_size_input?: number
          search_input?: string
          staff_member_id_input?: string
        }
        Returns: Json
      }
      get_owner_customer_directory: {
        Args: {
          page_input?: number
          page_size_input?: number
          search_input?: string
          segment_input?: string
          sort_input?: string
        }
        Returns: Json
      }
      get_owner_dashboard_intelligence: {
        Args: {
          lapsed_limit_input?: number
          top_customer_limit_input?: number
          top_service_limit_input?: number
        }
        Returns: Json
      }
      get_owner_operations_dashboard: {
        Args: { days_input?: number; top_staff_limit_input?: number }
        Returns: Json
      }
      update_customer_product_order_status: {
        Args: {
          cancellation_reason_input?: string | null
          order_id_input: string
          status_input: string
        }
        Returns: {
          order_id: string
          order_number: number
          status: string
          updated_at: string
        }[]
      }
      get_salon_growth_automation_dashboard: { Args: never; Returns: Json }
      get_salon_join_preview: {
        Args: { input_join_code: string }
        Returns: {
          brand_color: string
          business_segment: string
          client_app_config: Json
          logo_path: string
          name: string
          salon_id: string
          tagline: string
          whatsapp_phone: string
        }[]
      }
      get_salon_loyalty_dashboard: { Args: never; Returns: Json }
      get_salon_notification_dispatch_snapshot: {
        Args: { notification_ids_input: string[] }
        Returns: {
          deactivated_count: number
          error_detail: string
          failed_count: number
          notification_id: string
          response_status: number
          sent_count: number
          status: string
          updated_at: string
        }[]
      }
      get_salon_schedule_context: {
        Args: { target_day: string; target_salon_id: string }
        Returns: {
          closes_at: string
          closes_at_utc: string
          is_open: boolean
          opens_at: string
          opens_at_utc: string
          salon_id: string
          slot_step_minutes: number
          timezone: string
        }[]
      }
      get_smart_schedule_opportunities: {
        Args: { target_day?: string }
        Returns: Json
      }
      get_staff_schedule_context: {
        Args: { target_day: string; target_staff_member_id: string }
        Returns: {
          closes_at: string
          closes_at_utc: string
          is_open: boolean
          opens_at: string
          opens_at_utc: string
          salon_id: string
          staff_member_id: string
          timezone: string
        }[]
      }
      growth_period_label: { Args: { hour_input: number }; Returns: string }
      infer_service_revisit_interval_days: {
        Args: { service_category?: string; service_name: string }
        Returns: number
      }
      is_customer_of_salon: {
        Args: { target_salon_id: string }
        Returns: boolean
      }
      is_owner_of_salon: { Args: { target_salon_id: string }; Returns: boolean }
      iso_weekday_label: { Args: { day_input: number }; Returns: string }
      join_salon:
        | {
            Args: { customer_name: string; input_join_code: string }
            Returns: {
              allergies: string | null
              asaas_customer_id: string | null
              asaas_customer_synced_at: string | null
              auth_user_id: string
              beauty_goals: string | null
              beauty_products: string | null
              consent_signed_at: string | null
              consent_status: string
              consent_version: string | null
              contraindications: string | null
              created_at: string
              crm_label: string | null
              id: string
              internal_notes: string | null
              last_assessment_at: string | null
              name: string
              phone: string | null
              preferences: string | null
              referral_code: string | null
              referred_by_customer_id: string | null
              salon_id: string
              technical_notes: string | null
            }
            SetofOptions: {
              from: "*"
              to: "customers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              customer_name: string
              input_join_code: string
              referral_code_input: string
            }
            Returns: {
              allergies: string | null
              asaas_customer_id: string | null
              asaas_customer_synced_at: string | null
              auth_user_id: string
              beauty_goals: string | null
              beauty_products: string | null
              consent_signed_at: string | null
              consent_status: string
              consent_version: string | null
              contraindications: string | null
              created_at: string
              crm_label: string | null
              id: string
              internal_notes: string | null
              last_assessment_at: string | null
              name: string
              phone: string | null
              preferences: string | null
              referral_code: string | null
              referred_by_customer_id: string | null
              salon_id: string
              technical_notes: string | null
            }
            SetofOptions: {
              from: "*"
              to: "customers"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      link_customer_identity_by_email: { Args: never; Returns: string }
      mark_appointment_completed: {
        Args: { appointment_uuid: string }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_customer_notifications_read: {
        Args: {
          salon_notification_ids?: string[]
          vacancy_alert_ids?: string[]
        }
        Returns: undefined
      }
      next_loyalty_tier_snapshot: {
        Args: {
          completed_visits_input: number
          tier_one_discount_percent_input: number
          tier_one_min_visits_input: number
          tier_one_name_input: string
          tier_two_discount_percent_input: number
          tier_two_min_visits_input: number
          tier_two_name_input: string
          vip_discount_percent_input: number
          vip_min_visits_input: number
          vip_tier_name_input: string
        }
        Returns: Json
      }
      normalize_growth_text: { Args: { value: string }; Returns: string }
      qualify_referral_from_completed_appointment: {
        Args: { appointment_uuid: string }
        Returns: undefined
      }
      queue_due_appointment_customer_notifications: {
        Args: { run_at?: string }
        Returns: Json
      }
      queue_due_customer_growth_notifications: {
        Args: { run_at?: string }
        Returns: Json
      }
      reconcile_referral_reward_unlocks: {
        Args: {
          latest_event_id?: string
          target_referrer_customer_id: string
          target_salon_id: string
        }
        Returns: {
          id: string
          latest_referral_event_id: string | null
          redeemed_at: string | null
          referral_program_id: string | null
          referrer_customer_id: string
          required_qualified_referrals: number
          reward_description: string
          reward_service_id: string | null
          reward_service_name: string | null
          salon_id: string
          status: string
          threshold_reached: number
          unlocked_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "salon_referral_reward_unlocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reconcile_salon_referral_reward_unlocks: {
        Args: { target_salon_id: string }
        Returns: number
      }
      refresh_customer_membership_usage: {
        Args: { membership_uuid: string }
        Returns: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          notes: string | null
          offer_id: string | null
          price_snapshot: number | null
          salon_id: string
          service_id: string | null
          service_name_snapshot: string
          sessions_included: number
          sessions_used: number
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_customer_push_token: {
        Args: {
          device_label_input?: string
          device_platform_input: string
          input_token: string
        }
        Returns: {
          auth_user_id: string
          created_at: string
          customer_id: string
          device_label: string | null
          device_platform: string
          id: string
          is_active: boolean
          last_seen_at: string
          salon_id: string
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_push_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_inventory_movement: {
        Args: {
          movement_type_input: string
          product_id_input: string
          quantity_input: number
          reason_input?: string
          staff_member_id_input?: string
        }
        Returns: {
          brand: string | null
          cost_price: number | null
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          minimum_stock: number
          name: string
          retail_price: number | null
          salon_id: string
          sku: string | null
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      render_growth_notification_template: {
        Args: {
          discount_percent_input: number
          inactive_days_input: number
          service_name_input: string
          template_input: string
        }
        Returns: string
      }
      render_smart_rebook_template: {
        Args: {
          combo_service_name_input?: string
          days_until_due_input: number
          habit_weekday_input: string
          service_name_input: string
          target_period_input: string
          target_weekday_input: string
          template_input: string
        }
        Returns: string
      }
      report_appointment_deposit_paid: {
        Args: {
          appointment_uuid: string
          payment_method_input?: string
          payment_reference_input?: string
        }
        Returns: {
          booking_policy_acknowledged_at: string | null
          booking_policy_snapshot: string | null
          booking_policy_version: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          customer_confirmation_requested_at: string | null
          customer_id: string
          customer_presence_confirmed_at: string | null
          date: string
          deposit_amount: number
          deposit_customer_reported_paid_at: string | null
          deposit_customer_reported_paid_via: string | null
          deposit_customer_reported_reference: string | null
          deposit_notes: string | null
          deposit_paid_at: string | null
          deposit_payment_provider: string | null
          deposit_payment_provider_charge_id: string | null
          deposit_payment_provider_error: string | null
          deposit_payment_provider_invoice_url: string | null
          deposit_payment_provider_last_synced_at: string | null
          deposit_payment_provider_payload: string | null
          deposit_payment_provider_status: string | null
          deposit_receipt_content_type: string | null
          deposit_receipt_path: string | null
          deposit_receipt_uploaded_at: string | null
          deposit_reminder_sent_at: string | null
          deposit_status: string
          ends_at: string
          id: string
          one_hour_reminder_sent_at: string | null
          protection_auto_cancel_lead_minutes: number
          protection_auto_cancel_pending_deposit: boolean
          protection_auto_cancel_unconfirmed: boolean
          protection_confirmation_lead_minutes: number
          protection_confirmation_required: boolean
          protection_deposit_reminder_lead_hours: number
          salon_id: string
          service_id: string
          staff_member_id: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_loyalty_tier_snapshot: {
        Args: {
          completed_visits_input: number
          tier_one_discount_percent_input: number
          tier_one_min_visits_input: number
          tier_one_name_input: string
          tier_two_discount_percent_input: number
          tier_two_min_visits_input: number
          tier_two_name_input: string
          vip_discount_percent_input: number
          vip_min_visits_input: number
          vip_tier_name_input: string
        }
        Returns: Json
      }
      reverse_customer_membership_package_consumption: {
        Args: { appointment_uuid: string }
        Returns: {
          appointment_id: string
          created_at: string
          customer_id: string
          id: string
          membership_id: string
          notes: string | null
          quantity: number
          redeemed_at: string
          redemption_kind: string
          reversed_at: string | null
          salon_id: string
          service_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customer_membership_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_default_salon_subscription: {
        Args: { target_salon_id: string }
        Returns: {
          activated_at: string | null
          billing_interval: string
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_started_at: string | null
          grace_ends_at: string | null
          id: string
          payment_provider: string | null
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          salon_id: string
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "salon_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_default_staff_member: {
        Args: { target_salon_id: string }
        Returns: string
      }
      seed_salon_business_hours: {
        Args: { target_salon_id: string }
        Returns: undefined
      }
      seed_salon_growth_automation_settings: {
        Args: { target_salon_id: string }
        Returns: undefined
      }
      seed_staff_business_hours: {
        Args: { target_staff_member_id: string }
        Returns: undefined
      }
      update_owner_customer_profile: {
        Args: {
          allergies_input?: string
          beauty_goals_input?: string
          beauty_products_input?: string
          consent_status_input?: string
          contraindications_input?: string
          crm_label_input?: string
          customer_uuid: string
          internal_notes_input?: string
          last_assessment_at_input?: string
          phone_input?: string
          preferences_input?: string
          technical_notes_input?: string
        }
        Returns: {
          allergies: string | null
          asaas_customer_id: string | null
          asaas_customer_synced_at: string | null
          auth_user_id: string
          beauty_goals: string | null
          beauty_products: string | null
          consent_signed_at: string | null
          consent_status: string
          consent_version: string | null
          contraindications: string | null
          created_at: string
          crm_label: string | null
          id: string
          internal_notes: string | null
          last_assessment_at: string | null
          name: string
          phone: string | null
          preferences: string | null
          referral_code: string | null
          referred_by_customer_id: string | null
          salon_id: string
          technical_notes: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_push_dispatch_attempt: {
        Args: {
          deactivated_count_input?: number
          error_detail_input?: string
          failed_count_input?: number
          input_dispatch_id: string
          response_payload_input?: Json
          response_status_input?: number
          sent_count_input?: number
          status_input: string
        }
        Returns: undefined
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "cancelled" | "completed"
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
      appointment_status: ["pending", "confirmed", "cancelled", "completed"],
    },
  },
} as const
