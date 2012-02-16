var netlib = require("net"),
    Stream = require("stream").Stream,
    utillib = require("util");

module.exports = Gearman;

function Gearman(host, port, debug){
    Stream.call(this);

    this.debug = !!debug;
    this.port = port || 4730;
    this.host = host || "localhost";

    this.init();
}
utillib.inherits(Gearman, Stream);

Gearman.prototype.init = function(){
    this.connected = this.connecting = this.processing = false;

    this.processing = false;
    this.commandQueue = [];
    this.handleCallbackQueue = [];

    this.remainder = false;

    this.currentJobs = {};
    this.currentWorkers = {};

    this.workers = {};
}

Gearman.packetTypes = {
    CAN_DO: 1,
    CANT_DO: 2,
    RESET_ABILITIES: 3,
    PRE_SLEEP: 4,
    NOOP: 6,
    SUBMIT_JOB: 7,
    JOB_CREATED: 8,
    GRAB_JOB: 9,
    NO_JOB: 10,
    JOB_ASSIGN: 11,
    WORK_STATUS: 12,
    WORK_COMPLETE: 13,
    WORK_FAIL: 14,
    GET_STATUS: 15,
    ECHO_REQ: 16,
    ECHO_RES: 17,
    SUBMIT_JOB_BG: 18,
    ERROR: 19,
    STATUS_RES: 20,
    SUBMIT_JOB_HIGH: 21,
    SET_CLIENT_ID: 22,
    CAN_DO_TIMEOUT: 23,
    ALL_YOURS: 24,
    WORK_EXCEPTION: 25,
    OPTION_REQ: 26,
    OPTION_RES: 27,
    WORK_DATA: 28,
    WORK_WARNING: 29,
    GRAB_JOB_UNIQ: 30,
    JOB_ASSIGN_UNIQ: 31,
    SUBMIT_JOB_HIGH_BG: 32,
    SUBMIT_JOB_LOW: 33,
    SUBMIT_JOB_LOW_BG: 34,
    SUBMIT_JOB_SCHED: 35,
    SUBMIT_JOB_EPOCH: 36
};

Gearman.packetTypesReversed = {
    "1": "CAN_DO",
    "2": "CANT_DO",
    "3": "RESET_ABILITIES",
    "4": "PRE_SLEEP",
    "6": "NOOP",
    "7": "SUBMIT_JOB",
    "8": "JOB_CREATED",
    "9": "GRAB_JOB",
    "10": "NO_JOB",
    "11": "JOB_ASSIGN",
    "12": "WORK_STATUS",
    "13": "WORK_COMPLETE",
    "14": "WORK_FAIL",
    "15": "GET_STATUS",
    "16": "ECHO_REQ",
    "17": "ECHO_RES",
    "18": "SUBMIT_JOB_BG",
    "19": "ERROR",
    "20": "STATUS_RES",
    "21": "SUBMIT_JOB_HIGH",
    "22": "SET_CLIENT_ID",
    "23": "CAN_DO_TIMEOUT",
    "24": "ALL_YOURS",
    "25": "WORK_EXCEPTION",
    "26": "OPTION_REQ",
    "27": "OPTION_RES",
    "28": "WORK_DATA",
    "29": "WORK_WARNING",
    "30": "GRAB_JOB_UNIQ",
    "31": "JOB_ASSIGN_UNIQ",
    "32": "SUBMIT_JOB_HIGH_BG",
    "33": "SUBMIT_JOB_LOW",
    "34": "SUBMIT_JOB_LOW_BG",
    "35": "SUBMIT_JOB_SCHED",
    "36": "SUBMIT_JOB_EPOCH"
};

Gearman.paramCount = {
    ERROR:          ["string", "string"],
    JOB_ASSIGN:     ["string", "string", "buffer"],
    JOB_ASSIGN_UNIQ:["string", "string", "string", "buffer"],
    JOB_CREATED:    ["string"],
    WORK_COMPLETE:  ["string", "buffer"],
    WORK_EXCEPTION: ["string", "string"],
    WORK_WARNING:   ["string", "string"],
    WORK_DATA:      ["string", "buffer"],
    WORK_FAIL:      ["string"],
    WORK_STATUS:    ["string", "number", "number"]
};

Gearman.prototype.connect = function(){
    
    if(this.connected || this.connecting){
        // juhul kui ühendus on juba olemas käivita protsessimine
        if(this.connected && !this.processing){
            this.processCommandQueue();
        }
        return false;
    }
    
    this.connecting = true;

    if(this.debug){
        console.log("connecting...");
    }

    this.socket = (netlib.connect || netlib.createConnection)(this.port, this.host);
        
    this.socket.on("connect", (function(){
        this.socket.setKeepAlive(true);
            
        this.connecting = false;
        this.connected = true;
    
        if(this.debug){
            console.log("connected!");
        }
        this.emit("connect");

        this.processCommandQueue();

    }).bind(this));

     

    this.socket.on("end", this.close.bind(this));
    this.socket.on("close", this.close.bind(this));
    this.socket.on("error", this.errorHandler.bind(this));
    this.socket.on("data", this.receive.bind(this));
};

Gearman.prototype.close = function(){
    if(this.connected){
        this.closeConnection();
        this.emit("close");
    }
};

Gearman.prototype.closeConnection = function(){
    var i;

    if(this.connected){
        if(this.socket){
            try{
                this.socket.end();
            }catch(E){}
        }
        this.connected = false;
        this.connecting = false;

        // clear current jobs
        for(i in this.currentJobs){
            if(this.currentJobs.hasOwnProperty(i)){
                if(this.currentJobs[i]){
                    this.currentJobs[i].abort();
                    this.currentJobs[i].emit("error", new Error("Job failed"));
                }
                delete this.currentJobs[i];
            }
        }

        // clear current workers
        for(i in this.currentWorkers){
            if(this.currentWorkers.hasOwnProperty(i)){
                if(this.currentWorkers[i]){
                    this.currentWorkers[i].finished = true;
                }
                delete this.currentWorkers[i];
            }
        }
        
        this.init();
    }
};

Gearman.prototype.errorHandler = function(err){
    this.emit("error", err);
    this.closeConnection();
};


Gearman.prototype.processCommandQueue = function(chunk){
    var command;
    if(this.commandQueue.length){
        this.processing = true;
        command = this.commandQueue.shift();
        this.sendCommandToServer.apply(this, command);
    }else{
        this.processing = false;
    }
};

Gearman.prototype.sendCommand = function(){
    var command = Array.prototype.slice.call(arguments);
    this.commandQueue.push(command);
    if(!this.processing){
        this.processCommandQueue();
    }
};

Gearman.prototype.sendCommandToServer = function(){
    var body,
        args = Array.prototype.slice.call(arguments),
        commandName, commandId, commandCallback,
        i, len, bodyLength = 0, curpos = 12;
    
    if(!this.connected){
        this.commandQueue.unshift(args);
        return this.connect();
    }

    commandName = (args.shift() || "").trim().toUpperCase();

    if(args.length && typeof args[args.length-1] == "function"){
        commandCallback = args.pop();
        this.handleCallbackQueue.push(commandCallback);
    }

    commandId = Gearman.packetTypes[commandName] || 0;

    if(!commandId){
        // TODO: INVALID COMMAND!
    }

    for(i=0, len=args.length; i<len; i++){
        if(!(args[i] instanceof Buffer)){
            args[i] = new Buffer((args[i] || "").toString(), "utf-8");
        }
        bodyLength += args[i].length;
    }

    bodyLength += args.length>1 ? args.length - 1 : 0;

    body = new Buffer(bodyLength + 12); // packet size + 12 byte header

    body.writeUInt32BE(0x00524551, 0); // \0REQ
    body.writeUInt32BE(commandId, 4); // \0REQ
    body.writeUInt32BE(bodyLength, 8); // \0REQ

    // compose body
    for(i=0, len = args.length; i<len; i++){
        args[i].copy(body, curpos);
        curpos += args[i].length;
        if(i < args.length-1){
            body[curpos++] = 0x00;
        }
    }

    if(this.debug){
        console.log("Sending: " + commandName + " with "+args.length+" params");
        console.log(" - ", body);
        args.forEach(function(arg, i){
            console.log("  - ARG:"+i+" ", arg.toString());
        });
    }

    this.socket.write(body, this.processCommandQueue.bind(this));
};

Gearman.prototype.receive = function(chunk){
    var data = new Buffer((chunk && chunk.length || 0) + (this.remainder && this.remainder.length || 0)),
        commandId, commandName,
        bodyLength = 0, args = [], argTypes, curarg, i, len, argpos, curpos;

    // nothing to do here
    if(!data.length){
        return;
    }
    
    // if theres a remainder value, tie it together with the incoming chunk
    if(this.remainder){
        this.remainder.copy(data, 0, 0);
        if(chunk){
            chunk.copy(data, this.remainder.length, 0);
        }
    }else{
        data = chunk;
    }
    
    // response header needs to be at least 12 bytes
    // otherwise keep the current chunk as remainder
    if(data.length<12){
        this.remainder = data;
        return;
    }

    if(data.readUInt32BE(0) != 0x00524553){
        // OUT OF SYNC!
        return this.errorHandler(new Error("Out of sync with server"));
    }

    // response needs to be 12 bytes + payload length
    bodyLength = data.readUInt32BE(8);
    if(data.length < 12 + bodyLength){
        this.remainder = data;
        return;
    }

    // keep the remainder if incoming data is larger than needed
    if(data.length > 12 + bodyLength){
        this.remainder = data.slice(12 + bodyLength);
        data = data.slice(0, 12 + bodyLength);
    }else{
        this.remainder = false;
    }

    commandId = data.readUInt32BE(4);
    commandName = (Gearman.packetTypesReversed[commandId] || "");
    if(!commandName){
        // TODO: UNKNOWN COMMAND!
        return;
    }

    if(bodyLength && (argTypes = Gearman.paramCount[commandName])){
        curpos = 12;
        argpos = 12;

        for(i = 0, len = argTypes.length; i < len; i++){

            if(i < len - 1){
                while(data[curpos] !== 0x00 && curpos < data.length){
                    curpos++;
                }
                curarg = data.slice(argpos, curpos);
            }else{
                curarg = data.slice(argpos);
            }

            switch(argTypes[i]){
                case "string":
                    curarg = curarg.toString("utf-8");
                    break;
                case "number":
                    curarg = Number(curarg.toString()) || 0;
                    break;
            }

            args.push(curarg);

            curpos++;
            argpos = curpos;
            if(curpos >= data.length){
                break;
            }
        }
    }

    if(this.debug){
        console.log("Received: " + commandName + " with " + args.length + " params");
        console.log(" - ", data);
        args.forEach(function(arg, i){
            console.log("  - ARG:"+i+" ", arg.toString());
        });
    }

    // Run command
    if(typeof this["receive_" + commandName] == "function"){
        if(commandName == "JOB_CREATED" && this.handleCallbackQueue.length){
            args = args.concat(this.handleCallbackQueue.shift());
        }
        this["receive_" + commandName].apply(this, args);
    }

    // rerun receive just in case there's enough data for another command
    if(this.remainder && this.remainder.length>=12){
        process.nextTick(this.receive.bind(this));
    }
};

Gearman.prototype.receive_NO_JOB = function(){
    this.sendCommand("PRE_SLEEP");
    this.emit("idle");
};

Gearman.prototype.receive_NOOP = function(){
    this.sendCommand("GRAB_JOB");
};

Gearman.prototype.receive_ECHO_REQ = function(payload){
    this.sendCommand("ECHO_RES", payload);
};

Gearman.prototype.receive_ERROR = function(code, message){
    if(this.debug){
        console.log("Server error: ", code, message);
    }
};

Gearman.prototype.receive_JOB_CREATED = function(handle, callback){
    if(typeof callback == "function"){
        callback(handle);
    }
};

Gearman.prototype.receive_WORK_FAIL = function(handle){
    var job;
    if((job = this.currentJobs[handle])){
        delete this.currentJobs[handle];
        if(!job.aborted){
            job.abort();
            job.emit("error", new Error("Job failed"));
        }
    }
};

Gearman.prototype.receive_WORK_DATA = function(handle, payload){
    if(this.currentJobs[handle] && !this.currentJobs[handle].aborted){
        this.currentJobs[handle].emit("data", payload);
        this.currentJobs[handle].updateTimeout();
    }
};

Gearman.prototype.receive_WORK_COMPLETE = function(handle, payload){
    var job;
    if((job = this.currentJobs[handle])){
        delete this.currentJobs[handle];
        if(!job.aborted){
            clearTimeout(job.timeoutTimer);
            
            if(payload){
                job.emit("data", payload);
            }
            
            job.emit("end");    
        }
    }
};

Gearman.prototype.receive_JOB_ASSIGN = function(handle, name, payload){
    if(typeof this.workers[name] == "function"){
        var worker = new this.Worker(this, handle, name, payload);
        this.currentWorkers[handle] = worker;
        this.workers[name](payload, worker);
    }
};

Gearman.prototype.registerWorker = function(name, func){
    if(!this.workers[name]){
        this.sendCommand("CAN_DO", name);
        this.sendCommand("GRAB_JOB");
    }
    this.workers[name] = func;
};

Gearman.prototype.submitJob = function(name, payload){
    return new this.Job(this, name, payload);
};

// WORKER

Gearman.prototype.Worker = function(gearman, handle, name, payload){
    Stream.call(this);

    this.gearman = gearman;
    this.handle = handle;
    this.name = name;
    this.payload = payload;
    this.finished = false;
    this.writable = true;
};
utillib.inherits(Gearman.prototype.Worker, Stream);

Gearman.prototype.Worker.prototype.write = function(data){
    if(this.finished){
        return;
    }
    this.gearman.sendCommand("WORK_DATA", this.handle, data);
};

Gearman.prototype.Worker.prototype.end = function(data){
    if(this.finished){
        return;
    }
    this.finished = true;
    this.gearman.sendCommand("WORK_COMPLETE", this.handle, data);
    delete this.gearman.currentWorkers[this.handle];
    this.gearman.sendCommand("GRAB_JOB");
};

Gearman.prototype.Worker.prototype.error = function(error){
    if(this.finished){
        return;
    }
    this.finished = true;
    this.gearman.sendCommand("WORK_FAIL", this.handle);
    delete this.gearman.currentWorkers[this.handle];
    this.gearman.sendCommand("GRAB_JOB");
};

// JOB

Gearman.prototype.Job = function(gearman, name, payload){
    Stream.call(this);

    this.gearman = gearman;
    this.name = name;
    this.payload = payload;

    this.timeoutTimer = null;

    gearman.sendCommand("SUBMIT_JOB", name, false, payload, this.receiveHandle.bind(this));
};
utillib.inherits(Gearman.prototype.Job, Stream);

Gearman.prototype.Job.prototype.setTimeout = function(timeout, timeoutCallback){
    this.timeoutValue = timeout;
    this.timeoutCallback = timeoutCallback;
    this.updateTimeout();
}

Gearman.prototype.Job.prototype.updateTimeout = function(){
    if(this.timeoutValue){
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = setTimeout(this.onTimeout.bind(this), this.timeoutValue);
    }
}

Gearman.prototype.Job.prototype.onTimeout = function(){
    if(this.handle){
        delete this.gearman.currentJobs[this.handle];
    }
    if(!this.aborted){
        this.abort();
        var error = new Error("Timeout exceeded for the job");
        if(typeof this.timeoutCallback == "function"){
            this.timeoutCallback(error);
        }else{
            this.emit("timeout", error);
        }
    }
}

Gearman.prototype.Job.prototype.abort = function(){
    clearTimeout(this.timeoutTimer);
    this.aborted = true;
}

Gearman.prototype.Job.prototype.receiveHandle = function(handle){
    if(handle){
        this.handle = handle;
        this.gearman.currentJobs[handle] = this;
    }else{
        this.emit("error", new Error("Invalid response from server"));
    }
};
