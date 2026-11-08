# Deployment Documentation

The maintained Node.js/Passenger and MySQL deployment guide is [docs/deployment-cpanel.md](../docs/deployment-cpanel.md).

Build the package from the project root using `bash deployment/build-cpanel-package.sh` in WSL or Git Bash. The package script builds the frontend and server bundle; it does not connect to, migrate, reset, or seed the hosted database.