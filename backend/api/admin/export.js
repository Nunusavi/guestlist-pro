import db from '../services/database.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import { info, error as logError } from '../../utils/logger.js';

/**
 * POST /api/admin/export
 * Generate CSV export of guests (Admin only)
 * 
 * Body params:
 * - status: Filter by status ('Checked In', 'Not Checked In')
 * - ticketType: Filter by ticket type ('VIP', 'General', 'Premium')
 * - startDate: Filter by check-in start date
 * - endDate: Filter by check-in end date
 * 
 * Returns: CSV file download
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method Not Allowed',
            message: 'Only POST requests are allowed'
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

        // Extract filters from request body
        const { status, ticketType, startDate, endDate } = req.body;

        // Validate date formats if provided
        if (startDate && isNaN(Date.parse(startDate))) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid startDate format. Use ISO format (YYYY-MM-DD)',
                details: { field: 'startDate' }
            });
        }

        if (endDate && isNaN(Date.parse(endDate))) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid endDate format. Use ISO format (YYYY-MM-DD)',
                details: { field: 'endDate' }
            });
        }

        // Build WHERE clause dynamically
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (ticketType) {
            conditions.push(`ticket_type = $${paramIndex}`);
            params.push(ticketType);
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`check_in_time >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            // Add one day to include the entire end date
            const endDateTime = new Date(endDate);
            endDateTime.setDate(endDateTime.getDate() + 1);
            conditions.push(`check_in_time < $${paramIndex}`);
            params.push(endDateTime.toISOString());
            paramIndex++;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Fetch all guests matching filters
        const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        ticket_type,
        plus_ones_allowed,
        confirmation_code,
        check_in_time,
        plus_ones_checked_in,
        status,
        notes,
        checked_in_by,
        created_at
      FROM guests
      ${whereClause}
      ORDER BY last_name ASC, first_name ASC
    `;

        const result = await db.query(query, params);
        const guests = result.rows;

        // Generate CSV content
        const csv = generateCSV(guests);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `guestlist_export_${timestamp}.csv`;

        // Set response headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));

        info('Guest list exported', {
            username: req.user.username,
            count: guests.length,
            filters: { status, ticketType, startDate, endDate },
            filename
        });

        // Send CSV content
        return res.status(200).send(csv);

    } catch (err) {
        logError('Error exporting guest list', {
            error: err.message,
            stack: err.stack,
            body: req.body,
            username: req.user?.username
        });

        // If headers already sent, can't send JSON error
        if (res.headersSent) {
            return res.end();
        }

        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to export guest list'
        });
    }
}

/**
 * Generate CSV content from guest data
 * @param {Array} guests - Array of guest objects
 * @returns {string} CSV string
 */
function generateCSV(guests) {
    // Define CSV headers
    const headers = [
        'ID',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Ticket Type',
        'Plus Ones Allowed',
        'Status',
        'Check-In Time',
        'Plus Ones Checked In',
        'Confirmation Code',
        'Checked In By',
        'Notes',
        'Created At'
    ];

    // Start with header row
    const rows = [headers.join(',')];

    // Add data rows
    for (const guest of guests) {
        const row = [
            guest.id,
            escapeCSV(guest.first_name),
            escapeCSV(guest.last_name),
            escapeCSV(guest.email),
            escapeCSV(guest.phone),
            escapeCSV(guest.ticket_type),
            guest.plus_ones_allowed,
            escapeCSV(guest.status),
            guest.check_in_time ? new Date(guest.check_in_time).toISOString() : '',
            guest.plus_ones_checked_in || 0,
            escapeCSV(guest.confirmation_code || ''),
            escapeCSV(guest.checked_in_by || ''),
            escapeCSV(guest.notes || ''),
            guest.created_at ? new Date(guest.created_at).toISOString() : ''
        ];

        rows.push(row.join(','));
    }

    // Join all rows with newlines
    return rows.join('\n');
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 * @param {string} field - Field value
 * @returns {string} Escaped field
 */
function escapeCSV(field) {
    if (field == null) return '';

    const str = String(field);

    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}