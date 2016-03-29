var request = require("request");

var x = 0;
var finished = 0;

request.post("http://giphifai.herokuapp.com/analyze?num="+process.argv[2],function(err,res,body){
	console.log(body);
});

