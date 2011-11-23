var Gearman = require("../lib/gearman"),
    fs = require("fs"),
    zlib = require("zlib");

var gearman = new Gearman(), // defaults to localhost
    job = gearman.submitJob("stream", null),
    output = fs.createWriteStream(__dirname+"/../../wordlist.txt.copy"); 

// unpack stream and send to file
job.pipe(zlib.createGunzip()).pipe(output);

job.on("end", function(){
    console.log("transfer ready");
    gearman.close();
});
