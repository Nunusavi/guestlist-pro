-- GuestList Pro Seed Data
-- Sample data for testing

-- =====================================================
-- Seed: Ushers
-- Password for all: "password123" (will be hashed properly in Batch 4)
-- =====================================================
INSERT INTO ushers (usher_id, username, password_hash, full_name, role, active, created_at) VALUES
('U001', 'admin', '$2a$10$rKJ8TuJa5z.QQq0YvXqJnO7gVJ8LqXyHZqNxqJ8mJ9gKqXyHZqNxq', 'Admin User', 'Admin', true, NOW()),
('U002', 'usher1', '$2a$10$rKJ8TuJa5z.QQq0YvXqJnO7gVJ8LqXyHZqNxqJ8mJ9gKqXyHZqNxq', 'John Usher', 'Usher', true, NOW()),
('U003', 'usher2', '$2a$10$rKJ8TuJa5z.QQq0YvXqJnO7gVJ8LqXyHZqNxqJ8mJ9gKqXyHZqNxq', 'Jane Usher', 'Usher', true, NOW());

-- =====================================================
-- Seed: Guests
-- Mix of checked-in and not checked-in guests
-- =====================================================
INSERT INTO guests (id, first_name, last_name, email, phone, ticket_type, plus_ones_allowed, status, created_at) VALUES
('G001', 'John', 'Smith', 'john.smith@email.com', '+1-555-0101', 'VIP', 2, 'Not Checked In', NOW()),
('G002', 'Sarah', 'Johnson', 'sarah.j@email.com', '+1-555-0102', 'General', 1, 'Not Checked In', NOW()),
('G003', 'Michael', 'Williams', 'm.williams@email.com', '+1-555-0103', 'VIP', 3, 'Not Checked In', NOW()),
('G004', 'Emily', 'Brown', 'emily.brown@email.com', '+1-555-0104', 'General', 0, 'Not Checked In', NOW()),
('G005', 'David', 'Jones', 'david.jones@email.com', '+1-555-0105', 'Premium', 2, 'Not Checked In', NOW()),
('G006', 'Lisa', 'Garcia', 'lisa.garcia@email.com', '+1-555-0106', 'General', 1, 'Not Checked In', NOW()),
('G007', 'James', 'Martinez', 'j.martinez@email.com', '+1-555-0107', 'VIP', 4, 'Not Checked In', NOW()),
('G008', 'Maria', 'Rodriguez', 'maria.r@email.com', '+1-555-0108', 'General', 0, 'Not Checked In', NOW()),
('G009', 'Robert', 'Davis', 'robert.davis@email.com', '+1-555-0109', 'Premium', 2, 'Not Checked In', NOW()),
('G010', 'Jennifer', 'Lopez', 'jennifer.l@email.com', '+1-555-0110', 'VIP', 3, 'Not Checked In', NOW()),
('G011', 'William', 'Miller', 'w.miller@email.com', '+1-555-0111', 'General', 1, 'Not Checked In', NOW()),
('G012', 'Elizabeth', 'Wilson', 'e.wilson@email.com', '+1-555-0112', 'Premium', 2, 'Not Checked In', NOW()),
('G013', 'Thomas', 'Moore', 'thomas.m@email.com', '+1-555-0113', 'VIP', 2, 'Not Checked In', NOW()),
('G014', 'Linda', 'Taylor', 'linda.t@email.com', '+1-555-0114', 'General', 0, 'Not Checked In', NOW()),
('G015', 'Christopher', 'Anderson', 'chris.a@email.com', '+1-555-0115', 'Premium', 3, 'Not Checked In', NOW());

-- =====================================================
-- Pre-checked in guests (for testing)
-- =====================================================
UPDATE guests 
SET 
    status = 'Checked In',
    check_in_time = NOW() - INTERVAL '30 minutes',
    confirmation_code = 'usher1-johnsmith-1704067200000',
    checked_in_by = 'John Usher',
    plus_ones_checked_in = 1
WHERE id = 'G001';

UPDATE guests 
SET 
    status = 'Checked In',
    check_in_time = NOW() - INTERVAL '45 minutes',
    confirmation_code = 'usher2-sarahjohnson-1704067100000',
    checked_in_by = 'Jane Usher',
    plus_ones_checked_in = 0
WHERE id = 'G002';

UPDATE guests 
SET 
    status = 'Checked In',
    check_in_time = NOW() - INTERVAL '1 hour',
    confirmation_code = 'usher1-michaelwilliams-1704066600000',
    checked_in_by = 'John Usher',
    plus_ones_checked_in = 2
WHERE id = 'G003';

-- =====================================================
-- Seed: Check-in log entries for pre-checked guests
-- =====================================================
INSERT INTO check_in_log (guest_id, guest_name, action, usher_name, plus_ones_count, confirmation_code, timestamp) VALUES
('G001', 'John Smith', 'Check In', 'John Usher', 1, 'usher1-johnsmith-1704067200000', NOW() - INTERVAL '30 minutes'),
('G002', 'Sarah Johnson', 'Check In', 'Jane Usher', 0, 'usher2-sarahjohnson-1704067100000', NOW() - INTERVAL '45 minutes'),
('G003', 'Michael Williams', 'Check In', 'John Usher', 2, 'usher1-michaelwilliams-1704066600000', NOW() - INTERVAL '1 hour');

-- =====================================================
-- Display summary
-- =====================================================
SELECT 
    'Ushers' as table_name, 
    COUNT(*) as record_count 
FROM ushers
UNION ALL
SELECT 
    'Guests' as table_name, 
    COUNT(*) as record_count 
FROM guests
UNION ALL
SELECT 
    'Check-in Logs' as table_name, 
    COUNT(*) as record_count 
FROM check_in_log
ORDER BY table_name;