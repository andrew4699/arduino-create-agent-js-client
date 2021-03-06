[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm version](https://badge.fury.io/js/arduino-create-agent-js-client.svg)](https://badge.fury.io/js/arduino-create-agent-js-client)

# arduino-create-agent-js-client
JS module providing discovery of the [Arduino Create Plugin](https://github.com/arduino/arduino-create-agent) and communication with it

## Installation

```bash
npm install arduino-create-agent-js-client --save
```

## How to use

```js
import Daemon from 'arduino-create-agent-js-client';

const daemon = new Daemon('https://builder.arduino.cc/v3/boards');

daemon.agentFound.subscribe(status => {
  // true / false
});

daemon.channelOpenStatus.subscribe(status => {
  // true / false
});

daemon.error.subscribe(err => {
  // handle err
});

// List available devices (serial/network)
daemon.devicesList.subscribe(({serial, network}) => {
  const  serialDevices = serial;
  const  networkDevices = network;
});

// Open serial monitor
daemon.openSerialMonitor('port-name');

// Read from serial monitor
daemon.serialMonitorMessages.subscribe(message => {
  console.log(message);
});

// Write to serial monitor
daemon.writeSerial('port-name', 'message');

// Close serial monitor
daemon.closeSerialMonitor('port-name');

// Upload sketch on serial target (desktop agent and chrome app)
daemon.uploadSerial(target, sketchName, compilationResult, verbose);

// Upload sketch on network target (daesktop agent only)
daemon.uploadNetwork(target, sketchName, compilationResult);

// Upload progress
daemon.uploading.subscribe(upload => {
  console.log(status);
});

// Download tool
daemon.downloadTool('toolname', 'toolversion' 'packageName', 'replacement');

// Download status
daemon.downloading.subscribe(download => {
  console.log(download);
});

```

## Development and test features
Just run `npm run dev` and open your browser on http://localhost:8000

## Agent communication

To enable communication between your [local installation](http://localhost:8000/) and the [Arduino Create Agent](https://github.com/arduino/arduino-create-agent)
add `origins = http://localhost:8000` on your agent config.ini file
(if you are using https, add `origins = https://localhost:8000`).

- On macOs ~/Applications/ArduinoCreateAgent-1.1/ArduinoCreateAgent.app/Contents/MacOS/config.ini
- On Linux ~/ArduinoCreateAgent-1.1/config.ini
