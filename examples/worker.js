var Gearman = require("../lib/gearman"),
    gearman = new Gearman();  // defaults to localhost

gearman.registerWorker("reverse", function(payload, worker){
    if(!payload){
        worker.error();
        return;
    }
    var reversed = payload.toString("utf-8").split("").reverse().join("");

    // delay for 1 sec before returning
    setTimeout(function(){
        worker.end(reversed);
    },1000);
    
});
