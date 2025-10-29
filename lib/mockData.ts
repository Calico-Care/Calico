export type VitalTrend = 'up' | 'down' | 'stable';

export interface VitalMetric {
  label: string;
  value: string;
  trend: VitalTrend;
  delta?: string;
  threshold?: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  program: 'CHF' | 'COPD';
  riskLevel: 'green' | 'yellow' | 'red';
  lastAlert: string;
  metrics: VitalMetric[];
  notes: string;
}

export interface PatientDetail {
  name: string;
  program: 'CHF' | 'COPD';
  room: string;
  primaryClinician: string;
  nextCheckIn: string;
  carePlan: string[];
  metrics: VitalMetric[];
  recentAlerts: Array<{ id: string; createdAt: string; message: string; resolved: boolean }>;
}

export const clinicianPatients: PatientSummary[] = [
  {
    id: 'patient-001',
    name: 'Avery Johnson',
    age: 68,
    program: 'CHF',
    riskLevel: 'yellow',
    lastAlert: 'Weight spike flagged 2h ago',
    metrics: [
      {
        label: 'Weight',
        value: '205 lb',
        trend: 'up',
        delta: '+3.1 lb vs yesterday',
        threshold: 'Target < 202 lb',
      },
      { label: 'BP', value: '132 / 86', trend: 'stable', threshold: 'Goal < 130 / 80' },
      { label: 'SpO₂', value: '95%', trend: 'stable' },
    ],
    notes: 'Care team reviewing diuretic adjustments after weekend sodium intake.',
  },
  {
    id: 'patient-014',
    name: 'Miguel Torres',
    age: 61,
    program: 'COPD',
    riskLevel: 'green',
    lastAlert: 'No alerts in last 48h',
    metrics: [
      { label: 'Steps', value: '4,120', trend: 'up', delta: '+12% vs baseline' },
      { label: 'FEV1', value: '2.1 L', trend: 'stable' },
      { label: 'SpO₂', value: '97%', trend: 'stable' },
    ],
    notes: 'Participating in morning pulmonary rehab sessions consistently.',
  },
  {
    id: 'patient-020',
    name: 'Sasha Patel',
    age: 74,
    program: 'CHF',
    riskLevel: 'red',
    lastAlert: 'Escalated call completed 30m ago',
    metrics: [
      {
        label: 'Weight',
        value: '188 lb',
        trend: 'up',
        delta: '+4.2 lb vs last week',
        threshold: 'Target < 183 lb',
      },
      {
        label: 'BP',
        value: '146 / 92',
        trend: 'up',
        delta: '+8 systolic',
        threshold: 'Goal < 130 / 80',
      },
      {
        label: 'SpO₂',
        value: '92%',
        trend: 'down',
        delta: '-2% vs baseline',
        threshold: 'Alert < 93%',
      },
    ],
    notes: 'Urgent callback scheduled with cardiology triage after persistent congestion report.',
  },
];

export const patientDetail: PatientDetail = {
  name: 'Avery Johnson',
  program: 'CHF',
  room: 'Calico Home Monitoring',
  primaryClinician: 'Dr. Priya Shah',
  nextCheckIn: 'Today • 5:00 PM',
  carePlan: [
    'Daily weight capture before breakfast',
    'Low-sodium meal plan with hydration log',
    'Beta blocker review during weekly telehealth visit',
    'Escalate if weight ↑ >2 lb in 24h or SpO₂ < 93%',
  ],
  metrics: [
    {
      label: 'Weight',
      value: '205 lb',
      trend: 'up',
      delta: '+3.1 lb vs yesterday',
      threshold: 'Target < 202 lb',
    },
    { label: 'BP', value: '132 / 86', trend: 'stable', threshold: 'Goal < 130 / 80' },
    { label: 'Resting HR', value: '78 bpm', trend: 'stable' },
    { label: 'SpO₂', value: '95%', trend: 'stable' },
  ],
  recentAlerts: [
    {
      id: 'alert-01',
      createdAt: 'Today • 2:15 PM',
      message: 'Weight increase of 3.1 lb detected across consecutive readings.',
      resolved: false,
    },
    {
      id: 'alert-02',
      createdAt: 'Yesterday • 6:05 PM',
      message: 'Patient reported mild swelling during VAPI questionnaire.',
      resolved: true,
    },
    {
      id: 'alert-03',
      createdAt: 'Mon • 8:40 AM',
      message: 'Daily Terra sync completed: vitals within acceptable thresholds.',
      resolved: true,
    },
  ],
};
