export const serverEnv = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  polygonRpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
};
