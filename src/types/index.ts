export interface User {
  id: string;
  email: string;
  name: string;
  role: 'coach' | 'client';
  created_at: string;
}

export interface Coach extends User {
  role: 'coach';
  bio?: string;
  specialties: string[];
}

export interface Client extends User {
  role: 'client';
  goals: string[];
}

export interface Session {
  id: string;
  coach_id: string;
  client_id: string;
  scheduled_time: string;
  duration: number; // in minutes
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  timestamp: string;
  read: boolean;
}