var Gearman = require("../lib/gearman"),
    gearman = new Gearman("pangalink.net");

gearman.registerWorker("reverse", function(payload, worker){
    var str = "", i;
    payload = payload.toString("utf-8");

    var counter = 0;
    var timer = setInterval(function(){
        counter++;
        worker.write(counter);
        if(counter>=10){
            worker.error();
            clearInterval(timer);
        }
    }, 1000);

});
