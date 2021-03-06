var table;
var _uid;
var client = false;
var destination, origin;
var responsibilityTimer, rangeTimer;
var letters = ["A", "B", "C"];
var clientX, clientY;
var myX, myY;
var clientRange;
var instStatus = [
    {dist: 200, sent: false},
    {dist: 150, sent: false},
    {dist: 50, sent: false}//,
    //{dist: 20, sent: false}
];
var toFinal = false;
var finalDistance = 0;
var sentLast = false;
var initDistance = 0;

//self.addEventListener('connect', function (e) {
//client = e.ports[0];

onmessage = function (e) {
    console.log("Message received: " + e.data.command);
    switch (e.data.command) {
        case "init":
        {
            _uid = e.data.uid;
            table = e.data.table;
            myX = e.data.x;
            myY = e.data.y;
            postMessage({
                command: "log",
                entry: "Sensor node initialized.",
                time: getDate(),
                uid: _uid,
                from: _uid
            });
            break;
        }
        case "start":
        {
            clientX = e.data.clientX;
            clientY = e.data.clientY;
            destination = e.data.destination;
            origin = e.data.origin;
            postMessage({
                command: "log",
                entry: "Received <span class='cmd'>START</span> from wearable.",
                time: getDate(),
                from: _uid
            });
            postMessage({
                command: "log",
                entry: "Distance to wearable: " + Math.round(getDistanceToClient()),
                time: getDate(),
                uid: _uid,
                from: _uid
            });
            // Broadcast CANDIDATE
            postMessage({
                routeTo: "*",
                from: _uid,
                packet: {
                    command: "candidate",
                    distance: getDistanceToClient(),
                    from: _uid
                }
            });
            client =
                responsibilityTimer = setTimeout(takeResponsibility, 3000);
            break;
        }
        case "candidate":
        {
            postMessage({
                command: "log",
                time: getDate(),
                entry: "Received <span class='cmd'>CANDIDATE</span> from " + letters[e.data.from],
                uid: _uid,
                from: _uid
            });
            if (getDistanceToClient() < parseInt(e.data.distance, 10)) {
                // We're superior to candidate
                postMessage({
                    "routeTo": e.data.from,
                    "from": _uid,
                    "packet": {
                        "command": "superior",
                        "from": _uid
                    }
                });

                postMessage({
                    command: "log",
                    time: getDate(),
                    entry: "Sent <span class='cmd'>SUPERIOR</span> to " + letters[e.data.from],
                    uid: _uid,
                    from: _uid
                });
            }
            break;
        }
        case "superior":
        {
            clearTimeout(responsibilityTimer);
            postMessage({
                command: "log",
                time: getDate(),
                entry: "Received <span class='cmd'>SUPERIOR</span> from " + letters[e.data.from] + ", conceding",
                uid: _uid,
                from: _uid
            });
            break;
        }

        case "route":
        {
            postMessage({
                command: "log",
                time: getDate(),
                entry: "Received <span class='cmd'>ROUTE</span> from " + e.data.from,
                uid: _uid,
                from: _uid
            });
            origin = e.data.origin;
            destination = e.data.destination;
            reset();
            setTimeout(takeResponsibility, 3000);
            break;
        }

        case "range":
        {
            clientX = e.data.x;
            clientY = e.data.y;
            getInstruction();           // To set finalDistance
            clientRange = (!toFinal) ? getDistanceToClient() : finalDistance - getDistanceToClient();

            var sentThisTime = false;
            for (i = 0; i < instStatus.length; i++) {
                if (clientRange <= instStatus[i].dist && !instStatus[i].sent
                    && initDistance >= instStatus[i].dist) {

                    instStatus[i].sent = true;

                    if (!sentThisTime) {
                        // Get instruction
                        postMessage({
                            command: "instruction",
                            instruction: {direction: getInstruction().direction, distance: instStatus[i].dist / 10},
                            time: getDate(),
                            from: _uid
                        });
                        sentThisTime = true;
                    }
                }
            }

            // Check if it's time to route and transfer
            if (Math.abs(clientRange) <= 19 && !sentLast) {
                sentLast = true;
                // Send final turing direction
                postMessage({
                    command: "instruction",
                    instruction: {distance: 0, direction: getInstruction().direction},
                    time: getDate(),
                    from: _uid
                });

                if (toFinal) return;

                var next = getNextNode();
                if (next instanceof Array) {
                    // Time to go to dest!
                    toFinal = true;
                    sentLast = false;
                    instStatus = [
                        {dist: 200, sent: false},
                        {dist: 100, sent: false},
                        {dist: 50, sent: false}//,
                        //{dist: 20, sent: false}
                    ];
                } else {
                    // Route to next node
                    postMessage({
                        command: "log",
                        time: getDate(),
                        entry: "Routing to next node...sending <span class='cmd'>ROUTE</span>",
                        uid: _uid,
                        from: _uid
                    });

                    postMessage({
                        routeTo: next,
                        from: _uid,
                        packet: {
                            command: "route",
                            destination: "x",
                            origin: letters[_uid]
                        }
                    });
                    clearInterval(rangeTimer);
                    reset();
                }
            }

            break;
        }
    }
};

function getDistanceToClient() {
    var xDiff = Math.pow(myX - clientX, 2);
    var yDiff = Math.pow(myY - clientY, 2);
    console.log("Distance: " + Math.pow(xDiff + yDiff, 0.5));
    return Math.pow(xDiff + yDiff, 0.5);
}

function getDate() {
    var date = new Date();
    return date.toISOString().substring(11);
}

function getInstruction() {
    if (!toFinal) {
        var direction = (table[destination][origin]) ? table[destination][origin].direction : origin;
        var distance = Math.round(getDistanceToClient());
        return {direction: direction, distance: distance};
    } else {
        var direction = table[destination].final[1];
        var distance = table[destination].final[0] - Math.round(getDistanceToClient());
        finalDistance = table[destination].final[0];
        initDistance = table[destination].final[0];
        return {direction: direction, distance: distance};
    }
}

function getNextNode() {
    if (table[destination].next > -1) {
        return table[destination].next;
    } else {
        return table[destination].final;
    }
}

function rangeReq() {
    //clearInterval(rangeTimer);
    postMessage({
        command: "range",
        time: getDate(),
        from: _uid
    });
}

function reset() {
    toFinal = false;
    finalDistance = 0;
    sentLast = false;
    initDistance = 0;
    instStatus = [
        {dist: 200, sent: false},
        {dist: 150, sent: false},
        {dist: 50, sent: false}//,
        //{dist: 20, sent: false}
    ];
}

function takeResponsibility() {
    client = true;

    rangeTimer = setInterval(rangeReq, 100);

    initDistance = getInstruction().distance;

    // Send initial instruction
    postMessage({
        command: "instruction",
        instruction: {direction: getInstruction().direction, distance: Math.round(getInstruction().distance / 10)},
        time: getDate(),
        from: _uid
    });

    postMessage({
        command: "log",
        time: getDate(),
        entry: "*** Taking responsibility for client navigation ***",
        uid: _uid,
        from: _uid
    });
}
