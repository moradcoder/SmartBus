export interface BusLine {
  id: string;
  number: string;
  name_ar: string;
  name_fr: string;
  color: string;
  direction: string | null;
  waypoints: [number, number][];
  is_active: boolean;
}

export interface Station {
  id: string;
  code: string | null;
  name_ar: string;
  name_fr: string;
  lat: number;
  lng: number;
  has_shelter: boolean;
  is_active: boolean;
}

export interface LineStation {
  id: string;
  line_id: string;
  station_id: string;
  sequence: number;
  station?: Station;
}

// lib/types.ts
export interface Bus {
  id: string;
  plate: string;
  model: string;
  capacity: number;
  status: string;
  line_id?: string;
  driver_id?: string;
  current_lat: number;
  current_lng: number;
  heading: number;
  speed: number;
  last_updated: string | null;
  created_at: string;
  line?: BusLine;
}

export interface Driver {
  id: string;
  name: string;
  license_number: string | null;
  phone: string | null;
  status: 'on_duty' | 'in_service' | 'break' | 'off_duty';
  bus_id: string | null;
}

export interface Trip {
  id: string;
  line_id: string;
  bus_id: string | null;
  driver_id: string | null;
  departure_time: string;
  arrival_time: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface Announcement {
  id: string;
  title_ar: string;
  title_fr: string;
  body_ar: string;
  body_fr: string;
  type: 'info' | 'alert' | 'news';
  is_published: boolean;
  published_at: string;
}

export interface Report {
  id: string;
  type: 'delay' | 'breakdown' | 'service_note' | 'other';
  bus_id: string | null;
  line_id: string | null;
  message: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  reporter_name: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string | null;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  lang: string;
  created_at: string;
}

export interface Faq {
  id: string;
  question_ar: string;
  question_fr: string;
  answer_ar: string;
  answer_fr: string;
  category: string | null;
  sort_order: number;
}

export interface ActivityLog {
  id: string;
  actor: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
}

export interface Settings {
  id: number;
  city_name_ar: string;
  city_name_fr: string;
  company_name_ar: string;
  company_name_fr: string;
  primary_color: string;
  logo_url: string | null;
  default_lat: number;
  default_lng: number;
}
