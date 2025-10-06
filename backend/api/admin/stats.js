import db from '../services/database.js';
import cache from '../services/cache.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import { info, error as logError } from '../../utils/logger.js';

/**
 * GET /api/admin/stats
 * Real-time dashboard statistics (Admin only)
 * 
 * Returns:
 * - Total guests
 * - Checked in count
 * - Not checked in count
 * - Total plus ones checked in
 * - Check-ins in last hour
 * - Check-ins by ticket type
 * - Check-ins by hour (last 24 hours)
 * - Busiest check-in times
 * 
 * Cached for 10 seconds
 */

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only GET requests are allowed'
        });
    }

    try {
        // Apply authentication and admin check
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err) return reject(err);
                requireAdmin(req, res, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Try to get from cache first (10 second cache)
        const cacheKey = 'admin:stats';
        const cached = cache.get(cacheKey);

        if (cached) {
            info('Admin stats served from cache', {
                username: req.user.username
            });

            return res.status(200).json({
                success: true,
                data: cached,
                cached: true
            });
        }

        // Get basic counts
        const basicStatsQuery = `
      SELECT 
        COUNT(*) as total_guests,
        COUNT(CASE WHEN status = 'Checked In' THEN 1 END) as checked_in,
        COUNT(CASE WHEN status = 'Not Checked In' THEN 1 END) as not_checked_in,
        COALESCE(SUM(CASE WHEN status = 'Checked In' THEN plus_ones_checked_in ELSE 0 END), 0) as total_plus_ones
      FROM guests
    `;

        const basicStatsResult = await db.query(basicStatsQuery);
        const basicStats = basicStatsResult.rows[0];

        // Get check-ins in last hour
        const lastHourQuery = `
      SELECT COUNT(*) as count
      FROM guests
      WHERE check_in_time >= NOW() - INTERVAL '1 hour'
      AND status = 'Checked In'
    `;

        const lastHourResult = await db.query(lastHourQuery);
        const lastHourCheckIns = parseInt(lastHourResult.rows[0].count);

        // Get check-ins by ticket type
        const ticketTypeQuery = `
      SELECT 
        ticket_type,
        COUNT(*) as count,
        COALESCE(SUM(plus_ones_checked_in), 0) as plus_ones
      FROM guests
      WHERE status = 'Checked In'
      GROUP BY ticket_type
      ORDER BY count DESC
    `;

        const ticketTypeResult = await db.query(ticketTypeQuery);

        // Get check-ins by hour (last 24 hours)
        const hourlyQuery = `
      SELECT 
        DATE_TRUNC('hour', check_in_time) as hour,
        COUNT(*) as count
      FROM guests
      WHERE check_in_time >= NOW() - INTERVAL '24 hours'
      AND status = 'Checked In'
      GROUP BY hour
      ORDER BY hour DESC
    `;

        const hourlyResult = await db.query(hourlyQuery);

        // Get busiest hours (all time)
        const busiestQuery = `
      SELECT 
        EXTRACT(HOUR FROM check_in_time) as hour_of_day,
        COUNT(*) as count
      FROM guests
      WHERE status = 'Checked In'
      AND check_in_time IS NOT NULL
      GROUP BY hour_of_day
      ORDER BY count DESC
      LIMIT 5
    `;

        const busiestResult = await db.query(busiestQuery);

        // Calculate percentage
        const totalGuests = parseInt(basicStats.total_guests);
        const checkedIn = parseInt(basicStats.checked_in);
        const checkInPercentage = totalGuests > 0
            ? Math.round((checkedIn / totalGuests) * 100)
            : 0;

        // Prepare response data
        const statsData = {
            overview: {
                totalGuests: totalGuests,
                checkedIn: checkedIn,
                notCheckedIn: parseInt(basicStats.not_checked_in),
                checkInPercentage: checkInPercentage,
                totalPlusOnes: parseInt(basicStats.total_plus_ones),
                totalAttendees: checkedIn + parseInt(basicStats.total_plus_ones)
            },
            recent: {
                lastHour: lastHourCheckIns
            },
            byTicketType: ticketTypeResult.rows.map(row => ({
                ticketType: row.ticket_type,
                count: parseInt(row.count),
                plusOnes: parseInt(row.plus_ones),
                total: parseInt(row.count) + parseInt(row.plus_ones)
            })),
            last24Hours: hourlyResult.rows.map(row => ({
                hour: row.hour,
                count: parseInt(row.count)
            })),
            busiestHours: busiestResult.rows.map(row => ({
                hourOfDay: parseInt(row.hour_of_day),
                count: parseInt(row.count),
                hourLabel: formatHour(parseInt(row.hour_of_day))
            })),
            generatedAt: new Date().toISOString()
        };

        // Cache for 10 seconds
        cache.set(cacheKey, statsData, 10000);

        info('Admin stats generated', {
            username: req.user.username,
            totalGuests,
            checkedIn,
            percentage: checkInPercentage
        });

        return res.status(200).json({
            success: true,
            data: statsData
        });

    } catch (err) {
        logError('Error fetching admin stats', {
            error: err.message,
            stack: err.stack,
            username: req.user?.username
        });

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to fetch statistics'
        });
    }
}

/**
 * Format hour (0-23) to 12-hour format with AM/PM
 */
function formatHour(hour) {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
}