var express = require("express");
var secrets = require("./config/secrets");
var swig = require("swig");
var lodash = require("lodash");
var path = require("path");
var bodyParser = require("body-parser");
var expressValidator = require("express-validator");
var session = require("express-session");
var passport = require("passport");
var favicon = require("serve-favicon");
var cors = require("cors");
var fs = require("fs");
var bayes = require("bayes");
var corsOptions = {
	origin : "*"
};

var app = express();

app.engine("html",swig.renderFile);
app.set("views",path.join(__dirname,"views"));
app.set("view engine","html");
app.locals._ = lodash;

app.use(bodyParser.json());
app.use(expressValidator());

app.use(session({
	resave: true,
	saveUninitialized: true,
	cookie: {
		maxAge: 60 * 1000
	},
	secret: secrets.sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors(corsOptions));

var data = fs.readFileSync("classifier.json","utf8");
var classifier = {};

if (data){
    classifier = bayes.fromJson(data);
}else{
    classifier = bayes();
}

var routes = require("./routes.js");
routes(app,classifier,passport);

process.on('exit', function() {
    console.log("Exiting");

});

module.exports = app;
