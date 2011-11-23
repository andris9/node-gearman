var Gearman = require("./gearman");

var gearman = new Gearman("pangalink.net");

var y = new Gearman("pangalink.net");
var job = y.submitJob("reverse", "test");

job.on("error", function(err){
    console.log("ERROR: ", err.message || err);
});

job.on("data", function(chunk){
    if(chunk){
        console.log(chunk.toString());
    }
});

job.on("end", function(){
    console.log("Ready!");
});
