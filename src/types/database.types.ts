export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          id: string;
          permissions: string[] | null;
          role: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          permissions?: string[] | null;
          role: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          permissions?: string[] | null;
          role?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      alipay_orders: {
        Row: {
          alipay_trade_no: string | null;
          created_at: string;
          id: string;
          order_data: Json | null;
          order_type: string | null;
          product_code: string | null;
          qr_code: string | null;
          status: string;
          subject: string;
          total_amount: number;
          trade_status: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alipay_trade_no?: string | null;
          created_at?: string;
          id?: string;
          order_data?: Json | null;
          order_type?: string | null;
          product_code?: string | null;
          qr_code?: string | null;
          status?: string;
          subject: string;
          total_amount: number;
          trade_status?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          alipay_trade_no?: string | null;
          created_at?: string;
          id?: string;
          order_data?: Json | null;
          order_type?: string | null;
          product_code?: string | null;
          qr_code?: string | null;
          status?: string;
          subject?: string;
          total_amount?: number;
          trade_status?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alipay_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string | null;
          duration: number | null;
          file_name: string | null;
          file_size: number | null;
          id: string;
          is_read: boolean | null;
          media_url: string | null;
          message_type: string;
          room_id: string;
          sender_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          duration?: number | null;
          file_name?: string | null;
          file_size?: number | null;
          id?: string;
          is_read?: boolean | null;
          media_url?: string | null;
          message_type: string;
          room_id: string;
          sender_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          duration?: number | null;
          file_name?: string | null;
          file_size?: number | null;
          id?: string;
          is_read?: boolean | null;
          media_url?: string | null;
          message_type?: string;
          room_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_room_unreads: {
        Row: {
          last_read_at: string | null;
          room_id: string;
          unread_count: number;
          user_id: string;
        };
        Insert: {
          last_read_at?: string | null;
          room_id: string;
          unread_count?: number;
          user_id: string;
        };
        Update: {
          last_read_at?: string | null;
          room_id?: string;
          unread_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_room_unreads_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_rooms: {
        Row: {
          created_at: string;
          id: string;
          is_archived: boolean;
          last_message: string | null;
          last_message_at: string | null;
          members: string[] | null;
          subscription_id: string | null;
          type: string | null;
          unread_members: string[] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          last_message?: string | null;
          last_message_at?: string | null;
          members?: string[] | null;
          subscription_id?: string | null;
          type?: string | null;
          unread_members?: string[] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          last_message?: string | null;
          last_message_at?: string | null;
          members?: string[] | null;
          subscription_id?: string | null;
          type?: string | null;
          unread_members?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "coach_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_actions: {
        Row: {
          attrs: string[] | null;
          coach_id: string;
          created_at: string;
          detail: string | null;
          enableAutoWeightCompute: boolean | null;
          id: string;
          includesBodyWeight: boolean | null;
          name: string;
          positions: string[] | null;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          attrs?: string[] | null;
          coach_id: string;
          created_at?: string;
          detail?: string | null;
          enableAutoWeightCompute?: boolean | null;
          id?: string;
          includesBodyWeight?: boolean | null;
          name: string;
          positions?: string[] | null;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          attrs?: string[] | null;
          coach_id?: string;
          created_at?: string;
          detail?: string | null;
          enableAutoWeightCompute?: boolean | null;
          id?: string;
          includesBodyWeight?: boolean | null;
          name?: string;
          positions?: string[] | null;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      coach_applications: {
        Row: {
          achievements: string[] | null;
          applied_at: string;
          avatar_url: string | null;
          bio: string | null;
          case_studies: string[] | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          credentials: Json[] | null;
          id: string;
          name: string;
          portfolio_url: string | null;
          resume_url: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          social_links: Json | null;
          specialties: string[] | null;
          status: string;
          teaching_philosophy: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
          years_experience: number | null;
        };
        Insert: {
          achievements?: string[] | null;
          applied_at?: string;
          avatar_url?: string | null;
          bio?: string | null;
          case_studies?: string[] | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          credentials?: Json[] | null;
          id?: string;
          name: string;
          portfolio_url?: string | null;
          resume_url?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          social_links?: Json | null;
          specialties?: string[] | null;
          status?: string;
          teaching_philosophy?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id: string;
          years_experience?: number | null;
        };
        Update: {
          achievements?: string[] | null;
          applied_at?: string;
          avatar_url?: string | null;
          bio?: string | null;
          case_studies?: string[] | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          credentials?: Json[] | null;
          id?: string;
          name?: string;
          portfolio_url?: string | null;
          resume_url?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          social_links?: Json | null;
          specialties?: string[] | null;
          status?: string;
          teaching_philosophy?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_applications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_contents: {
        Row: {
          coach_id: string;
          comments_count: number | null;
          content: string;
          content_type: string;
          created_at: string | null;
          id: string;
          is_featured: boolean | null;
          likes_count: number | null;
          media_urls: string[] | null;
          required_tier: number | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string | null;
          views_count: number | null;
        };
        Insert: {
          coach_id: string;
          comments_count?: number | null;
          content: string;
          content_type: string;
          created_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          likes_count?: number | null;
          media_urls?: string[] | null;
          required_tier?: number | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string | null;
          views_count?: number | null;
        };
        Update: {
          coach_id?: string;
          comments_count?: number | null;
          content?: string;
          content_type?: string;
          created_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          likes_count?: number | null;
          media_urls?: string[] | null;
          required_tier?: number | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string | null;
          views_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_contents_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_plan_instances: {
        Row: {
          coach_id: string | null;
          coach_plan_template_id: string | null;
          coach_subscription_id: string | null;
          created_at: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: string | null;
          student_id: string | null;
          suitable_for: string | null;
          tags: string[] | null;
          training_days: Json;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          coach_id?: string | null;
          coach_plan_template_id?: string | null;
          coach_subscription_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          name: string;
          start_date?: string | null;
          status?: string | null;
          student_id?: string | null;
          suitable_for?: string | null;
          tags?: string[] | null;
          training_days: Json;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          coach_id?: string | null;
          coach_plan_template_id?: string | null;
          coach_subscription_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: string | null;
          student_id?: string | null;
          suitable_for?: string | null;
          tags?: string[] | null;
          training_days?: Json;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_plan_instances_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_plan_instances_coach_subscription_id_fkey";
            columns: ["coach_subscription_id"];
            isOneToOne: false;
            referencedRelation: "coach_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_plan_instances_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_plan_template";
            columns: ["coach_plan_template_id"];
            isOneToOne: false;
            referencedRelation: "coach_plan_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_plan_templates: {
        Row: {
          coach_id: string;
          contained_options: string[] | null;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          rest_days_count: number | null;
          suitable_for: string | null;
          tags: string[] | null;
          training_days: Json[] | null;
          training_days_count: number | null;
          type: string;
          updated_at: string | null;
          week_days: number[] | null;
        };
        Insert: {
          coach_id: string;
          contained_options?: string[] | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          rest_days_count?: number | null;
          suitable_for?: string | null;
          tags?: string[] | null;
          training_days?: Json[] | null;
          training_days_count?: number | null;
          type: string;
          updated_at?: string | null;
          week_days?: number[] | null;
        };
        Update: {
          coach_id?: string;
          contained_options?: string[] | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          rest_days_count?: number | null;
          suitable_for?: string | null;
          tags?: string[] | null;
          training_days?: Json[] | null;
          training_days_count?: number | null;
          type?: string;
          updated_at?: string | null;
          week_days?: number[] | null;
        };
        Relationships: [];
      };
      coach_pricing: {
        Row: {
          coach_id: string;
          created_at: string;
          id: string;
          pricings: Json;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          created_at?: string;
          id?: string;
          pricings?: Json;
          updated_at?: string;
        };
        Update: {
          coach_id?: string;
          created_at?: string;
          id?: string;
          pricings?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_pricing_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: true;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_questionnaires: {
        Row: {
          coach_id: string;
          created_at: string | null;
          id: string;
          questions: Json;
          updated_at: string | null;
        };
        Insert: {
          coach_id: string;
          created_at?: string | null;
          id?: string;
          questions: Json;
          updated_at?: string | null;
        };
        Update: {
          coach_id?: string;
          created_at?: string | null;
          id?: string;
          questions?: Json;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      coach_reviews: {
        Row: {
          coach_id: string | null;
          coach_subscription_id: string;
          created_at: string | null;
          id: string;
          media_urls: string[] | null;
          review_text: string | null;
          student_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          coach_id?: string | null;
          coach_subscription_id: string;
          created_at?: string | null;
          id?: string;
          media_urls?: string[] | null;
          review_text?: string | null;
          student_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          coach_id?: string | null;
          coach_subscription_id?: string;
          created_at?: string | null;
          id?: string;
          media_urls?: string[] | null;
          review_text?: string | null;
          student_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_reviews_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_reviews_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_coach_subscription";
            columns: ["coach_subscription_id"];
            isOneToOne: false;
            referencedRelation: "coach_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_rulepacks: {
        Row: {
          coach_id: string;
          config_json: Json;
          created_at: string | null;
          description: string | null;
          domain: string;
          form_schema: Json;
          id: string;
          is_active: boolean | null;
          key: string;
          name: string;
          updated_at: string | null;
          version: string;
        };
        Insert: {
          coach_id: string;
          config_json: Json;
          created_at?: string | null;
          description?: string | null;
          domain: string;
          form_schema: Json;
          id?: string;
          is_active?: boolean | null;
          key: string;
          name: string;
          updated_at?: string | null;
          version?: string;
        };
        Update: {
          coach_id?: string;
          config_json?: Json;
          created_at?: string | null;
          description?: string | null;
          domain?: string;
          form_schema?: Json;
          id?: string;
          is_active?: boolean | null;
          key?: string;
          name?: string;
          updated_at?: string | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_rulepacks_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_subscriptions: {
        Row: {
          auto_renew: boolean | null;
          coach_id: string;
          created_at: string | null;
          end_date: string | null;
          has_remind_coach: boolean | null;
          id: string;
          monthly_price: number;
          order_id: string | null;
          remind_coach_note: string | null;
          start_date: string | null;
          status: string | null;
          student_id: string;
          subscribe_data: Json | null;
          tier: number;
          updated_at: string | null;
        };
        Insert: {
          auto_renew?: boolean | null;
          coach_id: string;
          created_at?: string | null;
          end_date?: string | null;
          has_remind_coach?: boolean | null;
          id?: string;
          monthly_price: number;
          order_id?: string | null;
          remind_coach_note?: string | null;
          start_date?: string | null;
          status?: string | null;
          student_id: string;
          subscribe_data?: Json | null;
          tier: number;
          updated_at?: string | null;
        };
        Update: {
          auto_renew?: boolean | null;
          coach_id?: string;
          created_at?: string | null;
          end_date?: string | null;
          has_remind_coach?: boolean | null;
          id?: string;
          monthly_price?: number;
          order_id?: string | null;
          remind_coach_note?: string | null;
          start_date?: string | null;
          status?: string | null;
          student_id?: string;
          subscribe_data?: Json | null;
          tier?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_subscriptions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      coaches: {
        Row: {
          achievements: string[] | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          id: string;
          is_featured: boolean | null;
          name: string;
          payment_qr_code: string | null;
          profile: Json | null;
          rating: number | null;
          search_vector: unknown;
          specialties: string[] | null;
          status: string | null;
          title: string | null;
          total_students: number | null;
          updated_at: string | null;
          user_id: string | null;
          years_experience: number | null;
        };
        Insert: {
          achievements?: string[] | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          name: string;
          payment_qr_code?: string | null;
          profile?: Json | null;
          rating?: number | null;
          search_vector?: unknown;
          specialties?: string[] | null;
          status?: string | null;
          title?: string | null;
          total_students?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          years_experience?: number | null;
        };
        Update: {
          achievements?: string[] | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          id?: string;
          is_featured?: boolean | null;
          name?: string;
          payment_qr_code?: string | null;
          profile?: Json | null;
          rating?: number | null;
          search_vector?: unknown;
          specialties?: string[] | null;
          status?: string | null;
          title?: string | null;
          total_students?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "coaches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      content_interactions: {
        Row: {
          comment_content: string | null;
          content_id: string;
          created_at: string | null;
          id: string;
          interaction_type: string;
          user_id: string;
        };
        Insert: {
          comment_content?: string | null;
          content_id: string;
          created_at?: string | null;
          id?: string;
          interaction_type: string;
          user_id: string;
        };
        Update: {
          comment_content?: string | null;
          content_id?: string;
          created_at?: string | null;
          id?: string;
          interaction_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_interactions_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "coach_contents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_interactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      execution_set_videos: {
        Row: {
          action_id: string;
          coach_feedback: string | null;
          coach_rating: number | null;
          created_at: string;
          duration_seconds: number | null;
          execution_id: string;
          file_size_bytes: number | null;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          set_number: number;
          storage_bucket: string | null;
          storage_path: string;
          thumbnail_url: string | null;
          upload_status: string | null;
          video_url: string;
        };
        Insert: {
          action_id: string;
          coach_feedback?: string | null;
          coach_rating?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          execution_id: string;
          file_size_bytes?: number | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          set_number: number;
          storage_bucket?: string | null;
          storage_path: string;
          thumbnail_url?: string | null;
          upload_status?: string | null;
          video_url: string;
        };
        Update: {
          action_id?: string;
          coach_feedback?: string | null;
          coach_rating?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          execution_id?: string;
          file_size_bytes?: number | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          set_number?: number;
          storage_bucket?: string | null;
          storage_path?: string;
          thumbnail_url?: string | null;
          upload_status?: string | null;
          video_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "execution_set_videos_execution_id_fkey";
            columns: ["execution_id"];
            isOneToOne: false;
            referencedRelation: "plan_instance_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "execution_set_videos_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          created_at: string | null
          evidence_url: string | null
          form_data: Json
          id: string
          score: number | null
          status: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          evidence_url?: string | null
          form_data: Json
          id?: string
          score?: number | null
          status?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          evidence_url?: string | null
          form_data?: Json
          id?: string
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
          rank_by_field: string
          remarks: string | null
          rules: Json | null
          sort_order: string | null
          start_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          end_at?: string | null
          form_schema?: Json | null
          id?: string
          rank_by_field: string
          remarks?: string | null
          rules?: Json | null
          sort_order?: string | null
          start_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          end_at?: string | null
          form_schema?: Json | null
          id?: string
          rank_by_field?: string
          remarks?: string | null
          rules?: Json | null
          sort_order?: string | null
          start_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      lifestyle_logs: {
        Row: {
          created_at: string | null;
          diet_notes: string | null;
          id: string;
          log_date: string;
          meal_photos: string[] | null;
          sleep_hours: number | null;
          sleep_quality: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          diet_notes?: string | null;
          id?: string;
          log_date: string;
          meal_photos?: string[] | null;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          diet_notes?: string | null;
          id?: string;
          log_date?: string;
          meal_photos?: string[] | null;
          sleep_hours?: number | null;
          sleep_quality?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lifestyle_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_questionnaires: {
        Row: {
          answers: Json;
          baseline_video_urls: string[] | null;
          coach_id: string | null;
          created_at: string | null;
          id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          answers: Json;
          baseline_video_urls?: string[] | null;
          coach_id?: string | null;
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          answers?: Json;
          baseline_video_urls?: string[] | null;
          coach_id?: string | null;
          created_at?: string | null;
          id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_questionnaires_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "onboarding_questionnaires_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_records: {
        Row: {
          created_at: string | null;
          date_achieved: string;
          exercise_name: string;
          id: string;
          max_reps: number | null;
          max_weight: number | null;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          date_achieved: string;
          exercise_name: string;
          id?: string;
          max_reps?: number | null;
          max_weight?: number | null;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          date_achieved?: string;
          exercise_name?: string;
          id?: string;
          max_reps?: number | null;
          max_weight?: number | null;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      personal_records_history: {
        Row: {
          action_id: string | null;
          created_at: string | null;
          date_achieved: string;
          execution_id: string | null;
          execution_set_number: number | null;
          exercise_name: string;
          id: string;
          is_verified: boolean | null;
          load_formula: string | null;
          max_reps: number | null;
          max_weight: number | null;
          notes: string | null;
          user_id: string;
          video_url: string | null;
        };
        Insert: {
          action_id?: string | null;
          created_at?: string | null;
          date_achieved: string;
          execution_id?: string | null;
          execution_set_number?: number | null;
          exercise_name: string;
          id?: string;
          is_verified?: boolean | null;
          load_formula?: string | null;
          max_reps?: number | null;
          max_weight?: number | null;
          notes?: string | null;
          user_id: string;
          video_url?: string | null;
        };
        Update: {
          action_id?: string | null;
          created_at?: string | null;
          date_achieved?: string;
          execution_id?: string | null;
          execution_set_number?: number | null;
          exercise_name?: string;
          id?: string;
          is_verified?: boolean | null;
          load_formula?: string | null;
          max_reps?: number | null;
          max_weight?: number | null;
          notes?: string | null;
          user_id?: string;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "personal_records_history_execution_id_fkey";
            columns: ["execution_id"];
            isOneToOne: false;
            referencedRelation: "plan_instance_executions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_records_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_instance_executions: {
        Row: {
          action_executions: Json;
          completed_at: string | null;
          completed_sets: number;
          created_at: string;
          day_index: number;
          id: string;
          instance_id: string;
          last_saved_at: string | null;
          progress_percent: number | null;
          session_notes: string | null;
          started_at: string;
          status: string;
          student_id: string;
          total_sets: number;
          updated_at: string;
        };
        Insert: {
          action_executions?: Json;
          completed_at?: string | null;
          completed_sets?: number;
          created_at?: string;
          day_index: number;
          id?: string;
          instance_id: string;
          last_saved_at?: string | null;
          progress_percent?: number | null;
          session_notes?: string | null;
          started_at?: string;
          status?: string;
          student_id: string;
          total_sets?: number;
          updated_at?: string;
        };
        Update: {
          action_executions?: Json;
          completed_at?: string | null;
          completed_sets?: number;
          created_at?: string;
          day_index?: number;
          id?: string;
          instance_id?: string;
          last_saved_at?: string | null;
          progress_percent?: number | null;
          session_notes?: string | null;
          started_at?: string;
          status?: string;
          student_id?: string;
          total_sets?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_instance_executions_instance_id_fkey";
            columns: ["instance_id"];
            isOneToOne: false;
            referencedRelation: "coach_plan_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_instance_executions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pullup_leaderboard: {
        Row: {
          admin_feedback: string | null;
          claim_code: string | null;
          created_at: string | null;
          created_by: string | null;
          douyin_nickname: string | null;
          gender: string | null;
          id: string;
          is_claimed: boolean;
          is_user_submission: boolean | null;
          notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          submission_status: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          user_id: string | null;
          video_url: string | null;
          weight_kg: number;
        };
        Insert: {
          admin_feedback?: string | null;
          claim_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          douyin_nickname?: string | null;
          gender?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_user_submission?: boolean | null;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          submission_status?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          user_id?: string | null;
          video_url?: string | null;
          weight_kg: number;
        };
        Update: {
          admin_feedback?: string | null;
          claim_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          douyin_nickname?: string | null;
          gender?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_user_submission?: boolean | null;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          submission_status?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          user_id?: string | null;
          video_url?: string | null;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pullup_leaderboard_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pullup_leaderboard_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rankingboard_pullup_2025_9_10: {
        Row: {
          admin_feedback: string | null;
          claim_code: string | null;
          created_at: string | null;
          created_by: string | null;
          douyin_nickname: string | null;
          gender: string | null;
          id: string;
          is_claimed: boolean;
          is_user_submission: boolean | null;
          notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          submission_status: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          user_id: string | null;
          video_url: string | null;
          weight_kg: number;
        };
        Insert: {
          admin_feedback?: string | null;
          claim_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          douyin_nickname?: string | null;
          gender?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_user_submission?: boolean | null;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          submission_status?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          user_id?: string | null;
          video_url?: string | null;
          weight_kg: number;
        };
        Update: {
          admin_feedback?: string | null;
          claim_code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          douyin_nickname?: string | null;
          gender?: string | null;
          id?: string;
          is_claimed?: boolean;
          is_user_submission?: boolean | null;
          notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          submission_status?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          user_id?: string | null;
          video_url?: string | null;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rankingboard_pullup_2025_9_10_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rankingboard_pullup_2025_9_10_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      set_videos: {
        Row: {
          coach_feedback: string | null;
          coach_rating: number | null;
          created_at: string;
          duration_seconds: number | null;
          exercise_index: number;
          file_size_bytes: number | null;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          set_index: number;
          thumbnail_url: string | null;
          training_record_id: string;
          upload_status: string;
          video_url: string;
        };
        Insert: {
          coach_feedback?: string | null;
          coach_rating?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          exercise_index: number;
          file_size_bytes?: number | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          set_index: number;
          thumbnail_url?: string | null;
          training_record_id: string;
          upload_status?: string;
          video_url: string;
        };
        Update: {
          coach_feedback?: string | null;
          coach_rating?: number | null;
          created_at?: string;
          duration_seconds?: number | null;
          exercise_index?: number;
          file_size_bytes?: number | null;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          set_index?: number;
          thumbnail_url?: string | null;
          training_record_id?: string;
          upload_status?: string;
          video_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "set_videos_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_videos_training_record_id_fkey";
            columns: ["training_record_id"];
            isOneToOne: false;
            referencedRelation: "training_records";
            referencedColumns: ["id"];
          },
        ];
      };
      shipping_info: {
        Row: {
          address: string;
          created_at: string | null;
          id: string;
          notes: string | null;
          phone: string;
          prize_id: string;
          recipient_name: string;
          status: string | null;
          tracking_number: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          address: string;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          phone: string;
          prize_id: string;
          recipient_name: string;
          status?: string | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          address?: string;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string;
          prize_id?: string;
          recipient_name?: string;
          status?: string | null;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_shipping_info_user";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      student_comments: {
        Row: {
          coach_id: string;
          comment: string;
          created_at: string | null;
          id: string;
          media: Json | null;
          rating: number | null;
          student_id: string;
          updated_at: string | null;
        };
        Insert: {
          coach_id: string;
          comment: string;
          created_at?: string | null;
          id?: string;
          media?: Json | null;
          rating?: number | null;
          student_id: string;
          updated_at?: string | null;
        };
        Update: {
          coach_id?: string;
          comment?: string;
          created_at?: string | null;
          id?: string;
          media?: Json | null;
          rating?: number | null;
          student_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_comments_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_comments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      training_items: {
        Row: {
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      training_plan_details: {
        Row: {
          accessory_exercises: Json;
          cooldown: Json | null;
          created_at: string | null;
          day_of_week: string;
          id: string;
          main_exercises: Json;
          notes: string | null;
          order_index: number | null;
          session_focus: string | null;
          training_plan_id: string;
          updated_at: string | null;
          warmup: Json | null;
          week_number: number;
        };
        Insert: {
          accessory_exercises: Json;
          cooldown?: Json | null;
          created_at?: string | null;
          day_of_week: string;
          id?: string;
          main_exercises: Json;
          notes?: string | null;
          order_index?: number | null;
          session_focus?: string | null;
          training_plan_id: string;
          updated_at?: string | null;
          warmup?: Json | null;
          week_number: number;
        };
        Update: {
          accessory_exercises?: Json;
          cooldown?: Json | null;
          created_at?: string | null;
          day_of_week?: string;
          id?: string;
          main_exercises?: Json;
          notes?: string | null;
          order_index?: number | null;
          session_focus?: string | null;
          training_plan_id?: string;
          updated_at?: string | null;
          warmup?: Json | null;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_plan_details_training_plan_id_fkey";
            columns: ["training_plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      training_plans: {
        Row: {
          ai_enhancements: Json | null;
          ai_generated: boolean | null;
          assessment_data: Json | null;
          coach_id: string | null;
          coach_reviewed: boolean | null;
          created_at: string | null;
          description: string | null;
          difficulty_level: string | null;
          domain: string | null;
          duration_weeks: number | null;
          enhanced_by_ai: boolean | null;
          id: string;
          published_at: string | null;
          rulepack_id: string | null;
          rulepack_version: string | null;
          status: string | null;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          ai_enhancements?: Json | null;
          ai_generated?: boolean | null;
          assessment_data?: Json | null;
          coach_id?: string | null;
          coach_reviewed?: boolean | null;
          created_at?: string | null;
          description?: string | null;
          difficulty_level?: string | null;
          domain?: string | null;
          duration_weeks?: number | null;
          enhanced_by_ai?: boolean | null;
          id?: string;
          published_at?: string | null;
          rulepack_id?: string | null;
          rulepack_version?: string | null;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          ai_enhancements?: Json | null;
          ai_generated?: boolean | null;
          assessment_data?: Json | null;
          coach_id?: string | null;
          coach_reviewed?: boolean | null;
          created_at?: string | null;
          description?: string | null;
          difficulty_level?: string | null;
          domain?: string | null;
          duration_weeks?: number | null;
          enhanced_by_ai?: boolean | null;
          id?: string;
          published_at?: string | null;
          rulepack_id?: string | null;
          rulepack_version?: string | null;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_plans_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_plans_rulepack_id_fkey";
            columns: ["rulepack_id"];
            isOneToOne: false;
            referencedRelation: "coach_rulepacks";
            referencedColumns: ["id"];
          },
        ];
      };
      training_records: {
        Row: {
          completed_at: string | null;
          completed_sets: number;
          created_at: string;
          day_number: number;
          duration_minutes: number | null;
          exercises: Json;
          id: string;
          notes: string | null;
          plan_id: string;
          skipped_sets: number;
          started_at: string;
          status: string;
          total_sets: number;
          training_date: string;
          updated_at: string;
          user_id: string;
          week_number: number;
        };
        Insert: {
          completed_at?: string | null;
          completed_sets?: number;
          created_at?: string;
          day_number: number;
          duration_minutes?: number | null;
          exercises?: Json;
          id?: string;
          notes?: string | null;
          plan_id: string;
          skipped_sets?: number;
          started_at?: string;
          status?: string;
          total_sets?: number;
          training_date: string;
          updated_at?: string;
          user_id: string;
          week_number: number;
        };
        Update: {
          completed_at?: string | null;
          completed_sets?: number;
          created_at?: string;
          day_number?: number;
          duration_minutes?: number | null;
          exercises?: Json;
          id?: string;
          notes?: string | null;
          plan_id?: string;
          skipped_sets?: number;
          started_at?: string;
          status?: string;
          total_sets?: number;
          training_date?: string;
          updated_at?: string;
          user_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_records_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      training_sessions: {
        Row: {
          completed_date: string | null;
          created_at: string | null;
          day_of_week: string;
          energy_level: number | null;
          id: string;
          notes: string | null;
          rpe: number | null;
          scheduled_date: string | null;
          session_focus: string | null;
          sleep_hours: number | null;
          status: string | null;
          training_plan_id: string;
          updated_at: string | null;
          user_id: string;
          week_number: number;
        };
        Insert: {
          completed_date?: string | null;
          created_at?: string | null;
          day_of_week: string;
          energy_level?: number | null;
          id?: string;
          notes?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          session_focus?: string | null;
          sleep_hours?: number | null;
          status?: string | null;
          training_plan_id: string;
          updated_at?: string | null;
          user_id: string;
          week_number: number;
        };
        Update: {
          completed_date?: string | null;
          created_at?: string | null;
          day_of_week?: string;
          energy_level?: number | null;
          id?: string;
          notes?: string | null;
          rpe?: number | null;
          scheduled_date?: string | null;
          session_focus?: string | null;
          sleep_hours?: number | null;
          status?: string | null;
          training_plan_id?: string;
          updated_at?: string | null;
          user_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_sessions_training_plan_id_fkey";
            columns: ["training_plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      training_videos: {
        Row: {
          coach_feedback: Json | null;
          coach_id: string | null;
          created_at: string | null;
          day_of_week: string | null;
          deleted_at: string | null;
          duration_seconds: number | null;
          exercise_name: string | null;
          file_size: number | null;
          id: string;
          metadata: Json | null;
          processing_status: string | null;
          requires_review: boolean | null;
          review_status: string | null;
          reviewed_at: string | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          training_plan_id: string | null;
          training_session_id: string | null;
          type: string;
          updated_at: string | null;
          user_id: string | null;
          user_notes: string | null;
          video_url: string;
          week_number: number | null;
          workout_log_id: string | null;
        };
        Insert: {
          coach_feedback?: Json | null;
          coach_id?: string | null;
          created_at?: string | null;
          day_of_week?: string | null;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          exercise_name?: string | null;
          file_size?: number | null;
          id?: string;
          metadata?: Json | null;
          processing_status?: string | null;
          requires_review?: boolean | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          training_plan_id?: string | null;
          training_session_id?: string | null;
          type: string;
          updated_at?: string | null;
          user_id?: string | null;
          user_notes?: string | null;
          video_url: string;
          week_number?: number | null;
          workout_log_id?: string | null;
        };
        Update: {
          coach_feedback?: Json | null;
          coach_id?: string | null;
          created_at?: string | null;
          day_of_week?: string | null;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          exercise_name?: string | null;
          file_size?: number | null;
          id?: string;
          metadata?: Json | null;
          processing_status?: string | null;
          requires_review?: boolean | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          training_plan_id?: string | null;
          training_session_id?: string | null;
          type?: string;
          updated_at?: string | null;
          user_id?: string | null;
          user_notes?: string | null;
          video_url?: string;
          week_number?: number | null;
          workout_log_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_training_videos_coach_id";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          address: string | null;
          age: number | null;
          avatar_url: string | null;
          bio: string | null;
          birth_date: string | null;
          created_at: string | null;
          fitness_goal: string | null;
          fitness_level: string | null;
          full_name: string | null;
          gender: string | null;
          height: number | null;
          id: string;
          lifestyle: string | null;
          nickname: string | null;
          onboarding_completed: boolean | null;
          phone: string | null;
          sport_cards: Json | null;
          updated_at: string | null;
          user_id: string | null;
          weight: number | null;
        };
        Insert: {
          address?: string | null;
          age?: number | null;
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string | null;
          fitness_goal?: string | null;
          fitness_level?: string | null;
          full_name?: string | null;
          gender?: string | null;
          height?: number | null;
          id?: string;
          lifestyle?: string | null;
          nickname?: string | null;
          onboarding_completed?: boolean | null;
          phone?: string | null;
          sport_cards?: Json | null;
          updated_at?: string | null;
          user_id?: string | null;
          weight?: number | null;
        };
        Update: {
          address?: string | null;
          age?: number | null;
          avatar_url?: string | null;
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string | null;
          fitness_goal?: string | null;
          fitness_level?: string | null;
          full_name?: string | null;
          gender?: string | null;
          height?: number | null;
          id?: string;
          lifestyle?: string | null;
          nickname?: string | null;
          onboarding_completed?: boolean | null;
          phone?: string | null;
          sport_cards?: Json | null;
          updated_at?: string | null;
          user_id?: string | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_user";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          admin_permissions: string[] | null;
          admin_role: string | null;
          coach_status: string | null;
          created_at: string | null;
          email: string | null;
          has_drawn: boolean | null;
          id: string;
          is_admin: boolean | null;
          is_coach: boolean | null;
          last_login_at: string | null;
          password_hash: string;
          phone: string | null;
          primary_role: string | null;
          subscription_expires_at: string | null;
          subscription_level: string | null;
          updated_at: string | null;
        };
        Insert: {
          admin_permissions?: string[] | null;
          admin_role?: string | null;
          coach_status?: string | null;
          created_at?: string | null;
          email?: string | null;
          has_drawn?: boolean | null;
          id?: string;
          is_admin?: boolean | null;
          is_coach?: boolean | null;
          last_login_at?: string | null;
          password_hash: string;
          phone?: string | null;
          primary_role?: string | null;
          subscription_expires_at?: string | null;
          subscription_level?: string | null;
          updated_at?: string | null;
        };
        Update: {
          admin_permissions?: string[] | null;
          admin_role?: string | null;
          coach_status?: string | null;
          created_at?: string | null;
          email?: string | null;
          has_drawn?: boolean | null;
          id?: string;
          is_admin?: boolean | null;
          is_coach?: boolean | null;
          last_login_at?: string | null;
          password_hash?: string;
          phone?: string | null;
          primary_role?: string | null;
          subscription_expires_at?: string | null;
          subscription_level?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      coach_pending_reviews: {
        Row: {
          created_at: string | null;
          exercise_name: string | null;
          id: string | null;
          thumbnail_url: string | null;
          training_plan_id: string | null;
          type: string | null;
          user_id: string | null;
          user_name: string | null;
          user_notes: string | null;
          video_url: string | null;
        };
        Relationships: [];
      };
      training_statistics: {
        Row: {
          avg_duration_minutes: number | null;
          completed_sessions: number | null;
          completion_percentage: number | null;
          last_training_date: string | null;
          plan_id: string | null;
          total_completed_sets: number | null;
          total_sessions: number | null;
          total_sets: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_records_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_video_timeline: {
        Row: {
          coach_feedback: Json | null;
          created_at: string | null;
          exercise_name: string | null;
          id: string | null;
          requires_review: boolean | null;
          review_status: string | null;
          reviewed_at: string | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          training_plan_id: string | null;
          type: string | null;
          user_id: string | null;
          user_notes: string | null;
          video_url: string | null;
        };
        Insert: {
          coach_feedback?: Json | null;
          created_at?: string | null;
          exercise_name?: string | null;
          id?: string | null;
          requires_review?: boolean | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          training_plan_id?: string | null;
          type?: string | null;
          user_id?: string | null;
          user_notes?: string | null;
          video_url?: string | null;
        };
        Update: {
          coach_feedback?: Json | null;
          created_at?: string | null;
          exercise_name?: string | null;
          id?: string | null;
          requires_review?: boolean | null;
          review_status?: string | null;
          reviewed_at?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          training_plan_id?: string | null;
          type?: string | null;
          user_id?: string | null;
          user_notes?: string | null;
          video_url?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      calculate_pullup_rankings: {
        Args: { target_month: string };
        Returns: undefined;
      };
      calculate_training_progress: {
        Args: { record_id: string };
        Returns: number;
      };
      create_coach_rulepack: {
        Args: {
          p_coach_id: string;
          p_config_json: Json;
          p_description?: string;
          p_domain: string;
          p_form_schema: Json;
          p_key: string;
          p_name: string;
        };
        Returns: string;
      };
      create_sample_challenge: { Args: never; Returns: string };
      get_coach_rulepacks: {
        Args: { p_coach_id: string };
        Returns: {
          description: string;
          domain: string;
          id: string;
          is_active: boolean;
          key: string;
          name: string;
          version: string;
        }[];
      };
      get_current_active_challenge: {
        Args: never;
        Returns: {
          announcement_date: string;
          description: string;
          end_date: string;
          id: string;
          month_period: string;
          start_date: string;
          status: string;
          submission_deadline: string;
          title: string;
        }[];
      };
      get_last_training_record: {
        Args: { p_current_date: string; p_plan_id: string; p_user_id: string };
        Returns: {
          completed_at: string | null;
          completed_sets: number;
          created_at: string;
          day_number: number;
          duration_minutes: number | null;
          exercises: Json;
          id: string;
          notes: string | null;
          plan_id: string;
          skipped_sets: number;
          started_at: string;
          status: string;
          total_sets: number;
          training_date: string;
          updated_at: string;
          user_id: string;
          week_number: number;
        };
        SetofOptions: {
          from: "*";
          to: "training_records";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_pullup_leaderboard_details: {
        Args: never;
        Returns: {
          created_at: string;
          gender: string;
          id: string;
          name: string;
          notes: string;
          rank: number;
          video_url: string;
          weight_kg: number;
        }[];
      };
      init_default_rulepacks: { Args: never; Returns: undefined };
      insert_sample_training_record: {
        Args: { p_plan_id: string; p_user_id: string };
        Returns: string;
      };
      update_leaderboard_rankings: {
        Args: { challenge_uuid: string };
        Returns: undefined;
      };
      update_pull_up_rankings: { Args: { period: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
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
    ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
