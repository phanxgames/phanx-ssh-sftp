/// <reference types="node" />
import * as Stream from "stream";
export interface IShell {
    [x: string]: any;
}
export interface ISFTP {
    [x: string]: any;
}
export interface IProcessStatus {
    status?: string;
    name?: string;
    id?: string;
    path?: string;
    args?: string;
    "exec cwd"?: string;
    "error log path"?: string;
    "out log path"?: string;
    "pid path"?: string;
    mode?: string;
    uptime?: string;
    "created at"?: string;
    interpreter?: string;
    restarts?: string;
    "watch & reload"?: string;
    [x: string]: any;
}
export interface IStat {
    mode: any;
    permissions: any;
    owner: any;
    group: any;
    size: any;
    accessTime: any;
    modifyTime: any;
}
export declare class PhanxSSH {
    client: any;
    debugFn: Function;
    protected _shell: IShell;
    protected _sftp: ISFTP;
    debugStatus: boolean;
    constructor();
    /**
     * Opens a connection.
     *
     * @param config
     * @returns {Promise<void>}
     */
    connect(config: any): Promise<void>;
    /**
     * Ends the connection.
     */
    end(): any;
    /**
     * For atomic command execution.
     *
     * @param {string} command
     * @returns {Promise} - result as string
     */
    exec(command: string): Promise<string>;
    /**
     * Returns a stream representing the shell.
     * Use it with the following methods:
     *  shellExec
     *  shellEnd
     * The last shell stream will be used if you don't pass it.
     *
     * @returns {Promise}
     */
    shell(): Promise<IShell>;
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
    shellExec(c: string, shell?: IShell, timeout_ms?: number): Promise<string>;
    /**
     * Use to close the shell stream.
     *
     * @param {IShell} shell (defaults to last shell) - stream
     * @returns {Promise<void>}
     */
    shellEnd(shell?: IShell): Promise<void>;
    /**
     * Returns the status of a PM2 process.
     *
     * @param {string | number} id_name
     * @returns {Promise<IProcessStatus>}
     */
    nodeProcessStatus(id_name: string | number): Promise<IProcessStatus>;
    /**
     * Enables SFTP functionality on this connection.
     *
     * @returns {Promise<ISFTP>}
     */
    sftp(): Promise<ISFTP>;
    /**
     * Lists files within an SFTP directory, returns an array.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<Array<string>>}
     */
    sftpList(path: string, sftp?: ISFTP): Promise<Array<any>>;
    /**
     * Checks if a file exists in the SFTP.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<boolean>}
     */
    sftpExists(path: string, sftp?: ISFTP): Promise<boolean>;
    /**
     * Get the file statistics of the remote path and returns an object.
     *
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<IStat>}
     */
    sftpStat(remotePath: string, sftp?: ISFTP): Promise<IStat>;
    /**
     * Downloads a file from SFTP.
     * Recommend to use sftpFastGet.
     *
     * @param {string} path
     * @param {string} encoding
     * @param {ISFTP} sftp
     * @returns {Promise<module:stream.internal>}
     */
    sftpGet(path: string, encoding?: string, sftp?: ISFTP): Promise<Stream>;
    /**
     * Downloads a file from the SFTP using parallel processing.
     *
     * @param {string} remotePath
     * @param {string} localPath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpFastGet(remotePath: string, localPath: string, sftp?: ISFTP): Promise<string>;
    /**
     * Uploads a file to the SFTP using parallel processing for faster.
     *
     * @param {string} localPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpFastPut(localPath: string, remotePath: string, sftp?: ISFTP): Promise<string>;
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
    sftpPut(input: Buffer | string | Stream, remotePath: string, encoding?: string, sftp?: ISFTP): Promise<string>;
    /**
     * Invokes the mkdir (make directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpMkdir(path: string, recursive?: boolean, sftp?: ISFTP): Promise<string>;
    /**
     * Invokes the rmdir (remove directory) SFTP command.
     *
     * @param {string} path
     * @param {boolean} recursive
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpRmdir(path: string, recursive?: boolean, sftp?: ISFTP): Promise<string>;
    /**
     * Invokes the delete SFTP command.
     *
     * @param {string} path
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpDelete(path: string, sftp?: ISFTP): Promise<string>;
    /**
     * Invokes the file rename SFTP command.
     *
     * @param {string} srcPath
     * @param {string} remotePath
     * @param {ISFTP} sftp
     * @returns {Promise<string>}
     */
    sftpRename(srcPath: string, remotePath: string, sftp?: ISFTP): Promise<string>;
    /**
     * Invokes the CHMOD command in the SFTP.
     *
     * @param {string} remotePath
     * @param {number} mode - 0o777
     * @param {ISFTP} sftp
     * @returns {Promise} result as string
     */
    sftpChmod(remotePath: string, mode: number, sftp?: ISFTP): Promise<string>;
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
    ftpGet(ftp: any, remoteFile: string, localFile: string): string;
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
    ftpPut(ftp: any, localFile: string, remoteFile: string): string;
    private _escapePassword(password);
    private _asyncForEach(array, callback);
    debug(...args: any[]): void;
    static loadPrivateKey(config: any): void;
}
