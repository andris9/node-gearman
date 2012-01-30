var Gearman = require("../lib/gearman"),
    testCase = require('nodeunit').testCase;

// CREATE INSTANCE

var gearman = new Gearman("localhost");

exports["Test Connection"] = {
    
    "Check Instance": function(test){
        test.expect(1);
        test.ok(gearman instanceof Gearman, "Instance created");
        test.done();
    },

    "Connect to Server": function(test){
        test.expect(1);

        gearman.connect();

        gearman.on("error", function(e){
            test.ok(false, "Should not occur");
            test.done();
        });

        gearman.on("connect", function(){
            test.ok(1, "Connected to server");
            test.done();
        });

    },

    "Close connection": function(test){
        test.expect(1);

        gearman.on("close", function(){
            test.ok(1, "Connection closed");
            test.done();
        });
        gearman.close();
    }

};

exports["Worker and Client"] = {

    setUp: function(callback){

        this.gearman = new Gearman("localhost");
        this.gearman.on("connect", function(){
            callback();
        });
        this.gearman.on("error", function(e){
            console.log(e.message);
        });
        this.gearman.connect();
    },

    tearDown: function(callback){
        this.gearman.on("close", function(){
            callback();
        });
        this.gearman.close();
    },
    
    "Send/Receive binary data": function(test){
        test.expect(2);
        var data1 = new Buffer([0,1,2,3,4,5,6,7,8,9,10]),
            data2 = new Buffer([245,246,247,248,249,250,251,252,253,254,255]);
        
        this.gearman.registerWorker("test", function(payload, worker){
            test.equal(payload.toString("base64"), data1.toString("base64"));
            worker.end(data2);
        });

        var job = this.gearman.submitJob("test", data1);
        job.on("data", function(payload){
            test.equal(payload.toString("base64"), data2.toString("base64"));
        });

        job.on("end", function(){
            this.gearman.on("idle", function(){
                test.done();
            });
        });
    },

    "Worker fails": function(test){
        test.expect(1);
        this.gearman.registerWorker("test", function(payload, worker){
            worker.error();
        });

        var job = this.gearman.submitJob("test", "test");

        job.on("error", function(err){
            test.ok(err,"Job failed");
            this.gearman.on("idle", function(){
                test.done();
            });
        });

        job.on("end", function(err){
            test.ok(false, "Job did not fail");
            test.done();
        });
    },

    "Server fails jobs": function(test){
        test.expect(1);
        
        var job = this.gearman.submitJob("test", "test");

        job.on("error", function(err){
            test.ok(err,"Job failed");
            test.done();
        });

        job.on("end", function(err){
            test.ok(false, "Job did not fail");
            test.done();
        });

        setTimeout((function(){
            this.gearman.close();
        }).bind(this),300);
        
    }

};

exports["Job timeout"] = {
    setUp: function(callback){

        this.gearman = new Gearman("localhost");
        this.gearman.on("connect", function(){
            callback();
        });
        this.gearman.on("error", function(e){
            console.log(e.message);
        });
        this.gearman.connect();
        
        this.gearman.registerWorker("test", function(payload, worker){
            setTimeout(function(){
                worker.end("OK");
            }, 300);
        });
    },

    tearDown: function(callback){
        this.gearman.on("close", function(){
            callback();
        });
        this.gearman.close();
    },
    
    "Timeout event": function(test){
        test.expect(1);
        
        var job = this.gearman.submitJob("test", "test");
        job.setTimeout(100);

        job.on("timeout", function(){
            test.ok(1,"TImeout occured");
            test.done();
        });

        job.on("error", function(err){
            test.ok(false,"Job failed");
            test.done();
        });

        job.on("end", function(err){
            test.ok(false, "Job should not complete");
            test.done();
        });
    },
    
    "Timeout callback": function(test){
        test.expect(1);
        
        var job = this.gearman.submitJob("test", "test");
        job.setTimeout(100, function(){
            test.ok(true,"TImeout occured");
            test.done();
        });

        job.on("error", function(err){
            test.ok(false,"Job failed");
            test.done();
        });

        job.on("end", function(err){
            test.ok(false, "Job should not complete");
            test.done();
        });
    },
    
    "Timeout set but does not occur": function(test){
        test.expect(1);
        
        var job = this.gearman.submitJob("test", "test");
        job.setTimeout(400, function(){
            test.ok(false,"Timeout occured");
            test.done();
        });

        job.on("error", function(err){
            test.ok(false,"Job failed");
            test.done();
        });

        job.on("end", function(err){
            test.ok(true, "Job completed before timeout");
            test.done();
        });
    }
}


