/*
    Copyright © 2024 Inspired Technologies GmbH (www.inspiredtechnologies.eu)

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
*/

'use strict'
const debug = require("debug")("signalk:openweather-signalk")
const ow = require('./openweather')

module.exports = function (app) {
    var plugin = {};

    plugin.id = 'openweather-signalk';
    plugin.name = 'OpenWeather Forecast';
    plugin.description = 'Provide forecast data from OpenWeather Service';

    var unsubscribes = [];
    let timerId = null;
    plugin.start = function (options, restartPlugin) {

        app.debug('Plugin started');
        timerId = ow.init(sendDelta, app.getSelfPath, log);

        let localSubscription = {
            context: 'vessels.self',
            subscribe: ow.subscriptions
        };

        app.subscriptionmanager.subscribe(
            localSubscription,
            unsubscribes,
            subscriptionError => {
                app.error('Error:' + subscriptionError);
            },
            delta => ow.onDeltasUpdate(delta)
        );

        let delta = ow.preLoad(app.getSelfPath('navigation.position'), options["apikey"], options["type"], options["offset"], options["current"])
        if (delta)
        {
            sendDelta(delta.update)
            sendMeta(delta.meta)
        }

    };

    plugin.stop = function () {
        unsubscribes.forEach(f => f());
        if (timerId!==null) clearInterval(timerId);
        unsubscribes = [];
        app.debug('Plugin stopped');
    };

    plugin.schema = {
        // The plugin schema
        type: "object",
        title: "OpenWeather Service Configuration",
        description: "Configure open weather data ()",
        required: ['apikey'],
        properties: {
          apikey: {
            type: 'string',
            title: 'APPID. Required to extract data from OWMap - http://openweathermap.org/appid'
          },
          type: {
            type: 'string',
            title: 'Type. Simple or Full data object',
            enum: ['simple - temp, humidity, pressure, desc, rain, weathercode', 'full - complete openweathermap json'],
            default: 'simple'
          },
          offset: {
            type: 'number',
            title: 'Forecast offset to localtime',
            description: '0 = current, otherwise next full hour within <offset> hours (max. 47)',
            default: 1
          },
          current: {
            type: 'boolean',
            title: 'Publish 0h offset forecast as current',
            description: 'turn this on, only if no other signals on the network (eg. BME280, RUUVI)',
            default: false
          },
        }
    };

    /**
     * 
     * @param {Array<[{path:path, value:value}]>} messages 
     */
    function sendDelta(messages) {
        app.handleMessage('openweather-signalk', {
            updates: [
                {
                    values: messages
                }
            ]
        });
    }

    function sendMeta(units) {
        app.handleMessage('openweather-signalk', {
            updates: [
                {
                    meta: units
                }
            ]   
        })
    }

    function log(msg) { app.debug(msg); }

    return plugin;
};