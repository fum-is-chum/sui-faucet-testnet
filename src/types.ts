export type Proxy = {
  proxy: string;
  protocol: string;
  ip: string;
  port: number;
  https: boolean;
  anonymity?: string;
  score?: number;
  geolocation?: {
    country: string;
    city: string;
  };
};