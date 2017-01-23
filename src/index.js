var Alexa = require("alexa-sdk");
var request = require("request");

var alexa;

var states = {
    NEWGAMEMODE: "_NEWGAMEMODE",
    GUESSMODE: "_GUESSMODE",
    CLUEMODE: "_CLUEMODE",
    GAMEOVERMODE: "_GAMEOVERMODE"
};

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.1e0180c4-424d-498d-83f1-f952b1cb77e8";
    alexa.dynamoDBTableName = "TwentyQuestions";
    alexa.registerHandlers(newSessionHandler, newGameHandler, guessHandler, clueHandler, gameOverHandler);
    alexa.execute();
};

var databaseLocation = "https://raw.githubusercontent.com/mbmccormick/alexa-twenty-questions/master/cards.json";

var database;
var card;

var newSessionHandler = {
    "NewSession": function () {
        printDebugInformation(this, "newSessionHandler:NewSession");
        
        this.attributes["CARD_ID"] = null;
        this.attributes["GUESS_COUNT"] = 0;
        this.attributes["READ_CLUES"] = [];
        this.attributes["CURRENT_CLUE"] = null;
        
        this.handler.state = states.NEWGAMEMODE;
        this.emit(":saveState", true);

        this.emitWithState("LaunchRequest");
    },
    "Unhandled": function () {
        printDebugInformation(this, "newSessionHandler:Unhandled");
        
        this.emit("NewSession");
    }
};

var newGameHandler = Alexa.CreateStateHandler(states.NEWGAMEMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "newGameHandler:LaunchRequest");
        
        downloadDatabase(function (size) {
            alexa.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
        });
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.YesIntent");
        
        var index = getRandomNumber(1, database.length);
        
        card = database[index - 1];
        this.attributes["CARD_ID"] = card.id;

        this.handler.state = states.GUESSMODE;
        this.emit(":saveState", true);

        this.emit(":ask", "OK, let's begin. This card is a " + card.type + ". Take your first guess.", "Please take your first guess.");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.NoIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.HelpIntent");
        
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "newGameHandler:AMAZON.StopIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "newGameHandler:SessionEndedRequest");
        
        this.handler.state = null;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "newGameHandler:Unhandled");
        
        this.emit(":ask", "You can say yes to begin the game or no to quit.", "You can say yes to begin the game or no to quit.");
    }
});

var guessHandler = Alexa.CreateStateHandler(states.GUESSMODE, {
    "GUESS": function () {
        printDebugInformation(this, "guessHandler:GUESS");
        
        this.attributes["GUESS_COUNT"] += 1;
        
        var slots = this.event.request.intent.slots;
        
        var isCorrect = false;
        for (var slot in slots) {
            if (slots.hasOwnProperty(slot)) {
                if (slots[slot].value) {
                    for (var answer in card.answers) {
                        // TODO: implement fuzzy matching
                        if (slots[slot].value.toLowerCase() == answer.toLowerCase()) {
                            isCorrect = true;
                        }
                    }
                }
            }
        }

        if (isCorrect) {
            this.handler.state = states.GAMEOVERMODE;
            this.emit(":saveState", true);

            if (this.attributes["GUESS_COUNT"] == 1) {
                this.emit(":ask", "Congratulations! You got it right on the first guess. Would you like to play again?", "Would you like to start a new game?");
            } else {
                this.emit(":ask", "Congratulations! You got it right in " + this.attributes["GUESS_COUNT"] + " guesses. Would you like to play again?", "Would you like to start a new game?");
            }
        } else {
            this.handler.state = states.CLUEMODE;
            this.emit(":saveState", true);
            
            this.emit(":ask", "Nope, that's not it. Choose a clue number between 1 and 20 to continue.", "Please choose a clue number between 1 and 20.");
        }
    },
    "REPEAT": function () {
        printDebugInformation(this, "guessHandler:REPEAT");
        
        this.emit(":ask", "Your last clue was: " + card.clues[this.attributes["CURRENT_CLUE"] - 1] + " Take your guess.", "Please take your guess.");
    },
    "REPEATALL": function () {
        printDebugInformation(this, "guessHandler:REPEATALL");
        
        var message = "";

        for (var clue in this.attributes["READ_CLUES"]) {
            message += "Clue number " + clue + ": " + card.clues[clue - 1] + " ";
        }

        this.emit(":ask", message + "Take your guess.", "Please take your guess.");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.HelpIntent");
        
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "guessHandler:AMAZON.StopIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "guessHandler:SessionEndedRequest");
        
        this.handler.state = null;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "guessHandler:Unhandled");
        
        this.emit(":ask", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.");
    }
});

var clueHandler = Alexa.CreateStateHandler(states.CLUEMODE, {
    "CLUE": function () {
        printDebugInformation(this, "clueHandler:CLUE");
        
        var number = this.event.request.intent.slots.number.value;

        if (number >= 1 && number <= 20) {
            var isRead = false;
            for (var clue in this.attributes["READ_CLUES"]) {
                if (number == clue) {
                    isRead = true;
                }
            }

            if (!isRead) {
                this.attributes["READ_CLUES"].push(number);
                this.attributes["CURRENT_CLUE"] = number;

                this.handler.state = states.GUESSMODE;
                this.emit(":saveState", true);

                this.emit(":ask", card.clues[number - 1] + " Take your guess.", "Please take your guess.");
            } else {
                this.emit(":ask", "You've already had this clue. Please choose a different clue number.", "Please choose a clue number between 1 and 20.");
            }
        } else {
            this.emit(":ask", "Sorry, please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
        }
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.HelpIntent");
        
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "clueHandler:AMAZON.StopIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "clueHandler:SessionEndedRequest");
        
        this.handler.state = null;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "clueHandler:Unhandled");
        
        this.emit(":ask", "Please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
    }
});

var gameOverHandler = Alexa.CreateStateHandler(states.GAMEOVERMODE, {
    "LaunchRequest": function () {
        printDebugInformation(this, "gameOverHandler:LaunchRequest");
        
        this.emit(":ask", "Would you like to play again?", "Would you like to start a new game?");
    },
    "AMAZON.YesIntent": function () {
        printDebugInformation(this, "gameOverHandler:AMAZON.YesIntent");
        
        this.handler.state = states.GUESSMODE;
        this.emit(":saveState", true);

        this.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        printDebugInformation(this, "gameOverHandler:AMAZON.NoIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        printDebugInformation(this, "gameOverHandler:AMAZON.HelpIntent");
        
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        printDebugInformation(this, "gameOverHandler:AMAZON.StopIntent");
        
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        printDebugInformation(this, "gameOverHandler:SessionEndedRequest");
        
        this.handler.state = null;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        printDebugInformation(this, "gameOverHandler:Unhandled");
        
        this.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

function printDebugInformation(context, name) {
    console.log(name);
    
    var slots = context.event.request.intent.slots;

    for (var slot in slots) {
        if (slots.hasOwnProperty(slot)) {
            if (slots[slot].value) {
                console.log(slots[slot]);
            }
        }
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