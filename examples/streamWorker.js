var Gearman = require("../lib/gearman"),
    fs = require("fs"),
    zlib = require("zlib");

var gearman = new Gearman(), // defaults to localhost
    filepath = __dirname+"/../../wordlist.txt";

gearman.registerWorker("stream", function(payload, worker){
    // pipe stream to gzip and then to worker
    console.log("start transfer gzipped content");
    fs.createReadStream(filepath).pipe(zlib.createGzip()).pipe(worker);
});

gearman.on("connect", function(){
    console.log("Listening for jobs");
});