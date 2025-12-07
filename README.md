# No-Q - Queue Less Hospital System

No-Q is a modern hospital queue management system that eliminates crowding and long physical waiting lines in hospitals.  
It uses digital tokens, assigned chambers, and real-time updates so patients and staff can monitor queue status from any device.

The project is built for the Secure Coding module and focuses on implementing robust security features in both backend and frontend.

---

## Main Features

### User Roles

1. **Patient** - Register, get tokens, and monitor queue status
2. **Receptionist** - Register patients and manage queue assignments  
3. **Doctor** - Manage patients in their assigned chamber
4. **Admin** - System management and analytics

### For Patients

- Register with CID and basic details
- Get a token number and assigned chamber
- Check live status of their token
- See current position in the queue
- Get notified when called to the chamber
- Simple and mobile-friendly interface

### For Receptionists

- Register new patients with CID and details
- Select appropriate chamber for each patient
- System generates the next token for that chamber
- View recent registrations
- Monitor queue for each chamber in real-time

### For Doctors

- Secure login with doctor account
- View own profile with specialization and chamber assignment
- See current patient for their chamber
- View waiting queue list for their chamber only
- Call next patient with one click
- Mark current patient as completed
- All updates happen in real-time via SSE

### For Admin

- Manage staff accounts (create, update, deactivate)
- Create receptionists and doctors
- Soft deactivate staff accounts with `is_active` flag
- Manage medical specializations
- Manage chambers and their status
- Assign specialization and chamber to each doctor
- View comprehensive analytics dashboard:
  - Total patients for customizable time ranges
  - Completed and cancelled appointment counts
  - Average waiting time metrics
  - Per-chamber performance statistics
  - Per-doctor productivity statistics

---

## Tech Stack

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database with `pg` client
- **Bcrypt** - Password hashing
- **JSON Web Tokens** - Authentication
- **Server-Sent Events** - Real-time updates
- **dotenv** - Environment variable management

### Frontend

- **Plain HTML/CSS/JavaScript** - No framework dependencies
- **Separate pages** for each user role
- **Fetch API** - Backend communication
- **Local Storage** - JWT token persistence
- **SSE** - Live queue and status updates

---

## Security Features

This project is built for a Secure Coding course and implements comprehensive security measures:

### Authentication & Authorization

1. **Password Security**
   - All staff passwords are hashed with bcrypt
   - No plain text password storage
   - Strong password policies enforced

2. **JWT Authentication**
   - Login returns a cryptographically signed JWT
   - Token contains staff ID, CID, and role
   - Configurable token expiry time
   - Secure token storage in localStorage

3. **Role-Based Access Control**
   - `authenticateStaff` middleware validates JWT tokens
   - `authorizeRole` middleware enforces role permissions
   - Admin-only routes for staff management, specializations, chambers, and analytics
   - Doctors can only access their own profiles

### Data Protection

4. **Soft Delete Implementation**
   - Staff accounts deactivated with `is_active` flag
   - Historical data and references preserved
   - Audit trail maintained

5. **Database Constraints**
   - Unique CID constraint for staff
   - Unique chamber numbers and specialization names
   - Foreign key constraints from doctor profiles to staff, specializations, and chambers
   - Data integrity enforced at database level

6. **Route Protection**
   - All admin and doctor routes require valid JWT
   - Doctor profile access restricted to own profile only
   - API endpoints protected with appropriate middleware
   - Environment-based configuration management
   - Secure session management

---

## Project Structure

```
No-Q/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables
├── config/
│   ├── database.js           # PostgreSQL connection
│   └── jwt.js                # JWT helpers and middleware
├── middleware/
│   └── auth.js               # Authentication and role-based access
├── models/
│   ├── Staff.js              # Staff model and operations
│   ├── Patient.js            # Patient model and operations
│   ├── Queue.js              # Queue management model
│   └── Analytics.js          # Analytics data model
├── routes/
│   ├── staff.js              # Staff authentication and management
│   ├── patients.js           # Patient registration and queue operations
│   ├── doctor.js             # Doctor profiles, specializations, chambers
│   ├── queue.js              # Queue operations and SSE
│   └── analytics.js          # Analytics API endpoints
├── public/
│   ├── index.html            # Landing page
│   ├── patient-portal.html   # Patient registration and status
│   ├── patient-status.html   # Token status display
│   ├── staff-portal.html     # Staff login
│   ├── receptionist-dashboard.html  # Receptionist interface
│   ├── doctor-dashboard.html # Doctor queue management
│   ├── admin-dashboard.html  # Admin main dashboard
│   ├── staff-management.html # Staff CRUD operations
│   ├── doctor-profile-management.html # Doctor profile assignment
│   ├── specializations-management.html # Specialization CRUD
│   ├── chambers-management.html # Chamber CRUD
│   ├── analytics-dashboard.html # Analytics and reporting
│   ├── scripts/
│   │   ├── *.js              # Frontend logic for each page
│   └── styles/
│       └── *.css             # Styling and responsive design
└── database/
    └── schema.sql            # Database schema and initial data
```

---

## Installation and Setup

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd No-Q
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

4. **Database setup**
   ```bash
   # Create PostgreSQL database
   createdb no_q_hospital
   
   # Run schema and initial data
   psql -d no_q_hospital -f database/schema.sql
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=no_q_hospital
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development
```

---

## API Endpoints

### Authentication

- `POST /api/staff/login` - Staff login
- `GET /api/staff` - Get all staff (admin only)
- `POST /api/staff` - Create new staff (admin only)
- `PUT /api/staff/:id` - Update staff (admin only)
- `DELETE /api/staff/:id` - Deactivate staff (admin only)

### Patients & Queue

- `POST /api/patients/register` - Register new patient
- `GET /api/patients/token/:tokenNumber` - Get token status
- `GET /api/queue/current?chamber={id}` - Get current patient and queue
- `POST /api/queue/call-next` - Call next patient
- `POST /api/queue/complete/:tokenNumber` - Complete patient
- `GET /api/patients/updates` - SSE stream for real-time updates

### Doctor Management

- `GET /api/doctor/specializations` - Get all specializations
- `POST /api/doctor/specializations` - Create specialization (admin)
- `PUT /api/doctor/specializations/:id` - Update specialization (admin)
- `DELETE /api/doctor/specializations/:id` - Delete specialization (admin)
- `GET /api/doctor/chambers` - Get all chambers
- `POST /api/doctor/chambers` - Create chamber (admin)
- `PUT /api/doctor/chambers/:id` - Update chamber (admin)
- `DELETE /api/doctor/chambers/:id` - Delete chamber (admin)
- `GET /api/doctor/profile/:staffId` - Get doctor profile
- `POST /api/doctor/profile` - Create doctor profile (admin)
- `DELETE /api/doctor/profile/:staffId` - Delete doctor profile (admin)

### Analytics

- `GET /api/analytics?range={today|week|month}` - Get analytics data

---

## Usage Guide

### For Patients

1. Visit the patient portal URL
2. Register with your CID number and basic details
3. Receive your token number and chamber assignment
4. Monitor your status on the status page or wait for notifications

### For Staff

1. Login using your CID and password
2. Access your role-specific dashboard
3. Perform your assigned tasks based on your role

### For Admins

1. Login with admin credentials
2. Access the admin dashboard
3. Manage staff, specializations, and chambers
4. Monitor system performance through analytics

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Security Considerations

When contributing to this project, please ensure:

- All user inputs are validated and sanitized
- Database queries use parameterized statements
- Sensitive data is properly encrypted
- Authentication and authorization are properly implemented
- Error messages don't leak sensitive information
- Follow secure coding best practices

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Future Enhancements

- SMS/Email notifications for patients
- Mobile app for patients
- Advanced analytics and reporting
- Multi-hospital support
- Integration with hospital management systems
- Appointment scheduling system
- Digital payment integration
