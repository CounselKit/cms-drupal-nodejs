/**
 * Submodule for managing configuration.
 */
'use strict';

var vm = require('vm');
var fs = require('fs');

var configManager = {
  settings: null,
  extensions: [],
  settingsDefaults: {
    scheme: 'http',
    port: 8080,
    host: 'localhost',
    resource: '/socket.io',
    serviceKey: '',
    debug: false,
    baseAuthPath: '/nodejs/',
    extensions: [],
    clientsCanWriteToChannels: false,
    clientsCanWriteToClients: false,
    transports: ['websocket', 'polling'],
    jsMinification: true,
    jsEtag: true,
    backend: {
      host: 'localhost',
      scheme: 'http',
      port: 80,
      basePath: '/',
      strictSSL: false,
      messagePath: 'nodejs/message',
      httpAuth: ''
    },
    logLevel: 1
  }
};

/**
 * Returns the settings array.
 */
configManager.getSettings = function () {
  if (this.settings === null) {
    // Load the settings if they are not already loaded.
    // This should happen only once because each require() call is supposed to return the same instance of this module.
    this.initSettings();
  }

  return this.settings;
};

/**
 * Reads in settings from a file, and merges it with default settings.
 */
configManager.initSettings = function () {
  var configFile = process.cwd() + '/nodejs.config.js';
  if (process.argv[2]) {
    configFile = process.argv[2];
  }

  try {
    this.settings = vm.runInThisContext(fs.readFileSync(configFile));
  }
  catch (exception) {
    console.log("Failed to read config file, exiting: " + exception);
    process.exit(1);
  }

  for (var key in this.settingsDefaults) {
    if (this.settingsDefaults.hasOwnProperty(key) && key != 'backend' && !this.settings.hasOwnProperty(key)) {
      this.settings[key] = this.settingsDefaults[key];
    }
  }

  if (!this.settings.hasOwnProperty('backend')) {
    this.settings.backend = this.settingsDefaults.backend;
  }
  else {
    for (var key2 in this.settingsDefaults.backend) {
      if (this.settingsDefaults.backend.hasOwnProperty(key2) && !this.settings.backend.hasOwnProperty(key2)) {
        this.settings.backend[key2] = this.settingsDefaults.backend[key2];
      }
    }
  }

  this.loadExtensions();
  this.invokeExtensions('settingsAlter', this.settings);
};

/**
 * Loads extensions.
 */
configManager.loadExtensions = function () {
  for (var i in this.settings.extensions) {
    try {
      // Load JS files for extensions as modules, and collect the returned
      // object for each extension.
      this.extensions.push(require(__dirname + '/../extensions' + this.settings.extensions[i]));
      console.log("Extension loaded: " + this.settings.extensions[i]);
    }
    catch (exception) {
      console.log("Failed to load extension " + settings.extensions[i] + " [" + exception + "]");
      process.exit(1);
    }
  }
};

/**
 * Retrieves paths defined by extensions.
 *
 * @returns {Array}
 *   Array of routes. Each route has the following properties:
 *     path: The path to use in routes.
 *     type: 'get' or 'post'.
 *     handler: Callback function.
 */
configManager.getExtensionRoutes = function () {
  var routes = [];

  for (var i in this.extensions) {
    if (this.extensions[i].hasOwnProperty('routes')) {
      console.log('Adding route handlers from extension', this.extensions[i].routes);

      for (var j = 0; j < this.extensions[i].routes.length; j++) {
        var path = '';

        if (this.extensions[i].routes[j].auth) {
          path = this.settings.baseAuthPath + this.extensions[i].routes[j].path;
        }
        else {
          path = this.extensions[i].routes[j].path;
        }

        routes.push({
          path: path,
          type: (this.extensions[i].routes[j].type == 'post' ? 'post' : 'get'),
          handler: this.extensions[i].routes[j].handler
        });
      }
    }
  }

  return routes;
};

/**
 * Invokes the specified function on all registered server extensions.
 */
configManager.invokeExtensions = function (hook) {
  var args = arguments.length ? Array.prototype.slice.call(arguments, 1) : [];
  var returnValues = {};
  for (var i in this.extensions) {
    if (this.extensions.hasOwnProperty(i) && this.extensions[i].hasOwnProperty(hook) && this.extensions[i][hook].apply) {
      returnValues[i] = this.extensions[i][hook].apply(this, args);
    }
  }
  return returnValues;
};

module.exports = configManager;