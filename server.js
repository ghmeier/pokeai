var app = require("./server/index.js");

app.set("port", process.env.PORT || 3000);

var server = app.listen(app.get("port"),function(){
	console.log("Clarifai Giphy analysis listening on port " + server.address().port);
});
