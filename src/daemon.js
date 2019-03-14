/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-create-agent-js-client.
* Copyright (c) 2018
* Authors: Alberto Iannaccone, Stefania Mellai, Gabriele Destefanis
*
* This software is released under:
* The GNU General Public License, which covers the main part of
* arduino-create-agent-js-client
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/

import { Subject, BehaviorSubject, interval } from 'rxjs';
import { takeUntil, filter, startWith, first, distinctUntilChanged } from 'rxjs/operators';

const POLLING_INTERVAL = 1500;

export default class Daemon {
  constructor(boardsUrl = 'https://builder.arduino.cc/v3/boards') {
    this.BOARDS_URL = boardsUrl;
    this.UPLOAD_NOPE = 'UPLOAD_NOPE';
    this.UPLOAD_DONE = 'UPLOAD_DONE';
    this.UPLOAD_ERROR = 'UPLOAD_ERROR';
    this.UPLOAD_IN_PROGRESS = 'UPLOAD_IN_PROGRESS';

    this.DOWNLOAD_DONE = 'DOWNLOAD_DONE';
    this.DOWNLOAD_NOPE = 'DOWNLOAD_NOPE';
    this.DOWNLOAD_ERROR = 'DOWNLOAD_ERROR';
    this.DOWNLOAD_IN_PROGRESS = 'DOWNLOAD_IN_PROGRESS';

    this.agentInfo = {};
    this.agentFound = new BehaviorSubject(null);
    this.channelOpen = new BehaviorSubject(null);
    this.channelOpenStatus = this.channelOpen.pipe(distinctUntilChanged());
    this.error = new BehaviorSubject(null).pipe(distinctUntilChanged());

    this.appMessages = new Subject();
    this.serialMonitorOpened = new BehaviorSubject(false);
    this.serialMonitorMessages = new Subject();
    this.uploading = new BehaviorSubject({ status: this.UPLOAD_NOPE });
    this.uploadingDone = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_DONE))
      .pipe(first())
      .pipe(takeUntil(this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_ERROR))));
    this.uploadingError = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_ERROR))
      .pipe(first())
      .pipe(takeUntil(this.uploadingDone));
    this.uploadInProgress = this.uploading.pipe(filter(upload => upload.status === this.UPLOAD_IN_PROGRESS));
    this.devicesList = new BehaviorSubject({
      serial: [],
      network: []
    });
    this.supportedBoards = new BehaviorSubject([]);
    this.appMessages
      .subscribe(message => this.handleAppMessage(message));

    // Close all serial ports on startup
    this.devicesList
      .pipe(filter(devices => devices.serial && devices.serial.length > 0))
      .pipe(first())
      .subscribe(() => this.closeAllPorts());

    this.downloading = new BehaviorSubject({ status: this.DOWNLOAD_NOPE });
    this.downloadingDone = this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_DONE))
      .pipe(first())
      .pipe(takeUntil(this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_ERROR))));
    this.downloadingError = this.downloading.pipe(filter(download => download.status === this.DOWNLOAD_ERROR))
      .pipe(first())
      .pipe(takeUntil(this.downloadingDone));
  }

  notifyUploadError(err) {
    this.uploading.next({ status: this.UPLOAD_ERROR, err });
  }

  openChannel(cb) {
    this.channelOpen
      .subscribe(open => {
        if (open) {
          interval(POLLING_INTERVAL)
            .pipe(startWith(0))
            .pipe(takeUntil(this.channelOpen.pipe(filter(status => !status))))
            .subscribe(cb);
        }
        else {
          this.devicesList.next({
            serial: [],
            network: []
          });
          this.agentFound.next(false);
        }
      });
  }

  /**
   * Upload a sketch to serial target
   * Fetch commandline from boards API for serial upload
   * @param {Object} target
   * @param {string} sketchName
   * @param {Object} compilationResult
   * @param {boolean} verbose
   */
  uploadSerial(target, sketchName, compilationResult, commandline, signature, verbose = true) {
    this.uploading.next({ status: this.UPLOAD_IN_PROGRESS });

    this.closeSerialMonitor(target.port);

      const uploadCommandInfo = {
        // commandline: `avrdude -C avrdude.conf -v -patmega32u4 -cavr109 -b57600 -P COM12`,
        commandline: "\"{runtime.tools.avrdude.path}/bin/avrdude\" \"-C{runtime.tools.avrdude.path}/etc/avrdude.conf\" {upload.verbose} -patmega32u4 -cavr109 -P{serial.port} -D \"-Uflash:w:{build.path}/{build.project_name}.hex:i\"",
        signature: `5e22e3da4c8b684750e80bc58f0581f0d4089a480d7777581a3c9d9a0178c065cc405a9d8d9b8c856bd0388c2777ca4a65680adfb5b4c0ae4ab2c98c3bbb435adc4c18a2b737af5689138b27cda1c4adb3d96dc12170f9cfd6632133f3d0b27dc3f03e9f28d38004b8f0d8f4495418fa238a9f0de0cb410464620ef9a9777a3bb0d8431a6226c98073c7885774fdde226e282d4fe9a7e221b5a1cc7dc46ef443083500ab80440703aaf18b1e5c055c418ad3c4287688935a386fb91b08b3801a5f3545e5bcf0dcaa5fb5488ecd37f4a8aee33ba3e0f1f31aaf07ff749eb0ee850a0ba84485695288b0905afb8b50fed302dba4d899adac8d253bb197e426874e`,
        // commandline,
        // signature,
        options: {
          use_1200bps_touch: "true", // u
          wait_for_upload_port: "true" // u
        },
      };

      const projectNameIndex = uploadCommandInfo.commandline.indexOf('{build.project_name}');
      let ext = uploadCommandInfo.commandline.substring(projectNameIndex + 21, projectNameIndex + 24);
      if (!ext || !compilationResult[ext]) {
        console.log('we received a faulty ext property, defaulting to .bin');
        ext = 'bin';
      }

      const uploadPayload = {
        ...target,
        commandline: uploadCommandInfo.commandline,
        filename: `${sketchName}.${ext}`,
        hex: compilationResult[ext], // For desktop agent
        data: compilationResult[ext] // For chromeOS plugin, consider to align this
      };

      this._upload(uploadPayload, uploadCommandInfo);
  }

  /**
   * Compares 2 devices list checking they contains the same ports in the same order
   * @param {Array<device>} a the first list
   * @param {Array<device>} b the second list
   */
  static devicesListAreEquals(a, b) {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => (b[index].Name === item.Name && b[index].IsOpen === item.IsOpen));
  }

  /**
   * Interrupt upload - not supported in Chrome app
   */
  stopUpload() {
    if (typeof this.stopUploadCommand === 'function') {
      this.stopUploadCommand();
    }
    else {
      throw new Error('Stop Upload not supported on Chrome OS');
    }
  }
}
