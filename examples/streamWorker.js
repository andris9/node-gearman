var Gearman = require("../lib/gearman"),
    fs = require("fs");

var gearman = new Gearman("pangalink.net",0,1);

var filepath = __dirname+"/../../wordlist.txt";

gearman.registerWorker("stream", function(payload, worker){
    // pipe stream to worker
    console.log("start transfer");
    fs.createReadStream(filepath).pipe(worker);
});

gearman.on("connect", function(){
    console.log("Listening for jobs");
})