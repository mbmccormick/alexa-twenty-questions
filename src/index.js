var Alexa = require("alexa-sdk");
var request = require("request");

var alexa;

var states = {
    NEWGAMEMODE: "_NEWGAMEMODE",
    GAMEPLAYMODE: "_GAMEPLAYMODE",
    GAMEOVERMODE: "_GAMEOVERMODE"
};

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.appId = "amzn1.ask.skill.1e0180c4-424d-498d-83f1-f952b1cb77e8";
    alexa.dynamoDBTableName = "TwentyQuestions";
    alexa.registerHandlers(newSessionHandler, newGameHandler, gamePlayHandler, gameOverHandler);
    alexa.execute();
};

var databaseLocation = "https://raw.githubusercontent.com/mbmccormick/alexa-twenty-questions/master/cards.json";

var database;
var card;

var newSessionHandler = {
    "LaunchRequest": function () {
        this.handler.state = states.NEWGAMEMODE;
        this.emit(":saveState", true);

        downloadDatabase(function (size) {
            alexa.emitWithState("LaunchRequest");
        });
    },
    "Unhandled": function () {
        this.emit(":tell", "Sorry, an error has occurred.");
    }
};

var newGameHandler = Alexa.CreateStateHandler(states.NEWGAMEMODE, {
    "LaunchRequest": function () {
        this.attributes["CARD_ID"] = null;
        this.attributes["GUESS_COUNT"] = 0;
        this.attributes["READ_CLUES"] = [];
        this.attributes["CURRENT_CLUE"] = null;

        this.emit(":ask", "Welcome to Twenty Questions! Are you ready to play?", "Are you ready to play?");
    },
    "AMAZON.YesIntent": function () {
        this.handler.state = states.GAMEPLAYMODE;
        this.emit(":saveState", true);

        this.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        this.handler.state = states.NEWGAMEMODE;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        this.emit(":ask", "You can say yes to begin the game or no to quit.", "You can say yes to begin the game or no to quit.");
    }
});

var gamePlayHandler = Alexa.CreateStateHandler(states.GAMEPLAYMODE, {
    "LaunchRequest": function () {
        var index = getRandomNumber(1, database.length);
        
        card = database[index - 1];
        this.attributes["CARD_ID"] = card.id;

        this.emit(":ask", "OK, let's begin. This card is a " + card.type + ". Take your first guess.", "Please take your first guess.");
    },
    "GUESS": function () {
        var guess = this.event.request.intent.slots.guess_string.value;

        this.attributes["GUESS_COUNT"] += 1;

        var isCorrect = false;
        card.answers.forEach(function (value) {
            if (guess.toLowerCase() == value.toLowerCase()) {
                isCorrect = true;
            }
        });

        if (isCorrect) {
            this.handler.state = states.GAMEOVERMODE;
            this.emit(":saveState", true);

            if (this.attributes["GUESS_COUNT"] == 1) {
                this.emit(":ask", "Congratulations! You got it right on the first guess. Would you like to play again?", "Would you like to start a new game?");
            } else {
                this.emit(":ask", "Congratulations! You got it right in " + this.attributes["GUESS_COUNT"] + " guesses. Would you like to play again?", "Would you like to start a new game?");
            }
        } else {
            this.emit(":ask", "Nope, that's not it. Choose a clue number between 1 and 20 to continue.", "Please choose a clue number between 1 and 20.");
        }
    },
    "CLUE": function () {
        var clue_number = this.event.request.intent.slots.clue_number.value;

        if (clue_number >= 1 && clue_number <= 20) {
            var isRead = false;
            this.attributes["READ_CLUES"].forEach(function (value) {
                if (clue_number == value) {
                    isRead = true;
                }
            });

            if (!isRead) {
                this.attributes["READ_CLUES"].push(clue_number);
                this.attributes["CURRENT_CLUE"] = clue_number;

                this.emit(":ask", card.clues[clue_number - 1] + " Take your guess.", "Please take your guess.");
            } else {
                this.emit(":ask", "You've already had this clue. Please choose a different clue number.", "Please choose a clue number between 1 and 20.");
            }
        } else {
            this.emit(":ask", "Sorry, please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
        }
    },
    "REPEAT": function () {
        this.emit(":ask", "Your last clue was: " + card.clues[this.attributes["CURRENT_CLUE"] - 1] + " Take your guess.", "Please take your guess.");
    },
    "REPEATALL": function () {
        var message = "";

        this.attributes["READ_CLUES"].forEach(function (value) {
            message += "Clue number " + value + ": " + card.clues[value - 1] + " ";
        });

        this.emit(":ask", message + "Take your guess.", "Please take your guess.");
    },
    "AMAZON.HelpIntent": function () {
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        this.handler.state = states.NEWGAMEMODE;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        this.emit(":ask", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.", "You can say repeat that to repeat the last clue or read all clues to read all of your clues.");
    }
});

var gameOverHandler = Alexa.CreateStateHandler(states.GAMEOVERMODE, {
    "LaunchRequest": function () {
        this.emit(":ask", "Would you like to play again?", "Would you like to start a new game?");
    },
    "AMAZON.YesIntent": function () {
        this.handler.state = states.GAMEPLAYMODE;
        this.emit(":saveState", true);

        this.emitWithState("LaunchRequest");
    },
    "AMAZON.NoIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "AMAZON.HelpIntent": function () {
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        this.handler.state = states.NEWGAMEMODE;
        this.emit(":saveState", true);

        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        this.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

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