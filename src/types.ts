export interface Profile {
  id: number;
  name: string;
  relationship: string;
  is_master: number;
}

export interface MedicalRecord {
  id: number;
  profile_id: number;
  date: string;
  summary: string;
  full_text: string;
  type: string;
  follow_ups: string; // JSON string
}

export interface DailyLog {
  id: number;
  profile_id: number;
  date: string;
  symptom_description: string;
}

export interface InsurancePolicy {
  id: number;
  profile_id: number;
  type: string;
  provider: string;
  benefits_summary: string; // JSON string
  usage_data: string; // JSON string
}

export interface BenefitTerm {
  term: string;
  value: string;
  explanation: string;
}

export interface BenefitsSummary {
  terms: BenefitTerm[];
  limits: {
    label: string;
    used: number;
    total: number;
    explanation: string;
  }[];
  expiration: string;
}
