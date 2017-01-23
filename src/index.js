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

        this.emitWithState("LaunchRequest");
    },
    "Unhandled": function () {
        this.emit(":tell", "Sorry, an error has occurred.");
    }
};

var newGameHandler = Alexa.CreateStateHandler(states.NEWGAMEMODE, {
    "LaunchRequest": function () {
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
        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        this.emit(":ask", "You can say yes to begin the game or no to quit.", "You can say yes to begin the game or no to quit.");
    }
});

var gamePlayHandler = Alexa.CreateStateHandler(states.GAMEPLAYMODE, {
    "LaunchRequest": function () {
        // TODO: passing this.attributes should be unnecessary, but it does not seem to be accessible as alexa.attributes
        downloadDatabase(this.attributes, function (attributes, size) {
            var index = getRandomNumber(1, size);
            card = database[index - 1];

            attributes["CARD_ID"] = card.id;
            attributes["GUESS_COUNT"] = 0;
            attributes["READ_CLUES"] = [];
            attributes["CURRENT_CLUE"] = null;

            alexa.emit(":ask", "OK, let's begin. This card is a " + card.type + ". Take your first guess.", "Please take your first guess.");
        });
    },
    "GUESS": function () {
        var guess = this.event.request.intent.slots.person.value;

        this.attributes["GUESS_COUNT"] += 1;
        var count = this.attributes["GUESS_COUNT"];

        var isCorrect = false;
        card.answers.forEach(function (value) {
            if (guess.toLowerCase() == value.toLowerCase()) {
                isCorrect = true;
            }
        });

        if (isCorrect) {
            this.handler.state = states.GAMEOVERMODE;
            this.emit(":saveState", true);

            // TODO: handle plural guess vs. guesses
            this.emit(":ask", "Congratulations! You got it right in " + count + " guesses! Would you like to play again?", "Would you like to start a new game?");
        } else {
            this.emit(":ask", "Nope, that's not it. Choose a clue number between 1 and 20 to continue.", "Please choose a clue number between 1 and 20.");
        }
    },
    "CLUE": function () {
        var clue_number = this.event.request.intent.slots.clue_number.value;

        // check to make sure this is a valid clue number
        if (clue_number >= 1 && clue_number <= 20) {
            // check to see if we have already read this clue
            var isRead = false;
            this.attributes["READ_CLUES"].forEach(function (value) {
                if (clue_number == value) {
                    isRead = true;
                }
            });

            if (!isRead) {
                this.attributes["READ_CLUES"].push(clue_number);
                this.attributes["CURRENT_CLUE"] = clue_number;

                this.emit(":ask", card.clues[clue_number - 1] + " Take your next guess.", "Please take your next guess.");
            } else {
                this.emit(":ask", "You've already had this clue. Please choose a different clue number.", "Please choose a clue number between 1 and 20.");
            }
        } else {
            this.emit(":ask", "Sorry, please choose a clue number between 1 and 20.", "Please choose a clue number between 1 and 20.");
        }
    },
    "REPEAT": function () {
        var clue_number = this.attributes["CURRENT_CLUE"];

        this.emit(":ask", "Your last clue was: " + card.clues[clue_number - 1] + " Take your guess.", "Please take your guess.");
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
        this.emit(":tell", "OK, come back soon.");
    },
    "AMAZON.HelpIntent": function () {
        this.emitWithState("Unhandled");
    },
    "AMAZON.StopIntent": function () {
        this.emitWithState("SessionEndedRequest");
    },
    "SessionEndedRequest": function () {
        this.emit(":tell", "OK, come back soon.");
    },
    "Unhandled": function () {
        this.emit(":ask", "You can say yes to start a new game or no to quit.", "You can say yes to start a new game or no to quit.");
    }
});

function downloadDatabase(attributes, callback) {
    request(databaseLocation, function (err, res, body) {
        database = JSON.parse(body);

        callback(attributes, database.length);
    });
}

function getRandomNumber(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
}