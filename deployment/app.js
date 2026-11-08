// Passenger Application Startup File
// Used by cPanel CloudLinux NodeJS Selector / Phusion Passenger

import('./server.js')
  .then(() => {
    console.log('[cPanel Passenger] SKILLBRIDGE application booted successfully.');
  })
  .catch((err) => {
    console.error('[cPanel Passenger] Fatal startup error:', err);
    process.exit(1);
  });
