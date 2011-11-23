var Gearman = require("./gearman");

var gearman = new Gearman("pangalink.net",0,1);

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
