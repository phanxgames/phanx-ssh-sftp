import * as fs from "fs";
import * as Stream from "stream";

const SSH2Client = require('ssh2').Client;
const osPath = require('path').posix;

export interface IShell {
    [x: string]: any
}
export interface ISFTP {
    [x: string]: any
}
export interface IProcessStatus {
    status?:string,
    name?:string,
    id?:string,
    path?:string,
    args?:string,
    "exec cwd"?:string,
    "error log path"?:string,
    "out log path"?:string,
    "pid path"?:string,
    mode?:string,
    uptime?:string,
    "created at"?:string,
    interpreter?:string,
    restarts?:string,
    "watch & reload"?:string,
    [x: string]: any
}
export interface IStat {
    mode: any,
    permissions: any,
    owner: any,
    group: any,
    size: any,
    accessTime: any,
    modifyTime: any
}

export class PhanxSSH {

    public client:any;
    public debugFn:Function;
    protected _shell:IShell;
    protected _sftp:ISFTP;
    public debugStatus:boolean = true;

    constructor() {
        this.client = new SSH2Client();
    }

    //########################################################################


    /**
     * Opens a connection.
     *
     * @param config
     * @returns {Promise<void>}
     */
    public connect(config:any):Promise<void> {

        PhanxSSH.loadPrivateKey(config);

        let conn = this.client;

        return new Promise(resolve => {
            conn.on('error', (err)=> {
                console.error(err);
            });
            conn.on('ready', () => {
                resolve();
            }).connect({
                host: config.host,
                port: config.port,
                username: config.username,
                privateKey: config.privateKey
            });

        })


    }

    /**
     * Ends the connection.
     */
    public end() {
        return this.client.end();
    }

    //########################################################################


    /**
     * For atomic command execution.
     *
     * @param {string} command
     * @returns {Promise} - result as string
     */
    public exec(command:string):Promise<string> {
        let conn = this.client;
        return new Promise((resolve, reject) => {

            conn.exec(command, (err, stream) => {

                if (err) {
                    reject(err);
                    return;
                }
                let buffer = '';

                stream.on('close', (code, signal) => {
                    //this.debug("close",code,signal);
                    //conn.end();
                    this.debug(buffer);
                    resolve(buffer);
                }).on('data', (data) => {
                    //this.debug(data.toString());
                    //resolve(data.toString());
                    buffer+=data;
                }).stderr.on('data', (data) => {
                    this.debug("stderr",data.toString());
                    reject(data.toString());
                });

            })

        });
    }

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
    public shell():Promise<IShell> {
        return new Promise((resolve,reject)=> {
            let conn = this.client;
            conn.shell((err, stream) => {

                if (err) {
                    reject(err);
                    return;
                }

                stream.on('close', () => {
                    this.debug('Stream :: close');
                    //conn.end();
                }).stderr.on('data', (data) => {
                    this.debugStatus = true;
                    this.debug('STDERR: ' + data);
                });
                /*
                .on('data', (data) => {
                    process.stdout.write(data);
                })
                 */

                this._shell = stream;
                resolve(stream);

            })
        });
    }

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
    shellExec(c:string,shell:IShell=null,timeout_ms:number=500):Promise<string> {

        if (shell==null)
            shell = this._shell;

        return new Promise(resolve => {

            let timer = null;

            let onData:Function = (data)=> {
                buffer += data;
                //console.log(data.toString(),data.toString().charCodeAt(0))

                setupTimeout();

                if (data.toString().charCodeAt(0)==13) {
                    this.debug(buffer);
                    buffer = '';
                }
            };

            let buffer = '';
            shell.on('data',onData);

            shell.write(c+"\n");

            let setupTimeout:Function = () => {
                clearTimeout(timer);

                timer = setTimeout(() => {
                    shell.removeListener('data',onData);
                    resolve(buffer);
                },timeout_ms);
            };

            setupTimeout();

        });

    }

    /**
     * Use to close the shell stream.
     *
     * @param {IShell} shell (defaults to last shell) - stream
     * @returns {Promise<void>}
     */
    async shellEnd(shell:IShell=null):Promise<void> {
        if (shell==null)
            shell = this._shell;
        await this.shellExec("exit", shell);
        shell.end();
    }

    //########################################################################
    // pm2

    /**
     * Returns the status of a PM2 process.
     *
     * @param {string | number} id_name
     * @returns {Promise<IProcessStatus>}
     */
    async nodeProcessStatus(id_name:string|number):Promise<IProcessStatus> {

        let temp = await this.exec("pm2 show " + id_name);
        let result = temp.toString();

        //console.log(result);

        //│ status            │ online

        let out:IProcessStatus = {};

        if (result!=null) {
            let lines = result.split("\n");
            for (let line of lines) {
                if (line.indexOf("│") >= 0) {
                    let parts = line.split("│");
                    if (parts == null || parts.length <= 2)
                        continue;
                    out[parts[1].trim()] = parts[2].trim();
                }
            }
        }

        return out;

    }




    //########################################################################
    // SFTP (file transfer through SSH)

    /**
     * Enables SFTP functionality on this connection.
     *
     * @returns {Promise<ISFTP>}
     */
    public sftp():Promise<ISFTP> {
        return new Promise((resolve, reject)=> {

            if (this._sftp!=null) {
                resolve(this._sftp);
                return;
            }

            this.client.sftp((err, sftp) => {
                this.client.removeListener('error', reject);
                this.client.removeListener('end', reject);
                if (err) {
                    reject(new Error(`Failed to connect to server: ${err.message}`));
                }
                this._sftp = sftp;
                resolve(sftp);
            });
        });

    }

    /**
     * Lists files within an SFTP directory, returns an array.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<Array<string>>}
     */
    public sftpList(path:string,sftp:ISFTP=null):Promise<Array<any>> {
        const reg = /-/gi;

        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.readdir(path, (err, list) => {
                if (err) {
                    reject(new Error(`Failed to list ${path}: ${err.message}`));
                } else {
                    let newList = [];
                    // reset file info
                    if (list) {
                        newList = list.map(item => {
                            return {
                                type: item.longname.substr(0, 1),
                                name: item.filename,
                                size: item.attrs.size,
                                modifyTime: item.attrs.mtime * 1000,
                                accessTime: item.attrs.atime * 1000,
                                rights: {
                                    user: item.longname.substr(1, 3).replace(reg, ''),
                                    group: item.longname.substr(4,3).replace(reg, ''),
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
    }

    /**
     * Checks if a file exists in the SFTP.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<boolean>}
     */
    public sftpExists(path:string,sftp:ISFTP=null):Promise<boolean> {
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            let {dir, base} = osPath.parse(path);
            sftp.readdir(dir, (err, list) => {
                if (err) {
                    if (err.code === 2) {
                        resolve(false);
                    } else {
                        reject(new Error(`Error listing ${dir}: code: ${err.code} ${err.message}`));
                    }
                } else {
                    let [type] = list.filter(item => item.filename === base).map(item => item.longname.substr(0, 1));
                    if (type) {
                        resolve(type);
                    } else {
                        resolve(false);
                    }
                }
            });
        });
    }

    /**
     * Get the file statistics of the remote path and returns an object.
     *
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<IStat>}
     */
    public sftpStat(remotePath:string,sftp:ISFTP=null):Promise<IStat> {
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(Error('sftp connect error'));
            }
            sftp.stat(remotePath, function (err, stats) {
                if (err){
                    reject(new Error(`Failed to stat ${remotePath}: ${err.message}`));
                } else {
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
    }

    /**
     * Downloads a file from SFTP.
     * Recommend to use sftpFastGet.
     *
     * @param {string} path
     * @param {string} encoding
     * @param {ISFTP} sftp
     * @returns {Promise<module:stream.internal>}
     */
    public sftpGet(path:string,encoding:string="utf8",sftp:ISFTP=null)
        :Promise<Stream>
    {
        let options = {
            encoding: encoding,
            useCompression: true,
        };
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (sftp) {
                try {
                    this.client.on('error', reject);

                    let stream:Stream = sftp.createReadStream(path, options);

                    stream.on('error', (err) => {
                        this.client.removeListener('error', reject);
                        return reject(new Error(`Failed get for ${path}: ${err.message}`));
                    });
                    stream.on('readable', () => {
                        this.client.removeListener('error', reject);
                        return resolve(stream);
                    });
                } catch(err) {
                    this.client.removeListener('error', reject);
                    return reject(new Error(`Failed get on ${path}: ${err.message}`));
                }
            } else {
                return reject(new Error('sftp connect error'));
            }
        });
    }


    /**
     * Downloads a file from the SFTP using parallel processing.
     *
     * @param {string} remotePath
     * @param {string} localPath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpFastGet(remotePath:string, localPath:string, sftp:ISFTP=null)
        :Promise<string>
    {
        sftp = sftp || this._sftp;

        let options =  {concurrency: 64, chunkSize: 32768};

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(Error('sftp connect error'));
            }
            sftp.fastGet(remotePath, localPath, options, function (err) {
                if (err){
                    reject(new Error(`Failed to get ${remotePath}: ${err.message}`));
                }
                resolve(`${remotePath} was successfully download to ${localPath}!`);
            });
            return undefined;
        });

    }

    /**
     * Uploads a file to the SFTP using parallel processing for faster.
     *
     * @param {string} localPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpFastPut(localPath:string, remotePath:string, sftp:ISFTP=null)
        :Promise<string>
    {
        sftp = sftp || this._sftp;
        let options = {};

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.fastPut(localPath, remotePath, options, function (err) {
                if (err) {
                    reject(new Error(`Failed to upload ${localPath} to ${remotePath}: ${err.message}`));
                }
                resolve(`${localPath} was successfully uploaded to ${remotePath}!`);
            });
            return undefined;
        });
    }

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
    public sftpPut(input:Buffer|string|Stream,
                   remotePath:string, encoding:string="utf8",
                   sftp:ISFTP=null):Promise<string>
    {
        let options = {
            encoding: encoding,
            useCompression: true,
        };
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (sftp) {
                if (typeof input === 'string') {
                    sftp.fastPut(input, remotePath, options, (err) => {
                        if (err) {
                            return reject(new Error(`Failed to upload ${input} to ${remotePath}: ${err.message}`));
                        }
                        return resolve(`Uploaded ${input} to ${remotePath}`);
                    });
                    return false;
                }
                let stream = sftp.createWriteStream(remotePath, options);

                stream.on('error', err => {
                    return reject(new Error(`Failed to upload data stream to ${remotePath}: ${err.message}`));
                });

                stream.on('close', () => {
                    return resolve(`Uploaded data stream to ${remotePath}`);
                });

                if (input instanceof Buffer) {
                    stream.end(input);
                    return false;
                }
                input.pipe(stream);
            } else {
                return reject(Error('sftp connect error'));
            }
        });
    }


    /**
     * Invokes the mkdir (make directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpMkdir(path:string,recursive:boolean=false,
                     sftp:ISFTP=null):Promise<string>

    {
        sftp = sftp || this._sftp;

        let doMkdir = (p:string):Promise<string> => {
            return new Promise((resolve, reject) => {


                if (!sftp) {
                    return reject(new Error('sftp connect error'));
                }
                sftp.mkdir(p, err => {
                    if (err) {
                        reject(new Error(`Failed to create directory ${p}: ${err.message}`));
                    }
                    resolve(`${p} directory created`);
                });
                return undefined;
            });
        };

        if (!recursive) {
            return doMkdir(path);
        }
        let mkdir = p => {
            let {dir} = osPath.parse(p);
            return this.sftpExists(dir, sftp).then((type) => {
                if (!type) {
                    return mkdir(dir);
                }
            }).then(() => {
                return doMkdir(p);
            });
        };
        return mkdir(path);
    }


    /**
     * Invokes the rmdir (remove directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpRmdir(path:string, recursive:boolean=false,
                     sftp:ISFTP=null):Promise<string>
    {
        sftp = sftp || this._sftp;

        let doRmdir = (p:string):Promise<string> => {
            return new Promise((resolve, reject) => {

                if (!sftp) {
                    return reject(new Error('sftp connect error'));
                }
                sftp.rmdir(p, err => {
                    if (err) {
                        reject(new Error(`Failed to remove directory ${p}: ${err.message}`));
                    }
                    resolve('Successfully removed directory');
                });
                return undefined;
            });
        };

        if (!recursive) {
            return doRmdir(path);
        }

        let rmdir = p => {
            let list;
            let files;
            let dirs;
            return this.sftpList(p,sftp).then((res) => {
                list = res;
                files = list.filter(item => item.type === '-');
                dirs = list.filter(item => item.type === 'd');
                return this._asyncForEach(files, (f) => {
                    return this.sftpDelete(osPath.join(p, f.name), sftp);
                });
            }).then(() => {
                return this._asyncForEach(dirs, (d) => {
                    return rmdir(osPath.join(p, d.name));
                });
            }).then(() => {
                return doRmdir(p);
            });
        };
        return rmdir(path);
    }

    /**
     * Invokes the delete SFTP command.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpDelete(path:string, sftp:ISFTP=null):Promise<string>
    {
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.unlink(path, (err) => {
                if (err) {
                    reject(new Error(`Failed to delete file ${path}: ${err.message}`));
                }
                resolve('Successfully deleted file');
            });
            return undefined;
        });
    }

    /**
     * Invokes the file rename SFTP command.
     *
     * @param {string} srcPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    public sftpRename(srcPath:string,remotePath:string,sftp:ISFTP=null)
        :Promise<string>
    {
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.rename(srcPath, remotePath, (err) => {
                if (err) {
                    reject(new Error(`Failed to rename file ${srcPath} to ${remotePath}: ${err.message}`));
                }
                resolve(`Successfully renamed ${srcPath} to ${remotePath}`);
            });
            return undefined;
        });
    }


    /**
     * Invokes the CHMOD command in the SFTP.
     *
     * @param {string} remotePath
     * @param {number} mode - 0o777
     * @param {ISFTP} sftp
     * @returns {Promise} result as string
     */
    public sftpChmod(remotePath:string, mode:number, sftp:ISFTP=null)
        :Promise<string>
    {
        sftp = sftp || this._sftp;

        return new Promise((resolve, reject) => {

            if (!sftp) {
                return reject(new Error('sftp connect error'));
            }
            sftp.chmod(remotePath, mode, (err) => {
                if (err) {
                    reject(new Error(`Failed to change mode for ${remotePath}: ${err.message}`));
                }
                resolve('Successfully change file mode');
            });
            return undefined;
        });
    }





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
    public ftpGet(ftp:any,remoteFile:string,localFile:string):string
    {

        let ftpLogin:string = "open " +  ftp.host + " " + ftp.port + "\n" +
            "user " + ftp.user + " " + this._escapePassword(ftp.password) + "\n" +
            "passive\nbinary\n" +
            "get " + remoteFile + " " + localFile + "\n" +
            "bye" ;


        return 'ftp -n <<< "' + ftpLogin + '"';

    }


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
    public ftpPut(ftp:any,localFile:string, remoteFile:string):string
     {

        let ftpLogin:string = "open " +  ftp.host + " " + ftp.port + "\n" +
            "user " + ftp.user + " " + this._escapePassword(ftp.password) + "\n" +
            "passive\nbinary\n" +
            "put " + localFile + " " + remoteFile + "\n" +
            "bye" ;

        return 'ftp -n <<< "' + ftpLogin + '"';

    }

    private _escapePassword(password:string):string {
        return password
                .split("$").join("\\$")
                .split("'").join("\\'");
    }


    private _asyncForEach(array:Array<any>, callback:Function):any {
        return array.reduce((promise, item) => {
            return promise.then((result) => {
                return callback(item);
            });
        }, Promise.resolve());
    }


    public debug(...args):void {
        if (this.debugStatus && this.debugFn!=null) {
            this.debugFn(...args);
        }
    }

    public static loadPrivateKey(config:any):void {
        if (config.sshKeyPath!=null) {
            config.privateKey = fs.readFileSync(
                config.sshKeyPath
            ).toString("utf8").trim();
        }
    }
}