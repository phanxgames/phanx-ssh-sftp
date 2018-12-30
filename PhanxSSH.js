"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var SSH2Client = require('ssh2').Client;
var osPath = require('path').posix;
var PhanxSSH = /** @class */ (function () {
    function PhanxSSH() {
        this.debugStatus = true;
        this.client = new SSH2Client();
    }
    //########################################################################
    /**
     * Opens a connection.
     *
     * @param config
     * @returns {Promise<void>}
     */
    PhanxSSH.prototype.connect = function (config) {
        PhanxSSH.loadPrivateKey(config);
        var conn = this.client;
        return new Promise(function (resolve) {
            conn.on('ready', function () {
                resolve();
            }).connect({
                host: config.host,
                port: config.port,
                username: config.username,
                privateKey: config.privateKey
            });
        });
    };
    /**
     * Ends the connection.
     */
    PhanxSSH.prototype.end = function () {
        this.client.end();
    };
    //########################################################################
    /**
     * For atomic command execution.
     *
     * @param {string} command
     * @returns {Promise} - result as string
     */
    PhanxSSH.prototype.exec = function (command) {
        var _this = this;
        var conn = this.client;
        return new Promise(function (resolve, reject) {
            conn.exec(command, function (err, stream) {
                if (err) {
                    reject(err);
                    return;
                }
                var buffer = '';
                stream.on('close', function (code, signal) {
                    //this.debug("close",code,signal);
                    //conn.end();
                    _this.debug(buffer);
                    resolve(buffer);
                }).on('data', function (data) {
                    //this.debug(data.toString());
                    //resolve(data.toString());
                    buffer += data;
                }).stderr.on('data', function (data) {
                    _this.debug("stderr", data.toString());
                    reject(data.toString());
                });
            });
        });
    };
    //########################################################################
    // shell (interactive commands) non-atomic
    /**
     * Returns a stream representing the shell.
     * Use it with the following methods:
     *  shellExec
     *  shellEnd
     * The last shell stream will be used if you don't pass it.
     *
     * @returns {Promise}
     */
    PhanxSSH.prototype.shell = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var conn = _this.client;
            conn.shell(function (err, stream) {
                if (err) {
                    reject(err);
                    return;
                }
                stream.on('close', function () {
                    _this.debug('Stream :: close');
                    //conn.end();
                }).stderr.on('data', function (data) {
                    _this.debugStatus = true;
                    _this.debug('STDERR: ' + data);
                });
                /*
                .on('data', (data) => {
                    process.stdout.write(data);
                })
                 */
                _this._shell = stream;
                resolve(stream);
            });
        });
    };
    /**
     * Execute a command within a shell stream.
     * Will resolve the promise once the shell returns nothing for timeout duration.
     *      This is a nasty workaround until we figure out how to detect a command
     *      naturally completes.
     *
     * @param {string} c - command
     * @param {IShell} shell (default last stream) stream
     * @param timeout_ms (default: 500) - number in ms
     * @returns {Promise}
     */
    PhanxSSH.prototype.shellExec = function (c, shell, timeout_ms) {
        var _this = this;
        if (shell === void 0) { shell = null; }
        if (timeout_ms === void 0) { timeout_ms = 500; }
        if (shell == null)
            shell = this._shell;
        return new Promise(function (resolve) {
            var timer = null;
            var onData = function (data) {
                buffer += data;
                //console.log(data.toString(),data.toString().charCodeAt(0))
                setupTimeout();
                if (data.toString().charCodeAt(0) == 13) {
                    _this.debug(buffer);
                    buffer = '';
                }
            };
            var buffer = '';
            shell.on('data', onData);
            shell.write(c + "\n");
            var setupTimeout = function () {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    shell.removeListener('data', onData);
                    resolve(buffer);
                }, timeout_ms);
            };
            setupTimeout();
        });
    };
    /**
     * Use to close the shell stream.
     *
     * @param {IShell} shell (defaults to last shell) - stream
     * @returns {Promise<void>}
     */
    PhanxSSH.prototype.shellEnd = function (shell) {
        if (shell === void 0) { shell = null; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (shell == null)
                            shell = this._shell;
                        return [4 /*yield*/, this.shellExec("exit", shell)];
                    case 1:
                        _a.sent();
                        shell.end();
                        return [2 /*return*/];
                }
            });
        });
    };
    //########################################################################
    // pm2
    /**
     * Returns the status of a PM2 process.
     *
     * @param {string | number} id_name
     * @returns {Promise<IProcessStatus>}
     */
    PhanxSSH.prototype.nodeProcessStatus = function (id_name) {
        return __awaiter(this, void 0, void 0, function () {
            var temp, result, out, lines, _i, lines_1, line, parts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.exec("pm2 show " + id_name)];
                    case 1:
                        temp = _a.sent();
                        result = temp.toString();
                        out = {};
                        if (result != null) {
                            lines = result.split("\n");
                            for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                                line = lines_1[_i];
                                if (line.indexOf("│") >= 0) {
                                    parts = line.split("│");
                                    if (parts == null || parts.length <= 2)
                                        continue;
                                    out[parts[1].trim()] = parts[2].trim();
                                }
                            }
                        }
                        return [2 /*return*/, out];
                }
            });
        });
    };
    //########################################################################
    // SFTP (file transfer through SSH)
    /**
     * Enables SFTP functionality on this connection.
     *
     * @returns {Promise<ISFTP>}
     */
    PhanxSSH.prototype.sftp = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._sftp != null) {
                resolve(_this._sftp);
                return;
            }
            _this.client.sftp(function (err, sftp) {
                _this.client.removeListener('error', reject);
                _this.client.removeListener('end', reject);
                if (err) {
                    reject(new Error("Failed to connect to server: " + err.message));
                }
                _this._sftp = sftp;
                resolve(sftp);
            });
        });
    };
    /**
     * Lists files within an SFTP directory, returns an array.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<Array<string>>}
     */
    PhanxSSH.prototype.sftpList = function (path, sftp) {
        if (sftp === void 0) { sftp = null; }
        var reg = /-/gi;
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.readdir(path, function (err, list) {
                if (err) {
                    reject(new Error("Failed to list " + path + ": " + err.message));
                }
                else {
                    var newList = [];
                    // reset file info
                    if (list) {
                        newList = list.map(function (item) {
                            return {
                                type: item.longname.substr(0, 1),
                                name: item.filename,
                                size: item.attrs.size,
                                modifyTime: item.attrs.mtime * 1000,
                                accessTime: item.attrs.atime * 1000,
                                rights: {
                                    user: item.longname.substr(1, 3).replace(reg, ''),
                                    group: item.longname.substr(4, 3).replace(reg, ''),
                                    other: item.longname.substr(7, 3).replace(reg, '')
                                },
                                owner: item.attrs.uid,
                                group: item.attrs.gid
                            };
                        });
                    }
                    resolve(newList);
                }
            });
        });
    };
    /**
     * Checks if a file exists in the SFTP.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<boolean>}
     */
    PhanxSSH.prototype.sftpExists = function (path, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            var _a = osPath.parse(path), dir = _a.dir, base = _a.base;
            sftp.readdir(dir, function (err, list) {
                if (err) {
                    if (err.code === 2) {
                        resolve(false);
                    }
                    else {
                        reject(new Error("Error listing " + dir + ": code: " + err.code + " " + err.message));
                    }
                }
                else {
                    var type = list.filter(function (item) { return item.filename === base; }).map(function (item) { return item.longname.substr(0, 1); })[0];
                    if (type) {
                        resolve(type);
                    }
                    else {
                        resolve(false);
                    }
                }
            });
        });
    };
    /**
     * Get the file statistics of the remote path and returns an object.
     *
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<IStat>}
     */
    PhanxSSH.prototype.sftpStat = function (remotePath, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(Error('sftp connect error'));
            }
            sftp.stat(remotePath, function (err, stats) {
                if (err) {
                    reject(new Error("Failed to stat " + remotePath + ": " + err.message));
                }
                else {
                    // format similarly to sftp.list
                    resolve({
                        mode: stats.mode,
                        permissions: stats.permissions,
                        owner: stats.uid,
                        group: stats.guid,
                        size: stats.size,
                        accessTime: stats.atime * 1000,
                        modifyTime: stats.mtime * 1000
                    });
                }
            });
            return undefined;
        });
    };
    /**
     * Downloads a file from SFTP.
     * Recommend to use sftpFastGet.
     *
     * @param {string} path
     * @param {string} encoding
     * @param {ISFTP} sftp
     * @returns {Promise<module:stream.internal>}
     */
    PhanxSSH.prototype.sftpGet = function (path, encoding, sftp) {
        var _this = this;
        if (encoding === void 0) { encoding = "utf8"; }
        if (sftp === void 0) { sftp = null; }
        var options = {
            encoding: encoding,
            useCompression: true
        };
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (sftp) {
                try {
                    _this.client.on('error', reject);
                    var stream_1 = sftp.createReadStream(path, options);
                    stream_1.on('error', function (err) {
                        _this.client.removeListener('error', reject);
                        return reject(new Error("Failed get for " + path + ": " + err.message));
                    });
                    stream_1.on('readable', function () {
                        _this.client.removeListener('error', reject);
                        return resolve(stream_1);
                    });
                }
                catch (err) {
                    _this.client.removeListener('error', reject);
                    return reject(new Error("Failed get on " + path + ": " + err.message));
                }
            }
            else {
                return reject(new Error('sftp connect error'));
            }
        });
    };
    /**
     * Downloads a file from the SFTP using parallel processing.
     *
     * @param {string} remotePath
     * @param {string} localPath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpFastGet = function (remotePath, localPath, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        var options = { concurrency: 64, chunkSize: 32768 };
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(Error('sftp connect error'));
            }
            sftp.fastGet(remotePath, localPath, options, function (err) {
                if (err) {
                    reject(new Error("Failed to get " + remotePath + ": " + err.message));
                }
                resolve(remotePath + " was successfully download to " + localPath + "!");
            });
            return undefined;
        });
    };
    /**
     * Uploads a file to the SFTP using parallel processing for faster.
     *
     * @param {string} localPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpFastPut = function (localPath, remotePath, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        var options = {};
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.fastPut(localPath, remotePath, options, function (err) {
                if (err) {
                    reject(new Error("Failed to upload " + localPath + " to " + remotePath + ": " + err.message));
                }
                resolve(localPath + " was successfully uploaded to " + remotePath + "!");
            });
            return undefined;
        });
    };
    /**
     * Upload a file to the SFTP.
     * Recommend to use sftpFastPut.
     *
     * @param {Buffer|string|Stream} input
     * @param {string} remotePath
     * @param {string} encoding
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpPut = function (input, remotePath, encoding, sftp) {
        if (encoding === void 0) { encoding = "utf8"; }
        if (sftp === void 0) { sftp = null; }
        var options = {
            encoding: encoding,
            useCompression: true
        };
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (sftp) {
                if (typeof input === 'string') {
                    sftp.fastPut(input, remotePath, options, function (err) {
                        if (err) {
                            return reject(new Error("Failed to upload " + input + " to " + remotePath + ": " + err.message));
                        }
                        return resolve("Uploaded " + input + " to " + remotePath);
                    });
                    return false;
                }
                var stream = sftp.createWriteStream(remotePath, options);
                stream.on('error', function (err) {
                    return reject(new Error("Failed to upload data stream to " + remotePath + ": " + err.message));
                });
                stream.on('close', function () {
                    return resolve("Uploaded data stream to " + remotePath);
                });
                if (input instanceof Buffer) {
                    stream.end(input);
                    return false;
                }
                input.pipe(stream);
            }
            else {
                return reject(Error('sftp connect error'));
            }
        });
    };
    /**
     * Invokes the mkdir (make directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpMkdir = function (path, recursive, sftp) {
        var _this = this;
        if (recursive === void 0) { recursive = false; }
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        var doMkdir = function (p) {
            return new Promise(function (resolve, reject) {
                if (!sftp) {
                    return reject(new Error('sftp connect error'));
                }
                sftp.mkdir(p, function (err) {
                    if (err) {
                        reject(new Error("Failed to create directory " + p + ": " + err.message));
                    }
                    resolve(p + " directory created");
                });
                return undefined;
            });
        };
        if (!recursive) {
            return doMkdir(path);
        }
        var mkdir = function (p) {
            var dir = osPath.parse(p).dir;
            return _this.sftpExists(dir, sftp).then(function (type) {
                if (!type) {
                    return mkdir(dir);
                }
            }).then(function () {
                return doMkdir(p);
            });
        };
        return mkdir(path);
    };
    /**
     * Invokes the rmdir (remove directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpRmdir = function (path, recursive, sftp) {
        var _this = this;
        if (recursive === void 0) { recursive = false; }
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        var doRmdir = function (p) {
            return new Promise(function (resolve, reject) {
                if (!sftp) {
                    return reject(new Error('sftp connect error'));
                }
                sftp.rmdir(p, function (err) {
                    if (err) {
                        reject(new Error("Failed to remove directory " + p + ": " + err.message));
                    }
                    resolve('Successfully removed directory');
                });
                return undefined;
            });
        };
        if (!recursive) {
            return doRmdir(path);
        }
        var rmdir = function (p) {
            var list;
            var files;
            var dirs;
            return _this.sftpList(p, sftp).then(function (res) {
                list = res;
                files = list.filter(function (item) { return item.type === '-'; });
                dirs = list.filter(function (item) { return item.type === 'd'; });
                return _this._asyncForEach(files, function (f) {
                    return _this.sftpDelete(osPath.join(p, f.name), sftp);
                });
            }).then(function () {
                return _this._asyncForEach(dirs, function (d) {
                    return rmdir(osPath.join(p, d.name));
                });
            }).then(function () {
                return doRmdir(p);
            });
        };
        return rmdir(path);
    };
    /**
     * Invokes the delete SFTP command.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpDelete = function (path, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.unlink(path, function (err) {
                if (err) {
                    reject(new Error("Failed to delete file " + path + ": " + err.message));
                }
                resolve('Successfully deleted file');
            });
            return undefined;
        });
    };
    /**
     * Invokes the file rename SFTP command.
     *
     * @param {string} srcPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    PhanxSSH.prototype.sftpRename = function (srcPath, remotePath, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.rename(srcPath, remotePath, function (err) {
                if (err) {
                    reject(new Error("Failed to rename file " + srcPath + " to " + remotePath + ": " + err.message));
                }
                resolve("Successfully renamed " + srcPath + " to " + remotePath);
            });
            return undefined;
        });
    };
    /**
     * Invokes the CHMOD command in the SFTP.
     *
     * @param {string} remotePath
     * @param {number} mode - 0o777
     * @param {ISFTP} sftp
     * @returns {Promise} result as string
     */
    PhanxSSH.prototype.sftpChmod = function (remotePath, mode, sftp) {
        if (sftp === void 0) { sftp = null; }
        sftp = sftp || this._sftp;
        return new Promise(function (resolve, reject) {
            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.chmod(remotePath, mode, function (err) {
                if (err) {
                    reject(new Error("Failed to change mode for " + remotePath + ": " + err.message));
                }
                resolve('Successfully change file mode');
            });
            return undefined;
        });
    };
    //########################################################################
    // utilities
    /**
     * Command Builder: FTP GET
     * Does not execute anything.
     * Builds an exec string that can be used to FTP files on a remote server.
     *
     * @param ftp - config object
     * @param {string} remoteFile - path
     * @param {string} localFile - path
     * @returns {string} returns command as string, pass to exec
     */
    PhanxSSH.prototype.ftpGet = function (ftp, remoteFile, localFile) {
        var ftpLogin = "open " + ftp.host + " " + ftp.port + "\n" +
            "user " + ftp.user + " " + this._escapePassword(ftp.password) + "\n" +
            "passive\nbinary\n" +
            "get " + remoteFile + " " + localFile + "\n" +
            "bye";
        return 'ftp -n <<< "' + ftpLogin + '"';
    };
    /**
     * Command Builder: FTP PUT
     * Does not execute anything.
     * Builds an exec string that can be used to FTP files on a remote server.
     *
     * @param {any} ftp - config object
     * @param {string} localFile - path
     * @param {string} remoteFile - path
     * @returns {string} returns command as string, pass to exec
     */
    PhanxSSH.prototype.ftpPut = function (ftp, localFile, remoteFile) {
        var ftpLogin = "open " + ftp.host + " " + ftp.port + "\n" +
            "user " + ftp.user + " " + this._escapePassword(ftp.password) + "\n" +
            "passive\nbinary\n" +
            "put " + localFile + " " + remoteFile + "\n" +
            "bye";
        return 'ftp -n <<< "' + ftpLogin + '"';
    };
    PhanxSSH.prototype._escapePassword = function (password) {
        return password
            .split("$").join("\\$")
            .split("'").join("\\'");
    };
    PhanxSSH.prototype._asyncForEach = function (array, callback) {
        return array.reduce(function (promise, item) {
            return promise.then(function (result) {
                return callback(item);
            });
        }, Promise.resolve());
    };
    PhanxSSH.prototype.debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.debugStatus && this.debugFn != null) {
            this.debugFn.apply(this, args);
        }
    };
    PhanxSSH.loadPrivateKey = function (config) {
        if (config.sshKeyPath != null) {
            config.privateKey = fs.readFileSync(config.sshKeyPath).toString("utf8").trim();
        }
    };
    return PhanxSSH;
}());
exports.PhanxSSH = PhanxSSH;
