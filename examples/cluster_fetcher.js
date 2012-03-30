var cluster = require('cluster');
var http = require('http');
var url = require('url');
var Gearman = require("node-gearman"),
    gearman = new Gearman();  // defaults to localhost
var numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    console.log('fork');
    cluster.fork();
  }

  // Handle deaths and respawn workers.
  cluster.on('death', function(worker) {
    console.log('worker ' + worker.pid + ' died');
    cluster.fork();
  });
} else {
  gearman.registerWorker("fetch", function(payload, worker){
    console.log('Payload: ' + payload);
    if(!payload){
        worker.error();
        return;
    }

    var body = '';

	var options = url.parse(payload.toString());

    var req = http.get(options, function(res) {
        console.log("Got response: " + res.statusCode);
        res.on('data', function(chunk) {
            console.log("Body: " + chunk);
            body += chunk;
        });
        res.on('end', function() {
            worker.end(body);
        });
    }).on('error', function(e) {  
        console.log("Got error: " + e.message);
        worker.error();
    });
  });
};