import { apiRequest } from "./client";

export interface Emergency {
  id: number;
  user_id?: number;
  user_name?: string;
  emergency_type: string;
  latitude: number;
  longitude: number;
  message: string | null;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  created_at?: string;
  acknowledged_at?: string | null;
}

interface CreateEmergencyResponse {
  message: string;
  emergency: Emergency;
}

interface EmergencyListResponse {
  emergencies: Emergency[];
}

export const createEmergency = (
  token: string,
  emergencyType: string,
  latitude: number,
  longitude: number,
  message?: string
) => {
  return apiRequest<CreateEmergencyResponse>(
    "/emergencies",
    {
      method: "POST",
      token,
      body: JSON.stringify({
        emergencyType,
        latitude,
        longitude,
        message,
      }),
    }
  );
};

export const getMyEmergencies = (
  token: string
) => {
  return apiRequest<EmergencyListResponse>(
    "/emergencies/my",
    {
      method: "GET",
      token,
    }
  );
};

export const getActiveEmergencies = (
  token: string
) => {
  return apiRequest<EmergencyListResponse>(
    "/emergencies/active",
    {
      method: "GET",
      token,
    }
  );
};

export const acknowledgeEmergency = (
  token: string,
  emergencyId: number
) => {
  return apiRequest(
    `/emergencies/${emergencyId}/acknowledge`,
    {
      method: "PATCH",
      token,
    }
  );
};

export const resolveEmergency = (
  token: string,
  emergencyId: number
) => {
  return apiRequest(
    `/emergencies/${emergencyId}/resolve`,
    {
      method: "PATCH",
      token,
    }
  );
};