-- GuestList Pro Database Schema
-- PostgreSQL / Neon Database

-- =====================================================
-- Drop tables if they exist (for clean setup / idempotent rebuild)
-- (Order: drop dependent tables first)
-- =====================================================
DROP TABLE IF EXISTS check_in_log CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS ushers CASCADE;

-- =====================================================
-- Table: guests  (Stores ALL guest information)
-- =====================================================
CREATE TABLE guests (
    id                  VARCHAR(10) PRIMARY KEY,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(20),
    ticket_type         VARCHAR(50)  NOT NULL,
    plus_ones_allowed   INTEGER      DEFAULT 0,
    confirmation_code   VARCHAR(255),
    check_in_time       TIMESTAMP,
    plus_ones_checked_in INTEGER     DEFAULT 0,
    status              VARCHAR(50)  DEFAULT 'Not Checked In',
    notes               TEXT,
    last_modified       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    checked_in_by       VARCHAR(100),
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plus_ones_count CHECK (plus_ones_checked_in <= COALESCE(plus_ones_allowed,0))
);

-- Indexes for guests table
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_name ON guests(last_name, first_name);
CREATE INDEX idx_guests_confirmation ON guests(confirmation_code);
CREATE INDEX idx_guests_check_in_time ON guests(check_in_time);

-- =====================================================
-- Table: ushers  (Stores usher/admin user accounts)
-- =====================================================
CREATE TABLE ushers (
    usher_id      VARCHAR(10) PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  DEFAULT 'Usher',
    active        BOOLEAN      DEFAULT true,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    last_login    TIMESTAMP
);

-- Indexes for ushers table
CREATE INDEX idx_ushers_username ON ushers(username);
CREATE INDEX idx_ushers_active   ON ushers(active);
CREATE INDEX idx_ushers_role     ON ushers(role);

-- =====================================================
-- Table: check_in_log  (Audit trail for ALL check-in/undo operations)
-- =====================================================
CREATE TABLE check_in_log (
    id                SERIAL PRIMARY KEY,
    timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guest_id          VARCHAR(10),
    guest_name        VARCHAR(200),
    action            VARCHAR(50) NOT NULL,
    usher_name        VARCHAR(100),
    plus_ones_count   INTEGER DEFAULT 0,
    notes             TEXT,
    confirmation_code VARCHAR(255),
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);

-- Indexes for check_in_log table
CREATE INDEX idx_log_timestamp ON check_in_log(timestamp DESC);
CREATE INDEX idx_log_guest_id  ON check_in_log(guest_id);
CREATE INDEX idx_log_action    ON check_in_log(action);

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE guests IS 'Stores all event guest information';
COMMENT ON TABLE ushers IS 'User accounts for ushers and administrators';
COMMENT ON TABLE check_in_log IS 'Audit trail for check-in operations';
COMMENT ON COLUMN guests.confirmation_code IS 'Generated when guest checks in: {usher}-{name}-{timestamp}';
COMMENT ON COLUMN guests.status IS 'Values: Not Checked In, Checked In';
COMMENT ON COLUMN ushers.role IS 'Values: Usher, Admin';
COMMENT ON COLUMN check_in_log.action IS 'Values: Check In, Undo Check In, Bulk Check In';