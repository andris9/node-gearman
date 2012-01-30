var Gearman = require("../lib/gearman"),
    gearman = new Gearman(); // defaults to localhost

var job = gearman.submitJob("reverse", "test string");

job.setTimeout(2000);

job.on("timeout", function(){
    console.log("Timeout!");
    gearman.close();
})

job.on("error", function(err){
    console.log("ERROR: ", err.message || err);
    gearman.close();
});

job.on("data", function(reversed){
    console.log(reversed.toString());
});

job.on("end", function(){
    console.log("Ready!");
    gearman.close();
});