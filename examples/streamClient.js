var Gearman = require("../lib/gearman"),
    fs = require("fs"),
    gearman = new Gearman("pangalink.net");

var job = gearman.submitJob("stream", null),
    output = fs.createWriteStream(__dirname+"/../../wordlist.txt.copy"); 

job.pipe(output, {end: false});

job.on("end", function(){
    console.log("transfer ready");
    gearman.close();
});
