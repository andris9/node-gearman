# node-gearman

**node-gearman** is an extremely simple Gearman client/worker module for Node.JS. You can register workers and you can submit jobs, that's all about it.

## Installation

Install through *npm*

    npm install node-gearman

## Usage

## Connect to a Gearman server

Set up connection data and create a new `Gearman` object

    var Gearman = require("node-gearman");
    var gearman = new Gearman(hostname, port);

Where `hostname` defaults to `"localhost"` and `port` to `4730`

This doesn't actually create the connection yet. Connection is created when needed but you can force it with `gearman.connect()`

    var gearman = Gearman(hostname, port);
    gearman.connect();

## Connection events

The following events can be listened for a `Gearman` object:

  * **connected** - when the connection has been successfully established to the server
  * **idle** - when a there's no jobs available for workers
  * **close** - connection closed
  * **error** - an error occured. Connection is automatically closed.

Example:

    var gearman = new Gearman(hostname, port);
    gearman.on("connected", function(){
        console.log("Connected to the server!");
    });
    gearman.connect();

## Submit a Job

Jobs can be submitted with `gearman.submitJob(name, payload)` where `name` is the name of the function and `payload` is a string or a Buffer. The returned object (Event Emitter) can be used to detect job status and has the following events:

  * **error** - if the job failed, has parameter error
  * **data** - contains a chunk of data as a Buffer
  * **end** - when the job has been completed, has no parameters

Example:

    var gearman = Gearman(hostname, port);
    var job = gearman.submitJob("reverse", "test string");

    job.on("data", function(data){
        console.log(data.toString("utf-8")); // gnirts tset
    });

    job.on("end", function(){
        console.log("Job completed!");
    });

    job.on("error", function(error){
        console.log(error.message);
    });

## Setup a Worker

Workers can be set up with `gearman.registerWorker(name, callback)` where `name` is the name of the function and `callback` is the function to be run when a job is received.

Worker function `callback` gets two parameters - `payload` (received data as a Buffer) and `worker` which is a helper object to communicate with the server. `worker` object has following methods:

  * **write(data)** - for sending data chunks to the client
  * **end([data])** for completing the job
  * **error()** to indicate that the job failed

Example:

    var gearman = Gearman(hostname, port);

    gearman.registerWorker("reverse", function(payload, worker){
        if(!payload){
            worker.error();
            return;
        }
        var reversed = payload.toString("utf-8").split("").reverse().join("");
        worker.end(reversed);
    });

## License

**MIT**