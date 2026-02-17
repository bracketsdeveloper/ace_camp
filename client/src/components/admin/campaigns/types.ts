export interface Campaign {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  maxProductsPerUser?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertCampaign {
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  maxProductsPerUser?: number | null;
}