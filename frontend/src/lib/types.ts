export type UserRole = 'admin' | 'doctor' | 'client'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  phone: string | null
}

export interface Client {
  id: number
  doctor_user_id: number | null
  user_id: number | null
  full_name: string
  birth_date: string | null
  phone: string | null
  email: string | null
  allergies: string | null
  contraindications: string | null
}

export interface Visit {
  id: number
  client_id: number
  visit_date: string
  notes: string | null
}

export interface VisitPhoto {
  id: number
  visit_id: number
  url: string
  sort_order: number
  kind: string
}

export interface Procedure {
  id: number
  name: string
  duration_minutes: number
  buffer_after_minutes: number
  active: boolean
}

export interface Appointment {
  id: number
  doctor_user_id: number
  procedure_id: number
  client_id: number | null
  guest_name: string | null
  guest_phone: string | null
  guest_email: string | null
  start_at: string
  end_at: string
  status: string
  procedure?: Procedure | null
}

export interface Product {
  id: number
  name: string
  inci: string | null
  skin_types: string[]
  concerns: string[]
  contraindications: string | null
  is_clinic_custom: boolean
}

export interface DoctorPublic {
  user_id: number
  full_name: string
  working_hours: { weekday: number; start: string; end: string }[]
}

export interface ClinicPublic {
  slug: string
  name: string
  procedures: Procedure[]
  doctors: DoctorPublic[]
}

export interface Slot {
  start_at: string
  end_at: string
}

export interface CarePlanItem {
  id: number
  product_id: number
  period: string
  step_order: number
  frequency: string | null
  product?: Product | null
}

export interface CarePlan {
  id: number
  client_id: number
  doctor_user_id: number
  visit_id: number | null
  visit_date: string | null
  skin_type: string
  concerns: string[]
  notes: string | null
  items: CarePlanItem[]
}

export interface DashboardSeriesPoint {
  date: string
  count: number
}

export interface Dashboard {
  appointments_week: number
  cancellations_week: number
  clients_total: number
  revenue_placeholder: number
  series_7d: DashboardSeriesPoint[]
}

export interface DashboardScheduleItem {
  id: number
  start_at: string
  end_at: string
  procedure_name: string
  client_full_name: string | null
  status: string
}

export interface RecentVisit {
  visit_id: number
  client_id: number
  client_full_name: string
  visit_date: string
  first_photo_url: string | null
}

export interface UpcomingBirthday {
  client_id: number
  full_name: string
  birth_date: string
  days_until: number
}

export interface AnalyticsPoint {
  date: string
  count: number
}

export interface StatusBucket {
  status: string
  count: number
}

export interface ProcedureCount {
  procedure_id: number
  name: string
  count: number
}

export interface AgeBucket {
  bucket: string
  count: number
}
