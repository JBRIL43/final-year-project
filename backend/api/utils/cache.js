const memoryCache = new Map();

let redisClient = null;
let redisConnectPromise = null;

async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (redisClient?.isOpen) return redisClient;

  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      try {
        const { createClient } = require('redis');
        const client = createClient({ url: redisUrl });
        client.on('error', (err) => console.error('Redis client error:', err.message));
        await client.connect();
        redisClient = client;
        return client;
      } catch (error) {
        console.warn('Redis unavailable; using in-memory cache fallback:', error.message);
        redisConnectPromise = null;
        return null;
      }
    })();
  }

  return redisConnectPromise;
}

async function cacheGet(key) {
  const redis = await getRedisClient();
  if (redis) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

async function cacheSet(key, value, ttlSeconds) {
  const serialized = JSON.stringify(value);
  const redis = await getRedisClient();
  if (redis) {
    await redis.setEx(key, ttlSeconds, serialized);
    return;
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function cacheDel(...keys) {
  if (!keys.length) return;

  const redis = await getRedisClient();
  if (redis) {
    await redis.del(keys);
  }

  for (const key of keys) {
    memoryCache.delete(key);
  }
}

async function redisScanDelete(pattern) {
  const redis = await getRedisClient();
  if (!redis) return;

  const keysToDelete = [];
  for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keysToDelete.push(key);
    if (keysToDelete.length >= 100) {
      await redis.del(keysToDelete);
      keysToDelete.length = 0;
    }
  }

  if (keysToDelete.length > 0) {
    await redis.del(keysToDelete);
  }
}

async function cacheDelPattern(pattern) {
  const redis = await getRedisClient();
  if (redis) {
    await redisScanDelete(pattern);
    return;
  }

  const prefix = pattern.replace('*', '');
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

const CACHE_KEYS = {
  semesterAmountsAll: 'semester_amounts:all',
  analyticsDebtOverview: 'analytics:debt-overview',
  faydaConfigMeta: 'fayda:config:meta',
};

async function invalidatePaymentCaches() {
  await cacheDel(CACHE_KEYS.analyticsDebtOverview);
}

module.exports = {
  CACHE_KEYS,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  invalidatePaymentCaches,
};
