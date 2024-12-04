// ===================================================
// FOR PRODUCTION
// Total.js - framework for Node.js platform
// https://www.totaljs.com
// ===================================================

const options = {};

 options.ip = '192.168.0.2';
// options.port = parseInt(process.argv[2]);
// options.config = { name: 'Total.js' };
// options.sleep = 3000;

require('total.js').http('release', options);
// require('total.js').cluster.http(5, 'release', options);