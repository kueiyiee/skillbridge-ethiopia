# Database Setup Guide

The maintained database and cPanel setup guides are:

- [Database architecture and safety](database.md)
- [cPanel deployment and connection requirements](deployment-cpanel.md)

The existing PostgreSQL database is protected production data and has not been migrated. Do not run the MySQL baseline against it. Obtain a separate MySQL database, host, port, and least-privilege user from the hosting provider. Keep credentials in protected environment settings, and verify the new target using `/api/health/ready` before deployment.