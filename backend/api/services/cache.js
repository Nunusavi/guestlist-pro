import { info, warn } from '../../utils/logger.js';

/**
 * In-Memory Cache Service
 * Simple TTL-based caching for frequently accessed data
 */

class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttl = parseInt(process.env.CACHE_TTL) || 30000; // 30 seconds default
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            info('Cache expired', { key });
            return null;
        }

        info('Cache hit', { key });
        return item.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} customTtl - Custom TTL in milliseconds
     */
    set(key, value, customTtl = null) {
        const ttl = customTtl || this.ttl;
        const expiry = Date.now() + ttl;

        this.cache.set(key, {
            value,
            expiry,
            createdAt: Date.now(),
        });

        info('Cache set', { key, ttl: `${ttl}ms` });
    }

    /**
     * Delete value from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            info('Cache deleted', { key });
        }
        return deleted;
    }

    /**
     * Clear cache matching pattern
     * @param {string} pattern - Key pattern (supports wildcards with *)
     */
    clearPattern(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        let cleared = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                cleared++;
            }
        }

        if (cleared > 0) {
            info('Cache pattern cleared', { pattern, count: cleared });
        }

        return cleared;
    }

    /**
     * Clear entire cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        info('Cache cleared', { itemsCleared: size });
        return size;
    }

    /**
     * Get cache statistics
     * @returns {object} Cache stats
     */
    getStats() {
        const now = Date.now();
        let expired = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                expired++;
            }
        }

        return {
            total: this.cache.size,
            expired,
            active: this.cache.size - expired,
            ttl: this.ttl,
        };
    }

    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            info('Expired cache cleaned', { count: cleaned });
        }

        return cleaned;
    }
}

// Export singleton instance
const cache = new CacheService();

// Auto-clean expired entries every 60 seconds
setInterval(() => {
    cache.cleanExpired();
}, 60000);

export default cache;