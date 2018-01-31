var Alexa = require("alexa-sdk");
var request = require("request");

var alexa;

var states = {
    STARTMODE: "_STARTMODE",
    NEWGAMEMODE: "_NEWGAMEMODE",
    GUESSMODE: "_GUESSMODE",
    CLUEMODE: "_CLUEMODE",
    WINMODE: "_WINMODE",
    LOSEMODE: "_LOSEMODE"
};

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.1e0180c4-424d-498d-83f1-f952b1cb77e8";
    alexa.dynamoDBTableName = "TwentyQuestions";
    alexa.registerHandlers(newSessionHandler, startModeHandler, newGameHandler, guessHandler, clueHandler, winHandler, loseHandler);
    alexa.execute();
};

var databaseLocation = "https://raw.githubusercontent.com/mbmccormick/alexa-twenty-questions/master/cards.json";

var database;
var card;

var newSessionHandler = {
    "NewSession": function () {
        printDebugInformation(this, "newSessionHandler:NewSession");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
    },
    "LaunchRequest": function () {
        printDebugInformation(this, "newSessionHandler:LaunchRequest");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
    },
    "Unhandled": function () {
        printDebugInformation(this, "newSessionHandler:Unhandled");

        var _alexa = this;

        _alexa.emit("NewSession");
    }
};

var startModeHandler = Alexa.CreateStateHandler(states.STARTMODE, {
    "NewSession": function () {
        printDebugInformation(this, "startModeHandler:NewSession");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
    },
    "LaunchRequest": function () {
        printDebugInformation(this, "startModeHandler:LaunchRequest");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
    },
    "Unhandled": function () {
        printDebugInformation(this, "startModeHandler:Unhandled");

        var _alexa = this;

        _alexa.emit("NewSession");
    }
});

var newGameHandler = Alexa.CreateStateHandler(states.NEWGAMEMODE, {
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.YesIntent");

        var _alexa = this;

        restoreSession(this, function () {
            var index = getRandomNumber(1, database.length);
            card = database[index - 1];

            _alexa.attributes["CARD_ID"] = card.id;
            _alexa.attributes["READ_CLUES"] = [];
            _alexa.attributes["CURRENT_CLUE"] = null;

            printDebugInformation(_alexa, "Randomly selected card " + card.id + " for this game.");

            _alexa.handler.state = states.GUESSMODE;

            _alexa.emit(":ask", "OK, let's begin. I am a " + card.type + ". Take your first guess.", "Please take your first guess.");
        });
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.NoIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.HelpIntent");

        var _alexa = this;

        _alexa.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.StopIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "newGameHandler:SessionEndedRequest");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "newGameHandler:Unhandled");

        var _alexa = this;

        _alexa.emit(":ask", "You can say yes to begin the game or no to quit.", "You can say yes to begin the game or no to quit.");
    }
});

var guessHandler = Alexa.CreateStateHandler(states.GUESSMODE, {
    "GUESS": function () {
        printDebugInformation(this, "guessHandler:GUESS");

        var _alexa = this;

        restoreSession(this, function () {
            var slots = _alexa.event.request.intent.slots;

            var isCorrect = false;
            for (var slot in slots) {
                if (slots.hasOwnProperty(slot)) {
                    if (slots[slot].value) {
                        var guess = slots[slot].value;

                        if (find(card.answers, guess)) {
                            isCorrect = true;
                        }
                    }
                }
            }

            if (isCorrect) {
                _alexa.handler.state = states.WINMODE;

                _alexa.emitWithState("LaunchRequest");
            } else {
                if (_alexa.attributes["READ_CLUES"].length < 20) {
                    _alexa.handler.state = states.CLUEMODE;

                    _alexa.emitWithState("LaunchRequest");
                } else {
                    _alexa.handler.state = states.LOSEMODE;

                    _alexa.emitWithState("LaunchRequest");
                }
            }
        });
    },
    "REPEAT": function () {
        printDebugInformation(this, "guessHandler:REPEAT");

        var _alexa = this;

        restoreSession(this, function () {
            _alexa.emit(":ask", "Your last clue was: " + card.clues[_alexa.attributes["CURRENT_CLUE"] - 1] + " Take your guess.", "Please take your guess.");
        });
    },
    "READALL": function () {
        printDebugInformation(this, "guessHandler:READALL");

        var _alexa = this;

        restoreSession(this, function () {
            var message = "";

            for (var clue in _alexa.attributes["READ_CLUES"].sort(sortNumbers)) {
                message += "Clue number " + clue + ": " + card.clues[clue - 1] + " ";
            }

            _alexa.emit(":ask", message + "Take your guess.", "Please take your guess.");
        });
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.HelpIntent");

        var _alexa = this;

        _alexa.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.StopIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "guessHandler:SessionEndedRequest");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "guessHandler:Unhandled");

        var _alexa = this;

        _alexa.emit(":ask", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.");
    }
});

var clueHandler = Alexa.CreateStateHandler(states.CLUEMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "clueHandler:LaunchRequest");

        var _alexa = this;

        restoreSession(this, function () {

            var number = getRandomNumber(1, 20);

            while (find(_alexa.attributes["READ_CLUES"], number) != false) {
                number = getRandomNumber(1, 20);
            }

            _alexa.attributes["READ_CLUES"].push(number);
            _alexa.attributes["CURRENT_CLUE"] = number;

            _alexa.handler.state = states.GUESSMODE;

            _alexa.emit(":ask", "No, that's not it. " + card.clues[number - 1] + " Take your guess.", "Please take your guess.");
        });
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.HelpIntent");

        var _alexa = this;

        _alexa.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.StopIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "clueHandler:SessionEndedRequest");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "clueHandler:Unhandled");

        var _alexa = this;

        restoreSession(this, function () {

            _alexa.emit(":ask", "Your last clue was: " + card.clues[_alexa.attributes["CURRENT_CLUE"] - 1] + " Take your guess.", "Please take your guess.");
        });
    }
});

var winHandler = Alexa.CreateStateHandler(states.WINMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "winHandler:LaunchRequest");

        var _alexa = this;

        restoreSession(this, function () {

            _alexa.handler.state = states.NEWGAMEMODE;

            var score = 20 - _alexa.attributes["READ_CLUES"].length;

            if (score > 1) {
                _alexa.emit(":ask", "Yes, that's right! I am " + card.answers[0] + ". You scored " + score + " points. Would you like to play again?", "Would you like to start a new game?");
            } else {
                _alexa.emit(":ask", "Yes, that's right! I am " + card.answers[0] + ". You scored " + score + " point. Would you like to play again?", "Would you like to start a new game?");
            }
        });
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.YesIntent");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        _alexa.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.NoIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.HelpIntent");

        var _alexa = this;

        _alexa.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "winHandler:AMAZON.StopIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "winHandler:SessionEndedRequest");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "winHandler:Unhandled");

        var _alexa = this;

        _alexa.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

var loseHandler = Alexa.CreateStateHandler(states.LOSEMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "loseHandler:LaunchRequest");

        var _alexa = this;

        restoreSession(this, function () {
            _alexa.handler.state = states.NEWGAMEMODE;

            _alexa.emit(":ask", "Sorry, that's still not right. Game over. I am " + card.answers[0] + ". Would you like to play again?", "Would you like to start a new game?");
        });
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.YesIntent");

        var _alexa = this;

        _alexa.handler.state = states.NEWGAMEMODE;

        _alexa.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.NoIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.HelpIntent");

        var _alexa = this;

        _alexa.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "loseHandler:AMAZON.StopIntent");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "loseHandler:SessionEndedRequest");

        var _alexa = this;

        _alexa.handler.state = states.STARTMODE;

        _alexa.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "loseHandler:Unhandled");

        var _alexa = this;

        _alexa.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

function printDebugInformation(context, name) {
    if (process.env.DEBUG) {
        console.log(name);

        var intent = context.event.request.intent;

        if (intent) {
            var slots = intent.slots;

            for (var slot in slots) {
                if (slots.hasOwnProperty(slot)) {
                    if (slots[slot].value) {
                        console.log(slots[slot]);
                    }
                }
            }
        }
    }
}

function restoreSession(context, callback) {
    printDebugInformation(context, "Restoring session...");

    if (database == null) {
        downloadDatabase(function () {
            if (context.attributes["CARD_ID"]) {
                card = database[context.attributes["CARD_ID"] - 1];
            }

            callback();
        });
    }
    else {
        if (context.attributes["CARD_ID"]) {
            card = database[context.attributes["CARD_ID"] - 1];
        }

        callback();
    }
}

function downloadDatabase(callback) {
    request(databaseLocation, function (err, res, body) {
        database = JSON.parse(body);

        callback();
    });
}

function getRandomNumber(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function find(array, item) {
    for (var i = 0; i < array.length; i++) {
        if (array[i].toString().toLowerCase() === item.toString().toLowerCase()) {
            return true;
        }
    }

    return false;
}

function sortNumbers(a, b) {
    return a - b;
}
