export const ROLES = {
  DOCTOR: "doctor",
  NURSE: "nurse",
  SUPPORT_STAFF: "support_staff",
  ADMIN: "admin"
};

export const ALERT_TYPES = {
  LOW_LEVEL: "low_level",
  HIGH_LEVEL: "high_level",
  AIR_BUBBLE: "air_bubble",
  FLOW_RATE_ABNORMAL: "flow_rate_abnormal",
  COMPLETED: "completed",
  DISCONNECTED: "disconnected"
};

export const ALERT_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical"
};

export const FLUID_TYPES = {
  SALINE: "Saline",
  DEXTROSE: "Dextrose",
  RINGERS_LACTATE: "Ringer's Lactate",
  OTHER: "Other"
};

export const NOTIFICATION_TYPES = {
  ALERT: "alert",
  REMINDER: "reminder",
  UPDATE: "update",
  TASK: "task"
};

export const DEFAULT_THRESHOLDS = {
  LOW_LEVEL: 20,
  HIGH_LEVEL: 95,
  AIR_BUBBLE: 5
};