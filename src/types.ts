export interface Profile {
  id: number;
  name: string;
  relationship: string;
  is_master: number;
}

export interface LabResult {
  test: string;
  result: string;
  unit: string;
  reference_range: string;
  interpretation: string;
}

export interface StructuredMedicalData {
  time?: string;
  hospital?: string;
  reason_for_visit?: string;
  symptoms?: string[];
  lab_results?: LabResult[];
  diagnosis?: string;
  plan?: string;
}

export interface MedicalRecord {
  id: number;
  profile_id: number;
  date: string;
  summary: string;
  full_text: string; // Stores StructuredMedicalData as JSON
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
