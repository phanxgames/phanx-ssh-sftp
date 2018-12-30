
This wraps the ssh2 module and provides an easy way to go between executing commands, sftp commands and even shell commands.

## example

```
import {PhanxSSH} from "./PhanxSSH";

let config = {
    username: "username",
    host: "myserver.com",
    protocol: "sftp",
    tryKeyboard: true,
    sshKeyPath: "c:/my-private.ppk"
};

let ssh:PhanxSSH = new PhanxSSH();
await ssh.connect(config);

//execute basic atomatic commands (no shell, or cwd)
let result:string = await ssh.exec("ls /home/");
console.log(result);

ssh.end();

```

### SFTP
```
//enable SFTP commands
await ssh.sftp();

let arr:Array<any> = await ssh.sftpList("/home/");
let isExists:boolean = await ssh.sftpExists("/home/root/test.txt");
let stats:any = await ssh.sftpStat("/home/root/test.txt");

let stream:Stream = await ssh.sftpGet("/home/root/test.txt","utf8");
let result:string = await ssh.sftpFastGet("/home/root/test.txt","c:/test.txt");

let result:string = await ssh.sftpPut("c:/test.txt","/home/root/test.txt","utf8");
let result:string = await ssh.sftpFastPut("c:/test.txt","/home/root/test.txt");

let result:string = await ssh.sftpMkdir("/home/root/temp/");
let result:string = await ssh.sftpRmdir("/home/root/temp/");
let result:string = await ssh.sftpRename("/home/root/test.txt","/home/root/test.sql");
let result:string = await ssh.sftpChmod("/home/root/test.sql",0x777);
let result:string = await ssh.sftpDelete("/home/root/test.txt");

```

### Shell

```

let shell = await ssh.shell();
await ssh.shellExec("cd /home/root/");
await ssh.shellExec("ls -l");
await ssh.shellEnd();

```

### Pm2 Process Status

```
let result = await ssh.nodeProcessStatus("run_server");
if (result.status == "online") {
    //.. do something ..
}
```

### Remote FTP Command Utility

```
let ftpConfig = {
    host: "ftp.mywebsite.com",
    port: 21,
    user: "username",
    password: "password"
};

await ssh.exec(ssh.ftpGet(ftpConfig, "ftp_remote_file.txt", "/home/root/downloaded.txt"); 

await ssh.exec(ssh.ftpPut(ftpConfig, "/home/root/file_to_upload.txt","ftp_remote_file.txt" ); 

```

