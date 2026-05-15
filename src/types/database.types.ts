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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_trace_events: {
        Row: {
          anon_id: string | null
          created_at: string
          duration_ms: number | null
          env: string | null
          event_type: string
          from_path: string | null
          id: string
          leave_at: string | null
          method: string | null
          path: string | null
          referrer: string | null
          session_id: string | null
          trace_id: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          duration_ms?: number | null
          env?: string | null
          event_type: string
          from_path?: string | null
          id?: string
          leave_at?: string | null
          method?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          trace_id?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          duration_ms?: number | null
          env?: string | null
          event_type?: string
          from_path?: string | null
          id?: string
          leave_at?: string | null
          method?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          trace_id?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          permissions: string[] | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: string[] | null
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          permissions?: string[] | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alipay_accounts: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          payee_account: string
          payee_type: string | null
          real_name: string | null
          updated_at: string | null
          verification_method: string | null
          verified: boolean | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          payee_account: string
          payee_type?: string | null
          real_name?: string | null
          updated_at?: string | null
          verification_method?: string | null
          verified?: boolean | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          payee_account?: string
          payee_type?: string | null
          real_name?: string | null
          updated_at?: string | null
          verification_method?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "alipay_accounts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      alipay_orders: {
        Row: {
          alipay_trade_no: string | null
          created_at: string
          id: string
          order_data: Json | null
          order_type: string | null
          payment_provider: string | null
          product_code: string | null
          qr_code: string | null
          status: string
          subject: string
          total_amount: number
          trade_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alipay_trade_no?: string | null
          created_at?: string
          id?: string
          order_data?: Json | null
          order_type?: string | null
          payment_provider?: string | null
          product_code?: string | null
          qr_code?: string | null
          status?: string
          subject: string
          total_amount: number
          trade_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alipay_trade_no?: string | null
          created_at?: string
          id?: string
          order_data?: Json | null
          order_type?: string | null
          payment_provider?: string | null
          product_code?: string | null
          qr_code?: string | null
          status?: string
          subject?: string
          total_amount?: number
          trade_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alipay_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alipay_withdrawals: {
        Row: {
          alipay_order_id: string | null
          alipay_response: Json | null
          amount: number
          coach_id: string
          created_at: string | null
          fee: number | null
          id: string
          out_biz_no: string | null
          processed_at: string | null
          status: string
          wallet_id: string
        }
        Insert: {
          alipay_order_id?: string | null
          alipay_response?: Json | null
          amount: number
          coach_id: string
          created_at?: string | null
          fee?: number | null
          id?: string
          out_biz_no?: string | null
          processed_at?: string | null
          status?: string
          wallet_id: string
        }
        Update: {
          alipay_order_id?: string | null
          alipay_response?: Json | null
          amount?: number
          coach_id?: string
          created_at?: string | null
          fee?: number | null
          id?: string
          out_biz_no?: string | null
          processed_at?: string | null
          status?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alipay_withdrawals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_actions: {
        Row: {
          aliases: string[] | null
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          aliases?: string[] | null
          category?: string | null
          created_at?: string | null
          id: string
          name: string
        }
        Update: {
          aliases?: string[] | null
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          coach_id: string
          coach_name: string
          created_at: string
          duration_months: number
          id: string
          price: number
          product_id: string
          product_name: string
          product_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          coach_name: string
          created_at?: string
          duration_months: number
          id?: string
          price: number
          product_id: string
          product_name: string
          product_tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          coach_name?: string
          created_at?: string
          duration_months?: number
          id?: string
          price?: number
          product_id?: string
          product_name?: string
          product_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          content_metadata: Json | null
          created_at: string | null
          duration: number | null
          file_name: string | null
          file_size: number | null
          id: string
          is_read: boolean | null
          media_url: string | null
          message_type: string
          room_id: string
          sender_id: string
        }
        Insert: {
          content: string
          content_metadata?: Json | null
          created_at?: string | null
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type: string
          room_id: string
          sender_id: string
        }
        Update: {
          content?: string
          content_metadata?: Json | null
          created_at?: string | null
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_unreads: {
        Row: {
          last_read_at: string | null
          room_id: string
          unread_count: number
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          room_id: string
          unread_count?: number
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          room_id?: string
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_unreads_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          last_message: string | null
          last_message_at: string | null
          members: string[] | null
          subscription_id: string | null
          type: string | null
          unread_members: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message?: string | null
          last_message_at?: string | null
          members?: string[] | null
          subscription_id?: string | null
          type?: string | null
          unread_members?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message?: string | null
          last_message_at?: string | null
          members?: string[] | null
          subscription_id?: string | null
          type?: string | null
          unread_members?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "coach_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_actions: {
        Row: {
          attrs: string[] | null
          canonical_action_id: string | null
          coach_id: string
          created_at: string
          detail: string | null
          enableAutoWeightCompute: boolean | null
          id: string
          includesBodyWeight: boolean | null
          item_schema: Json | null
          name: string
          positions: string[] | null
          suggested_time: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          coach_id: string
          created_at?: string
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          name: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          coach_id?: string
          created_at?: string
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          name?: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_actions_canonical_action_id_fkey"
            columns: ["canonical_action_id"]
            isOneToOne: false
            referencedRelation: "canonical_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_actions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_applications: {
        Row: {
          achievements: string[] | null
          address: string | null
          applied_at: string
          avatar_url: string | null
          bio: string | null
          case_studies: string[] | null
          coach_track: string
          contact_email: string | null
          contact_phone: string | null
          county: string | null
          created_at: string
          credentials: Json[] | null
          city: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          portfolio_url: string | null
          province: string | null
          resume_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_modes: string[]
          social_links: Json | null
          specialties: string[] | null
          status: string
          support_focus: string | null
          teaching_philosophy: string | null
          title: string | null
          target_student_levels: string[]
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          achievements?: string[] | null
          address?: string | null
          applied_at?: string
          avatar_url?: string | null
          bio?: string | null
          case_studies?: string[] | null
          coach_track?: string
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          credentials?: Json[] | null
          city?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          portfolio_url?: string | null
          province?: string | null
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_modes?: string[]
          social_links?: Json | null
          specialties?: string[] | null
          status?: string
          support_focus?: string | null
          teaching_philosophy?: string | null
          title?: string | null
          target_student_levels?: string[]
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          achievements?: string[] | null
          address?: string | null
          applied_at?: string
          avatar_url?: string | null
          bio?: string | null
          case_studies?: string[] | null
          coach_track?: string
          contact_email?: string | null
          contact_phone?: string | null
          county?: string | null
          created_at?: string
          credentials?: Json[] | null
          city?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          portfolio_url?: string | null
          province?: string | null
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_modes?: string[]
          social_links?: Json | null
          specialties?: string[] | null
          status?: string
          support_focus?: string | null
          teaching_philosophy?: string | null
          title?: string | null
          target_student_levels?: string[]
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_contents: {
        Row: {
          coach_id: string
          column_id: string | null
          column_sort_order: number | null
          comments_count: number | null
          content: string
          content_type: string
          created_at: string | null
          id: string
          is_featured: boolean | null
          likes_count: number | null
          media_urls: string[] | null
          price_cents: number
          required_tier: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          coach_id: string
          column_id?: string | null
          column_sort_order?: number | null
          comments_count?: number | null
          content: string
          content_type: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          price_cents?: number
          required_tier?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          coach_id?: string
          column_id?: string | null
          column_sort_order?: number | null
          comments_count?: number | null
          content?: string
          content_type?: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          price_cents?: number
          required_tier?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_contents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_contents_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "coach_content_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_content_columns: {
        Row: {
          coach_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_visible: boolean
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          coach_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          coach_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_content_columns_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      content_purchases: {
        Row: {
          content_id: string
          created_at: string
          id: string
          order_id: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_purchases_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "coach_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "alipay_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_plan_instances: {
        Row: {
          coach_id: string | null
          coach_plan_template_id: string | null
          coach_subscription_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          execution_notice: string | null
          id: string
          name: string
          rest_days_count: number | null
          source: string | null
          start_date: string | null
          start_execution_day: number | null
          status: string | null
          student_id: string | null
          suitable_for: string | null
          tags: string[] | null
          training_days: Json
          training_days_count: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id?: string | null
          coach_plan_template_id?: string | null
          coach_subscription_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          execution_notice?: string | null
          id?: string
          name: string
          rest_days_count?: number | null
          source?: string | null
          start_date?: string | null
          start_execution_day?: number | null
          status?: string | null
          student_id?: string | null
          suitable_for?: string | null
          tags?: string[] | null
          training_days: Json
          training_days_count?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string | null
          coach_plan_template_id?: string | null
          coach_subscription_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          execution_notice?: string | null
          id?: string
          name?: string
          rest_days_count?: number | null
          source?: string | null
          start_date?: string | null
          start_execution_day?: number | null
          status?: string | null
          student_id?: string | null
          suitable_for?: string | null
          tags?: string[] | null
          training_days?: Json
          training_days_count?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_plan_instances_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_plan_instances_coach_subscription_id_fkey"
            columns: ["coach_subscription_id"]
            isOneToOne: false
            referencedRelation: "coach_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_plan_instances_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_plan_template"
            columns: ["coach_plan_template_id"]
            isOneToOne: false
            referencedRelation: "coach_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_plan_templates: {
        Row: {
          coach_id: string
          contained_options: string[] | null
          created_at: string | null
          description: string | null
          execution_notice: string | null
          global_answers: Json | null
          id: string
          name: string
          rest_days_count: number | null
          suitable_for: string | null
          tags: string[] | null
          training_days: Json[] | null
          training_days_count: number | null
          type: string
          updated_at: string | null
          week_days: number[] | null
        }
        Insert: {
          coach_id: string
          contained_options?: string[] | null
          created_at?: string | null
          description?: string | null
          execution_notice?: string | null
          global_answers?: Json | null
          id?: string
          name: string
          rest_days_count?: number | null
          suitable_for?: string | null
          tags?: string[] | null
          training_days?: Json[] | null
          training_days_count?: number | null
          type: string
          updated_at?: string | null
          week_days?: number[] | null
        }
        Update: {
          coach_id?: string
          contained_options?: string[] | null
          created_at?: string | null
          description?: string | null
          execution_notice?: string | null
          global_answers?: Json | null
          id?: string
          name?: string
          rest_days_count?: number | null
          suitable_for?: string | null
          tags?: string[] | null
          training_days?: Json[] | null
          training_days_count?: number | null
          type?: string
          updated_at?: string | null
          week_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_plan_templates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_posters: {
        Row: {
          coach_id: string
          created_at: string
          generation_finished_at: string | null
          generation_started_at: string | null
          id: string
          image_meta: Json
          image_url: string | null
          last_error: string | null
          poster_type: string
          requested_at: string
          requested_by: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          generation_finished_at?: string | null
          generation_started_at?: string | null
          id?: string
          image_meta?: Json
          image_url?: string | null
          last_error?: string | null
          poster_type?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          generation_finished_at?: string | null
          generation_started_at?: string | null
          id?: string
          image_meta?: Json
          image_url?: string | null
          last_error?: string | null
          poster_type?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_posters_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_pricing: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          pricings: Json
          products: Json | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          pricings?: Json
          products?: Json | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          pricings?: Json
          products?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_pricing_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_questionnaires: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean
          name: string
          questions: Json
          status: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean
          name?: string
          questions: Json
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean
          name?: string
          questions?: Json
          status?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_questionnaires_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reviews: {
        Row: {
          coach_id: string | null
          coach_subscription_id: string
          created_at: string | null
          id: string
          media_urls: string[] | null
          review_text: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id?: string | null
          coach_subscription_id: string
          created_at?: string | null
          id?: string
          media_urls?: string[] | null
          review_text?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string | null
          coach_subscription_id?: string
          created_at?: string | null
          id?: string
          media_urls?: string[] | null
          review_text?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_reviews_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_coach_subscription"
            columns: ["coach_subscription_id"]
            isOneToOne: false
            referencedRelation: "coach_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_rulepacks: {
        Row: {
          coach_id: string
          config_json: Json
          created_at: string | null
          description: string | null
          domain: string
          form_schema: Json
          id: string
          is_active: boolean | null
          key: string
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          coach_id: string
          config_json: Json
          created_at?: string | null
          description?: string | null
          domain: string
          form_schema: Json
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          updated_at?: string | null
          version?: string
        }
        Update: {
          coach_id?: string
          config_json?: Json
          created_at?: string | null
          description?: string | null
          domain?: string
          form_schema?: Json
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_rulepacks_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_subscriptions: {
        Row: {
          auto_renew: boolean | null
          coach_id: string
          coach_seen_at: string | null
          created_at: string | null
          end_date: string | null
          has_remind_coach: boolean | null
          id: string
          last_payment_order_id: string | null
          monthly_price: number
          order_id: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_data: Json | null
          payment_method: string | null
          prior_training_weeks: number | null
          product_id: string | null
          product_name: string | null
          product_tier: string | null
          remind_coach_note: string | null
          start_date: string | null
          status: string | null
          student_id: string
          subscribe_data: Json | null
          subscribed_weeks: number | null
          tier: number
          updated_at: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          coach_id: string
          coach_seen_at?: string | null
          created_at?: string | null
          end_date?: string | null
          has_remind_coach?: boolean | null
          id?: string
          last_payment_order_id?: string | null
          monthly_price: number
          order_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_data?: Json | null
          payment_method?: string | null
          prior_training_weeks?: number | null
          product_id?: string | null
          product_name?: string | null
          product_tier?: string | null
          remind_coach_note?: string | null
          start_date?: string | null
          status?: string | null
          student_id: string
          subscribe_data?: Json | null
          subscribed_weeks?: number | null
          tier: number
          updated_at?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          coach_id?: string
          coach_seen_at?: string | null
          created_at?: string | null
          end_date?: string | null
          has_remind_coach?: boolean | null
          id?: string
          last_payment_order_id?: string | null
          monthly_price?: number
          order_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_data?: Json | null
          payment_method?: string | null
          prior_training_weeks?: number | null
          product_id?: string | null
          product_name?: string | null
          product_tier?: string | null
          remind_coach_note?: string | null
          start_date?: string | null
          status?: string | null
          student_id?: string
          subscribe_data?: Json | null
          subscribed_weeks?: number | null
          tier?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_wallets: {
        Row: {
          balance: number | null
          coach_id: string
          created_at: string | null
          frozen_amount: number | null
          total_income: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          coach_id: string
          created_at?: string | null
          frozen_amount?: number | null
          total_income?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          coach_id?: string
          created_at?: string | null
          frozen_amount?: number | null
          total_income?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_wallets_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          achievements: string[] | null
          address: string | null
          allow_personal_qrcode: boolean | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          coach_track: string
          county: string | null
          created_at: string | null
          id: string
          invitation_code: string | null
          invitation_mode: string | null
          is_featured: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          payment_mode: string | null
          payment_qr_codes: Json | null
          profile: Json | null
          province: string | null
          rating: number | null
          search_vector: unknown
          service_modes: string[]
          specialties: string[] | null
          status: string | null
          support_focus: string | null
          title: string | null
          target_student_levels: string[]
          total_students: number | null
          updated_at: string | null
          user_id: string | null
          years_experience: number | null
        }
        Insert: {
          achievements?: string[] | null
          address?: string | null
          allow_personal_qrcode?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          coach_track?: string
          county?: string | null
          created_at?: string | null
          id?: string
          invitation_code?: string | null
          invitation_mode?: string | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          payment_mode?: string | null
          payment_qr_codes?: Json | null
          profile?: Json | null
          province?: string | null
          rating?: number | null
          search_vector?: unknown
          service_modes?: string[]
          specialties?: string[] | null
          status?: string | null
          support_focus?: string | null
          title?: string | null
          target_student_levels?: string[]
          total_students?: number | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
        }
        Update: {
          achievements?: string[] | null
          address?: string | null
          allow_personal_qrcode?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          coach_track?: string
          county?: string | null
          created_at?: string | null
          id?: string
          invitation_code?: string | null
          invitation_mode?: string | null
          is_featured?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          payment_mode?: string | null
          payment_qr_codes?: Json | null
          profile?: Json | null
          province?: string | null
          rating?: number | null
          search_vector?: unknown
          service_modes?: string[]
          specialties?: string[] | null
          status?: string | null
          support_focus?: string | null
          title?: string | null
          target_student_levels?: string[]
          total_students?: number | null
          updated_at?: string | null
          user_id?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_action_likes: {
        Row: {
          action_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_action_likes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "community_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_action_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_actions: {
        Row: {
          attrs: string[] | null
          canonical_action_id: string | null
          contributor_user_id: string
          created_at: string | null
          detail: string | null
          enableAutoWeightCompute: boolean | null
          id: string
          includesBodyWeight: boolean | null
          item_schema: Json | null
          like_count: number
          name: string
          positions: string[] | null
          suggested_time: string | null
          type: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          contributor_user_id: string
          created_at?: string | null
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          like_count?: number
          name: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          contributor_user_id?: string
          created_at?: string | null
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          like_count?: number
          name?: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_actions_canonical_action_id_fkey"
            columns: ["canonical_action_id"]
            isOneToOne: false
            referencedRelation: "canonical_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_actions_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_interactions: {
        Row: {
          comment_content: string | null
          content_id: string
          created_at: string | null
          id: string
          interaction_type: string
          user_id: string
        }
        Insert: {
          comment_content?: string | null
          content_id: string
          created_at?: string | null
          id?: string
          interaction_type: string
          user_id: string
        }
        Update: {
          comment_content?: string | null
          content_id?: string
          created_at?: string | null
          id?: string
          interaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_interactions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "coach_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_set_videos: {
        Row: {
          action_id: string
          coach_feedback: string | null
          coach_rating: number | null
          created_at: string
          duration_seconds: number | null
          execution_id: string
          exercise_name: string | null
          file_size_bytes: number | null
          id: string
          requires_review: boolean | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          set_number: number
          storage_bucket: string | null
          storage_path: string
          thumbnail_url: string | null
          upload_status: string | null
          user_notes: string | null
          video_url: string
        }
        Insert: {
          action_id: string
          coach_feedback?: string | null
          coach_rating?: number | null
          created_at?: string
          duration_seconds?: number | null
          execution_id: string
          exercise_name?: string | null
          file_size_bytes?: number | null
          id?: string
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          set_number: number
          storage_bucket?: string | null
          storage_path: string
          thumbnail_url?: string | null
          upload_status?: string | null
          user_notes?: string | null
          video_url: string
        }
        Update: {
          action_id?: string
          coach_feedback?: string | null
          coach_rating?: number | null
          created_at?: string
          duration_seconds?: number | null
          execution_id?: string
          exercise_name?: string | null
          file_size_bytes?: number | null
          id?: string
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          set_number?: number
          storage_bucket?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          upload_status?: string | null
          user_notes?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_set_videos_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "plan_instance_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_set_videos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_releases: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          release_date: string
          target_users: string | null
          tracked_events: string[]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          release_date: string
          target_users?: string | null
          tracked_events: string[]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          release_date?: string
          target_users?: string | null
          tracked_events?: string[]
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          content: string
          created_at: string | null
          id: string
          related_question: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          related_question?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          related_question?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_share_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json
          share_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          share_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "growth_share_events_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "growth_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_share_links: {
        Row: {
          created_at: string
          creator_user_id: string
          execution_id: string | null
          expires_at: string | null
          id: string
          meta: Json
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          execution_id?: string | null
          expires_at?: string | null
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "growth_share_links_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_share_links_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "plan_instance_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_books: {
        Row: {
          audio_url: string | null
          author: string | null
          content: Json
          cover_image: string | null
          created_at: string | null
          id: string
          is_free: boolean | null
          is_published: boolean | null
          sort_order: number | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          author?: string | null
          content: Json
          cover_image?: string | null
          created_at?: string | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          sort_order?: number | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          author?: string | null
          content?: Json
          cover_image?: string | null
          created_at?: string | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          sort_order?: number | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          last_position: Json | null
          progress: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          last_position?: Json | null
          progress?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          last_position?: Json | null
          progress?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_subscriptions: {
        Row: {
          ai_quota_reset_at: string | null
          ai_quota_used: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          plan: string
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          ai_quota_reset_at?: string | null
          ai_quota_used?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          plan?: string
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          ai_quota_reset_at?: string | null
          ai_quota_used?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          plan?: string
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "alipay_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_videos: {
        Row: {
          content: Json | null
          cover_image: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_free: boolean | null
          is_published: boolean | null
          sort_order: number | null
          source: string | null
          source_url: string | null
          summary: string | null
          title: string
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          cover_image?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          cover_image?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          sort_order?: number | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          created_at: string | null
          evidence_url: string | null
          extra_data: Json | null
          form_data: Json
          id: string
          note: string | null
          score: number | null
          status: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          evidence_url?: string | null
          extra_data?: Json | null
          form_data: Json
          id?: string
          note?: string | null
          score?: number | null
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          evidence_url?: string | null
          extra_data?: Json | null
          form_data?: Json
          id?: string
          note?: string | null
          score?: number | null
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_templates: {
        Row: {
          created_at: string | null
          creator_id: string | null
          description: string | null
          end_at: string | null
          form_schema: Json | null
          id: string
          initiator: string | null
          needReview: boolean | null
          rank_by_field: string
          remarks: string | null
          rules: Json | null
          sort_order: string | null
          start_at: string | null
          title: string
          type: string | null
          video_storage_bucket: string | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          end_at?: string | null
          form_schema?: Json | null
          id?: string
          initiator?: string | null
          needReview?: boolean | null
          rank_by_field: string
          remarks?: string | null
          rules?: Json | null
          sort_order?: string | null
          start_at?: string | null
          title: string
          type?: string | null
          video_storage_bucket?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          end_at?: string | null
          form_schema?: Json | null
          id?: string
          initiator?: string | null
          needReview?: boolean | null
          rank_by_field?: string
          remarks?: string | null
          rules?: Json | null
          sort_order?: string | null
          start_at?: string | null
          title?: string
          type?: string | null
          video_storage_bucket?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_templates_creator_id_fkey1"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lifestyle_logs: {
        Row: {
          created_at: string | null
          diet_notes: string | null
          id: string
          log_date: string
          meal_photos: string[] | null
          sleep_hours: number | null
          sleep_quality: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          diet_notes?: string | null
          id?: string
          log_date: string
          meal_photos?: string[] | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          diet_notes?: string | null
          id?: string
          log_date?: string
          meal_photos?: string[] | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifestyle_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questionnaires: {
        Row: {
          answers: Json
          baseline_video_urls: string[] | null
          coach_id: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answers: Json
          baseline_video_urls?: string[] | null
          coach_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          baseline_video_urls?: string[] | null
          coach_id?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_questionnaires_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_questionnaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          alipay_account: string
          amount: number
          coach_id: string | null
          created_at: string | null
          id: string
          paid_at: string | null
          real_name: string
          status: string | null
          transaction_no: string | null
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          alipay_account: string
          amount: number
          coach_id?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          real_name: string
          status?: string | null
          transaction_no?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          alipay_account?: string
          amount?: number
          coach_id?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          real_name?: string
          status?: string | null
          transaction_no?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_records_history: {
        Row: {
          action_id: string | null
          created_at: string | null
          date_achieved: string
          e1rm: number | null
          estimated_from: Json | null
          execution_id: string | null
          execution_set_number: number | null
          exercise_name: string
          id: string
          is_auto_calculated: boolean | null
          is_verified: boolean | null
          load_formula: string | null
          notes: string | null
          reps: number | null
          source_coach_id: string | null
          source_type: string | null
          user_id: string
          video_url: string | null
          weight: number | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string | null
          date_achieved: string
          e1rm?: number | null
          estimated_from?: Json | null
          execution_id?: string | null
          execution_set_number?: number | null
          exercise_name: string
          id?: string
          is_auto_calculated?: boolean | null
          is_verified?: boolean | null
          load_formula?: string | null
          notes?: string | null
          reps?: number | null
          source_coach_id?: string | null
          source_type?: string | null
          user_id: string
          video_url?: string | null
          weight?: number | null
        }
        Update: {
          action_id?: string | null
          created_at?: string | null
          date_achieved?: string
          e1rm?: number | null
          estimated_from?: Json | null
          execution_id?: string | null
          execution_set_number?: number | null
          exercise_name?: string
          id?: string
          is_auto_calculated?: boolean | null
          is_verified?: boolean | null
          load_formula?: string | null
          notes?: string | null
          reps?: number | null
          source_coach_id?: string | null
          source_type?: string | null
          user_id?: string
          video_url?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_history_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "plan_instance_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_instance_executions: {
        Row: {
          action_executions: Json
          completed_at: string | null
          completed_sets: number
          created_at: string
          day_index: number
          id: string
          instance_id: string
          last_saved_at: string | null
          progress_percent: number | null
          session_notes: string | null
          share_token: string | null
          started_at: string
          status: string
          student_id: string
          total_sets: number
          updated_at: string
          visibility: string | null
        }
        Insert: {
          action_executions?: Json
          completed_at?: string | null
          completed_sets?: number
          created_at?: string
          day_index: number
          id?: string
          instance_id: string
          last_saved_at?: string | null
          progress_percent?: number | null
          session_notes?: string | null
          share_token?: string | null
          started_at?: string
          status?: string
          student_id: string
          total_sets?: number
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          action_executions?: Json
          completed_at?: string | null
          completed_sets?: number
          created_at?: string
          day_index?: number
          id?: string
          instance_id?: string
          last_saved_at?: string | null
          progress_percent?: number | null
          session_notes?: string | null
          share_token?: string | null
          started_at?: string
          status?: string
          student_id?: string
          total_sets?: number
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_instance_executions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "coach_plan_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_instance_executions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      promotion_submissions: {
        Row: {
          admin_feedback: string | null
          created_at: string | null
          id: string
          platform: string
          status: string | null
          updated_at: string | null
          user_id: string | null
          video_url: string
          view_count: number | null
        }
        Insert: {
          admin_feedback?: string | null
          created_at?: string | null
          id?: string
          platform: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url: string
          view_count?: number | null
        }
        Update: {
          admin_feedback?: string | null
          created_at?: string | null
          id?: string
          platform?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pullup_leaderboard: {
        Row: {
          admin_feedback: string | null
          claim_code: string | null
          created_at: string | null
          created_by: string | null
          douyin_nickname: string | null
          gender: string | null
          id: string
          is_claimed: boolean
          is_user_submission: boolean | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          submission_status: string | null
          submitted_at: string | null
          submitted_by: string | null
          user_id: string | null
          video_url: string | null
          weight_kg: number
        }
        Insert: {
          admin_feedback?: string | null
          claim_code?: string | null
          created_at?: string | null
          created_by?: string | null
          douyin_nickname?: string | null
          gender?: string | null
          id?: string
          is_claimed?: boolean
          is_user_submission?: boolean | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          user_id?: string | null
          video_url?: string | null
          weight_kg: number
        }
        Update: {
          admin_feedback?: string | null
          claim_code?: string | null
          created_at?: string | null
          created_by?: string | null
          douyin_nickname?: string | null
          gender?: string | null
          id?: string
          is_claimed?: boolean
          is_user_submission?: boolean | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          user_id?: string | null
          video_url?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "pullup_leaderboard_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pullup_leaderboard_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      questionnaire_responses: {
        Row: {
          answers: Json
          coach_id: string | null
          context: string | null
          created_at: string | null
          id: string
          plan_instance_id: string | null
          questionnaire_id: string | null
          questionnaire_version: number | null
          student_id: string
        }
        Insert: {
          answers?: Json
          coach_id?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          plan_instance_id?: string | null
          questionnaire_id?: string | null
          questionnaire_version?: number | null
          student_id: string
        }
        Update: {
          answers?: Json
          coach_id?: string | null
          context?: string | null
          created_at?: string | null
          id?: string
          plan_instance_id?: string | null
          questionnaire_id?: string | null
          questionnaire_version?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_plan_instance_id_fkey"
            columns: ["plan_instance_id"]
            isOneToOne: false
            referencedRelation: "coach_plan_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "coach_questionnaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          created_at: string | null
          id: string
          invitee_id: string | null
          inviter_id: string | null
          reward_granted: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id?: string | null
          reward_granted?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invitee_id?: string | null
          inviter_id?: string | null
          reward_granted?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      set_videos: {
        Row: {
          coach_feedback: string | null
          coach_rating: number | null
          created_at: string
          duration_seconds: number | null
          exercise_index: number
          file_size_bytes: number | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          set_index: number
          thumbnail_url: string | null
          training_record_id: string
          upload_status: string
          video_url: string
        }
        Insert: {
          coach_feedback?: string | null
          coach_rating?: number | null
          created_at?: string
          duration_seconds?: number | null
          exercise_index: number
          file_size_bytes?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          set_index: number
          thumbnail_url?: string | null
          training_record_id: string
          upload_status?: string
          video_url: string
        }
        Update: {
          coach_feedback?: string | null
          coach_rating?: number | null
          created_at?: string
          duration_seconds?: number | null
          exercise_index?: number
          file_size_bytes?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          set_index?: number
          thumbnail_url?: string | null
          training_record_id?: string
          upload_status?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_videos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_videos_training_record_id_fkey"
            columns: ["training_record_id"]
            isOneToOne: false
            referencedRelation: "training_records"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_info: {
        Row: {
          address: string
          created_at: string | null
          id: string
          notes: string | null
          phone: string
          prize_id: string
          recipient_name: string
          status: string | null
          tracking_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          notes?: string | null
          phone: string
          prize_id: string
          recipient_name: string
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          phone?: string
          prize_id?: string
          recipient_name?: string
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipping_info_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      streetlifting_formulas: {
        Row: {
          coeff_a: number
          coeff_b: number
          coeff_c: number
          coeff_d: number
          coeff_e: number
          coeff_f: number
          gender: string
          id: number
          last_updated: string | null
          total_submissions_used: number
        }
        Insert: {
          coeff_a: number
          coeff_b: number
          coeff_c: number
          coeff_d: number
          coeff_e: number
          coeff_f: number
          gender: string
          id?: number
          last_updated?: string | null
          total_submissions_used?: number
        }
        Update: {
          coeff_a?: number
          coeff_b?: number
          coeff_c?: number
          coeff_d?: number
          coeff_e?: number
          coeff_f?: number
          gender?: string
          id?: number
          last_updated?: string | null
          total_submissions_used?: number
        }
        Relationships: []
      }
      streetlifting_location_contributors: {
        Row: {
          id: string
          contributor_key: string
          contributor_user_id: string | null
          display_name: string
          upload_count: number
          detail_score_total: number
          image_count_total: number
          contribution_score: number
          last_contributed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contributor_key: string
          contributor_user_id?: string | null
          display_name: string
          upload_count?: number
          detail_score_total?: number
          image_count_total?: number
          contribution_score?: number
          last_contributed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contributor_key?: string
          contributor_user_id?: string | null
          display_name?: string
          upload_count?: number
          detail_score_total?: number
          image_count_total?: number
          contribution_score?: number
          last_contributed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "streetlifting_location_contributors_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      streetlifting_locations: {
        Row: {
          address: string | null
          city: string | null
          county: string | null
          created_at: string | null
          description: string | null
          contributor_name_snapshot: string | null
          contributor_user_id: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          latitude: number | null
          longitude: number | null
          name: string
          province: string | null
          user_contact: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          description?: string | null
          contributor_name_snapshot?: string | null
          contributor_user_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name: string
          province?: string | null
          user_contact?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          description?: string | null
          contributor_name_snapshot?: string | null
          contributor_user_id?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          province?: string | null
          user_contact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streetlifting_locations_contributor_user_id_fkey"
            columns: ["contributor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      streetlifting_stories: {
        Row: {
          content: string | null
          created_at: string | null
          event_date: string | null
          id: string
          title: string
          type: string | null
          user_contact: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          title: string
          type?: string | null
          user_contact?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          event_date?: string | null
          id?: string
          title?: string
          type?: string | null
          user_contact?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      streetlifting_submissions: {
        Row: {
          added_weight: number
          bodyweight: number
          created_at: string | null
          exercise_type: string
          form_quality: string
          gender: string
          id: string
          is_processed: boolean
          penalty_weight: number
          pullup_type: string | null
          reps: number
          user_id: string | null
          user_name: string | null
          video_url: string | null
        }
        Insert: {
          added_weight: number
          bodyweight: number
          created_at?: string | null
          exercise_type?: string
          form_quality: string
          gender: string
          id?: string
          is_processed?: boolean
          penalty_weight?: number
          pullup_type?: string | null
          reps: number
          user_id?: string | null
          user_name?: string | null
          video_url?: string | null
        }
        Update: {
          added_weight?: number
          bodyweight?: number
          created_at?: string | null
          exercise_type?: string
          form_quality?: string
          gender?: string
          id?: string
          is_processed?: boolean
          penalty_weight?: number
          pullup_type?: string | null
          reps?: number
          user_id?: string | null
          user_name?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streetlifting_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_actions: {
        Row: {
          attrs: string[] | null
          canonical_action_id: string | null
          created_at: string | null
          detail: string | null
          enableAutoWeightCompute: boolean | null
          id: string
          includesBodyWeight: boolean | null
          item_schema: Json | null
          name: string
          positions: string[] | null
          suggested_time: string | null
          type: string
          updated_at: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          created_at?: string | null
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          name: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          attrs?: string[] | null
          canonical_action_id?: string | null
          created_at?: string | null
          detail?: string | null
          enableAutoWeightCompute?: boolean | null
          id?: string
          includesBodyWeight?: boolean | null
          item_schema?: Json | null
          name?: string
          positions?: string[] | null
          suggested_time?: string | null
          type?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_actions_canonical_action_id_fkey"
            columns: ["canonical_action_id"]
            isOneToOne: false
            referencedRelation: "canonical_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_comments: {
        Row: {
          coach_id: string
          comment: string
          created_at: string | null
          id: string
          media: Json | null
          rating: number | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          comment: string
          created_at?: string | null
          id?: string
          media?: Json | null
          rating?: number | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          comment?: string
          created_at?: string | null
          id?: string
          media?: Json | null
          rating?: number | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_comments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_comments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_coupons: {
        Row: {
          category_limit: string | null
          condition_min_amount: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          status: string | null
          type: string
          used_at: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          category_limit?: string | null
          condition_min_amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          type: string
          used_at?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          category_limit?: string | null
          condition_min_amount?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          type?: string
          used_at?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_coupons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_membership_orders: {
        Row: {
          amount: number
          coupon_id: string | null
          created_at: string | null
          id: string
          original_amount: number
          paid_at: string | null
          payment_method: string | null
          product_key: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          coupon_id?: string | null
          created_at?: string | null
          id?: string
          original_amount: number
          paid_at?: string | null
          payment_method?: string | null
          product_key: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          coupon_id?: string | null
          created_at?: string | null
          id?: string
          original_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          product_key?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_membership_orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "student_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_membership_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_memberships: {
        Row: {
          created_at: string | null
          end_date: string | null
          start_date: string
          status: string
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          start_date?: string
          status: string
          tier: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          start_date?: string
          status?: string
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_plan_favorites: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          training_days: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          training_days: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          training_days?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_quotas: {
        Row: {
          ai_import_balance: number | null
          created_at: string | null
          last_reset_date: string | null
          storage_total_mb: number | null
          storage_used_mb: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_import_balance?: number | null
          created_at?: string | null
          last_reset_date?: string | null
          storage_total_mb?: number | null
          storage_used_mb?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_import_balance?: number | null
          created_at?: string | null
          last_reset_date?: string | null
          storage_total_mb?: number | null
          storage_used_mb?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_video_collections: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string
          duration_seconds: number | null
          execution_set_video_id: string | null
          file_size: number | null
          id: string
          is_featured: boolean | null
          processing_status: string | null
          source: string
          storage_bucket: string | null
          storage_path: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          training_video_id: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description: string
          duration_seconds?: number | null
          execution_set_video_id?: string | null
          file_size?: number | null
          id?: string
          is_featured?: boolean | null
          processing_status?: string | null
          source?: string
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          training_video_id?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          duration_seconds?: number | null
          execution_set_video_id?: string | null
          file_size?: number | null
          id?: string
          is_featured?: boolean | null
          processing_status?: string | null
          source?: string
          storage_bucket?: string | null
          storage_path?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          training_video_id?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_video_collections_execution_set_video_id_fkey"
            columns: ["execution_set_video_id"]
            isOneToOne: false
            referencedRelation: "execution_set_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_video_collections_training_video_id_fkey"
            columns: ["training_video_id"]
            isOneToOne: false
            referencedRelation: "coach_pending_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_video_collections_training_video_id_fkey"
            columns: ["training_video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_video_collections_training_video_id_fkey"
            columns: ["training_video_id"]
            isOneToOne: false
            referencedRelation: "user_video_timeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_video_collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_items: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      training_plan_details: {
        Row: {
          accessory_exercises: Json
          cooldown: Json | null
          created_at: string | null
          day_of_week: string
          id: string
          main_exercises: Json
          notes: string | null
          order_index: number | null
          session_focus: string | null
          training_plan_id: string
          updated_at: string | null
          warmup: Json | null
          week_number: number
        }
        Insert: {
          accessory_exercises: Json
          cooldown?: Json | null
          created_at?: string | null
          day_of_week: string
          id?: string
          main_exercises: Json
          notes?: string | null
          order_index?: number | null
          session_focus?: string | null
          training_plan_id: string
          updated_at?: string | null
          warmup?: Json | null
          week_number: number
        }
        Update: {
          accessory_exercises?: Json
          cooldown?: Json | null
          created_at?: string | null
          day_of_week?: string
          id?: string
          main_exercises?: Json
          notes?: string | null
          order_index?: number | null
          session_focus?: string | null
          training_plan_id?: string
          updated_at?: string | null
          warmup?: Json | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_details_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          ai_enhancements: Json | null
          ai_generated: boolean | null
          assessment_data: Json | null
          coach_id: string | null
          coach_reviewed: boolean | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          domain: string | null
          duration_weeks: number | null
          enhanced_by_ai: boolean | null
          id: string
          published_at: string | null
          rulepack_id: string | null
          rulepack_version: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_enhancements?: Json | null
          ai_generated?: boolean | null
          assessment_data?: Json | null
          coach_id?: string | null
          coach_reviewed?: boolean | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          domain?: string | null
          duration_weeks?: number | null
          enhanced_by_ai?: boolean | null
          id?: string
          published_at?: string | null
          rulepack_id?: string | null
          rulepack_version?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_enhancements?: Json | null
          ai_generated?: boolean | null
          assessment_data?: Json | null
          coach_id?: string | null
          coach_reviewed?: boolean | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          domain?: string | null
          duration_weeks?: number | null
          enhanced_by_ai?: boolean | null
          id?: string
          published_at?: string | null
          rulepack_id?: string | null
          rulepack_version?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_rulepack_id_fkey"
            columns: ["rulepack_id"]
            isOneToOne: false
            referencedRelation: "coach_rulepacks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          completed_at: string | null
          completed_sets: number
          created_at: string
          day_number: number
          duration_minutes: number | null
          exercises: Json
          id: string
          notes: string | null
          plan_id: string
          share_token: string | null
          skipped_sets: number
          started_at: string
          status: string
          total_sets: number
          training_date: string
          updated_at: string
          user_id: string
          visibility: string | null
          week_number: number
        }
        Insert: {
          completed_at?: string | null
          completed_sets?: number
          created_at?: string
          day_number: number
          duration_minutes?: number | null
          exercises?: Json
          id?: string
          notes?: string | null
          plan_id: string
          share_token?: string | null
          skipped_sets?: number
          started_at?: string
          status?: string
          total_sets?: number
          training_date: string
          updated_at?: string
          user_id: string
          visibility?: string | null
          week_number: number
        }
        Update: {
          completed_at?: string | null
          completed_sets?: number
          created_at?: string
          day_number?: number
          duration_minutes?: number | null
          exercises?: Json
          id?: string
          notes?: string | null
          plan_id?: string
          share_token?: string | null
          skipped_sets?: number
          started_at?: string
          status?: string
          total_sets?: number
          training_date?: string
          updated_at?: string
          user_id?: string
          visibility?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          completed_date: string | null
          created_at: string | null
          day_of_week: string
          energy_level: number | null
          id: string
          notes: string | null
          rpe: number | null
          scheduled_date: string | null
          session_focus: string | null
          sleep_hours: number | null
          status: string | null
          training_plan_id: string
          updated_at: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          completed_date?: string | null
          created_at?: string | null
          day_of_week: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          rpe?: number | null
          scheduled_date?: string | null
          session_focus?: string | null
          sleep_hours?: number | null
          status?: string | null
          training_plan_id: string
          updated_at?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          completed_date?: string | null
          created_at?: string | null
          day_of_week?: string
          energy_level?: number | null
          id?: string
          notes?: string | null
          rpe?: number | null
          scheduled_date?: string | null
          session_focus?: string | null
          sleep_hours?: number | null
          status?: string | null
          training_plan_id?: string
          updated_at?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          coach_feedback: Json | null
          coach_id: string | null
          created_at: string | null
          day_of_week: string | null
          deleted_at: string | null
          duration_seconds: number | null
          exercise_name: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          processing_status: string | null
          requires_review: boolean | null
          review_status: string | null
          reviewed_at: string | null
          tags: string[] | null
          thumbnail_url: string | null
          training_plan_id: string | null
          training_session_id: string | null
          type: string
          updated_at: string | null
          user_id: string | null
          user_notes: string | null
          video_url: string
          week_number: number | null
          workout_log_id: string | null
        }
        Insert: {
          coach_feedback?: Json | null
          coach_id?: string | null
          created_at?: string | null
          day_of_week?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          exercise_name?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          training_plan_id?: string | null
          training_session_id?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
          user_notes?: string | null
          video_url: string
          week_number?: number | null
          workout_log_id?: string | null
        }
        Update: {
          coach_feedback?: Json | null
          coach_id?: string | null
          created_at?: string | null
          day_of_week?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          exercise_name?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          processing_status?: string | null
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          training_plan_id?: string | null
          training_session_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          user_notes?: string | null
          video_url?: string
          week_number?: number | null
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_training_videos_coach_id"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_behavior_events: {
        Row: {
          created_at: string | null
          device_type: string | null
          event_category: string
          event_data: Json | null
          event_name: string
          id: string
          page_path: string | null
          session_id: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          event_category: string
          event_data?: Json | null
          event_name: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          event_category?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          age: number | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string | null
          fitness_goal: string | null
          fitness_level: string | null
          full_name: string | null
          gender: string | null
          guides_completed: Json | null
          height: number | null
          id: string
          lifestyle: string | null
          nickname: string | null
          onboarding_completed: boolean | null
          phone: string | null
          search_id: string | null
          sport_cards: Json | null
          updated_at: string | null
          user_id: string | null
          weight: number | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          fitness_goal?: string | null
          fitness_level?: string | null
          full_name?: string | null
          gender?: string | null
          guides_completed?: Json | null
          height?: number | null
          id?: string
          lifestyle?: string | null
          nickname?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          search_id?: string | null
          sport_cards?: Json | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          address?: string | null
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          fitness_goal?: string | null
          fitness_level?: string | null
          full_name?: string | null
          gender?: string | null
          guides_completed?: Json | null
          height?: number | null
          id?: string
          lifestyle?: string | null
          nickname?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          search_id?: string | null
          sport_cards?: Json | null
          updated_at?: string | null
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          admin_permissions: string[] | null
          admin_role: string | null
          coach_status: string | null
          created_at: string | null
          email: string | null
          has_drawn: boolean | null
          id: string
          invitation_coach_id: string | null
          is_admin: boolean | null
          is_coach: boolean | null
          last_login_at: string | null
          password_hash: string
          phone: string | null
          primary_role: string | null
          subscription_expires_at: string | null
          subscription_level: string | null
          updated_at: string | null
          wechat_openid: string | null
        }
        Insert: {
          admin_permissions?: string[] | null
          admin_role?: string | null
          coach_status?: string | null
          created_at?: string | null
          email?: string | null
          has_drawn?: boolean | null
          id?: string
          invitation_coach_id?: string | null
          is_admin?: boolean | null
          is_coach?: boolean | null
          last_login_at?: string | null
          password_hash: string
          phone?: string | null
          primary_role?: string | null
          subscription_expires_at?: string | null
          subscription_level?: string | null
          updated_at?: string | null
          wechat_openid?: string | null
        }
        Update: {
          admin_permissions?: string[] | null
          admin_role?: string | null
          coach_status?: string | null
          created_at?: string | null
          email?: string | null
          has_drawn?: boolean | null
          id?: string
          invitation_coach_id?: string | null
          is_admin?: boolean | null
          is_coach?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          phone?: string | null
          primary_role?: string | null
          subscription_expires_at?: string | null
          subscription_level?: string | null
          updated_at?: string | null
          wechat_openid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_invitation_coach_id_fkey"
            columns: ["invitation_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          alipay_order_id: string | null
          amount: number
          created_at: string | null
          description: string | null
          id: string
          related_income_tx_id: string | null
          type: string
          wallet_id: string | null
        }
        Insert: {
          alipay_order_id?: string | null
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_income_tx_id?: string | null
          type: string
          wallet_id?: string | null
        }
        Update: {
          alipay_order_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_income_tx_id?: string | null
          type?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "coach_wallets"
            referencedColumns: ["coach_id"]
          },
        ]
      }
    }
    Views: {
      coach_pending_reviews: {
        Row: {
          created_at: string | null
          exercise_name: string | null
          id: string | null
          thumbnail_url: string | null
          training_plan_id: string | null
          type: string | null
          user_id: string | null
          user_name: string | null
          user_notes: string | null
          video_url: string | null
        }
        Relationships: []
      }
      daily_active_users: {
        Row: {
          active_users: number | null
          date: string | null
          user_type: string | null
        }
        Relationships: []
      }
      feature_usage_stats: {
        Row: {
          date: string | null
          event_category: string | null
          event_name: string | null
          unique_users: number | null
          usage_count: number | null
          user_type: string | null
        }
        Relationships: []
      }
      training_statistics: {
        Row: {
          avg_duration_minutes: number | null
          completed_sessions: number | null
          completion_percentage: number | null
          last_training_date: string | null
          plan_id: string | null
          total_completed_sets: number | null
          total_sessions: number | null
          total_sets: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_records_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_video_timeline: {
        Row: {
          coach_feedback: Json | null
          created_at: string | null
          exercise_name: string | null
          id: string | null
          requires_review: boolean | null
          review_status: string | null
          reviewed_at: string | null
          tags: string[] | null
          thumbnail_url: string | null
          training_plan_id: string | null
          type: string | null
          user_id: string | null
          user_notes: string | null
          video_url: string | null
        }
        Insert: {
          coach_feedback?: Json | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string | null
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          training_plan_id?: string | null
          type?: string | null
          user_id?: string | null
          user_notes?: string | null
          video_url?: string | null
        }
        Update: {
          coach_feedback?: Json | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string | null
          requires_review?: boolean | null
          review_status?: string | null
          reviewed_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          training_plan_id?: string | null
          type?: string | null
          user_id?: string | null
          user_notes?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_pullup_rankings: {
        Args: { target_month: string }
        Returns: undefined
      }
      calculate_training_progress: {
        Args: { record_id: string }
        Returns: number
      }
      cleanup_knowledge_book_files: {
        Args: { p_book_id: string }
        Returns: undefined
      }
      create_coach_rulepack: {
        Args: {
          p_coach_id: string
          p_config_json: Json
          p_description?: string
          p_domain: string
          p_form_schema: Json
          p_key: string
          p_name: string
        }
        Returns: string
      }
      create_sample_challenge: { Args: never; Returns: string }
      get_coach_rulepacks: {
        Args: { p_coach_id: string }
        Returns: {
          description: string
          domain: string
          id: string
          is_active: boolean
          key: string
          name: string
          version: string
        }[]
      }
      get_current_active_challenge: {
        Args: never
        Returns: {
          announcement_date: string
          description: string
          end_date: string
          id: string
          month_period: string
          start_date: string
          status: string
          submission_deadline: string
          title: string
        }[]
      }
      get_last_training_record: {
        Args: { p_current_date: string; p_plan_id: string; p_user_id: string }
        Returns: {
          completed_at: string | null
          completed_sets: number
          created_at: string
          day_number: number
          duration_minutes: number | null
          exercises: Json
          id: string
          notes: string | null
          plan_id: string
          share_token: string | null
          skipped_sets: number
          started_at: string
          status: string
          total_sets: number
          training_date: string
          updated_at: string
          user_id: string
          visibility: string | null
          week_number: number
        }
        SetofOptions: {
          from: "*"
          to: "training_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_pullup_leaderboard_details: {
        Args: never
        Returns: {
          created_at: string
          gender: string
          id: string
          name: string
          notes: string
          rank: number
          video_url: string
          weight_kg: number
        }[]
      }
      get_retention_data: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          d1_count: number
          d3_count: number
          d30_count: number
          d7_count: number
          date: string
          new_users: number
        }[]
      }
      init_default_rulepacks: { Args: never; Returns: undefined }
      insert_sample_training_record: {
        Args: { p_plan_id: string; p_user_id: string }
        Returns: string
      }
      toggle_content_like: {
        Args: { p_content_id: string; p_user_id: string }
        Returns: Json
      }
      update_leaderboard_rankings: {
        Args: { challenge_uuid: string }
        Returns: undefined
      }
      update_pull_up_rankings: { Args: { period: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
