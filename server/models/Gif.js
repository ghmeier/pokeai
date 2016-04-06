var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectID;
var request = require("request");
var bayes = require("bayes");
var fs = require("fs");
var Pokedex = require("pokedex-promise-v2");
var P = new Pokedex();

var mongo_url = "mongodb://heroku_qs4vjvqc:gsnlshm4n071a1jplocgesdd3q@ds011810.mlab.com:11810/heroku_qs4vjvqc";

function PokeImage() {
	this.url = "";
	this.keyword = "";
	this.tags = new Array();
	this.id = "";
};

function PokeImage(id,url,keyword,tags,colors,callback){
	this.url = url || "";
	this.keyword = keyword;
	this.id= id || "";
	this.tags=tags || new Array();
	this.colors = colors || new Array();
	if (callback && typeof(callback) == 'function'){
		callback(this);
	}
}

PokeImage.getImageByUrl = function(url,callback){
	MongoClient.connect(mongo_url,function(err,db){
		if (err){
			console.log(err);
			callback(false);
			return;
		}


		findImage({url:url},db,function(image){
			if (!image){
				callback(null);
				return;
			}

			callback(image);
		});
	});
}

PokeImage.getImageByKeyword = function(keyword,callback){
    P.getPokemonByName(keyword.toLowerCase()).then(function(response){
    	console.log("Validated Pokemon Name");
        MongoClient.connect(mongo_url,function(err,db){
        	if (err){
        		console.log(err);
        		callback(false);
        		return;
        	}

        	findImage({keyword:keyword},db,function(image){
        		if (!image){
        			callback(null);
        			return;
        		}

        		callback(image);
        	});
        });
	}).catch(function(error){
		return {error:true,message:"No pokemon found called "+q,data:error};
	});
}

PokeImage.insertImage = function(image,callback){
	MongoClient.connect(mongo_url,function(err,db){
		if (err){
			console.log(err);
			callback(false);
		}

		insertImage(image.url,image.keyword,image.tags,image.colors,db,function(success){
			callback(success);
		})

	});
}

var insertImage = function(url,keyword,tags,colors,db,callback){
	db.collection("images").insertOne({
		"url":url,
		"keyword":keyword,
		"tags":tags,
		"colors":colors
	}, function (err,result){
		if (err){
			console.log(err);
			callback(false);
		}

		callback(true);
		db.close();
	});
};

var findImage = function(query,db,callback){
	var cursor = db.collection("images").findOne(query,{},function(err,doc){
		if (err){
			console.log(err);
			callback(false);
			return;
		}

		if (!doc){
			callback(null);
			return;
		}

		return new PokeImage(doc._id,doc.url,doc.keyword,doc.tags,doc.colors,function(image){
			db.close();
			callback(image);
		});
	});

}

var updateImage = function(url,data,db,callback){
	var col = db.collection("images");

	col.updateOne({url:url},{$set:data});
	db.close();
}

PokeImage.prototype.classify = function(classifier,callback){
	var self = this;

	classifier.learn(self.tags.join(","),self.keyword);
	fs.writeFileSync("classifier.json",classifier.toJson());

}

PokeImage.prototype.categorize = function(classifier){
	return classifier.categorize(this.tags.join(", "));
}

PokeImage.prototype.ignore = function(tag,callback){

	if (this.tags.indexOf(tag) == -1){
		callback(false);
		return;
	}

	var self = this;

	request.post({
		url:"https://api.clarifai.com/v1/token",
		form:{
			"grant_type":"client_credentials",
			"client_id": "LtBAeH3T5UdE9uTYaiehZObqh1PZehqGOEwr064G",
			"client_secret":"BddH4Yro_9WsszRNkfyVLPNCGdcKk7Ljiooxbzm5"
		}
	},function(err,res,body){

		if (err){
			callback(false);
			return;
		}

		var token_data = JSON.parse(body);
		token = token_data.access_token;

		request.get({
			url:"http://api.clarifai.com/v1/feedback?url="+self.url+"&remove_tags="+tag,
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){


		});
	});

}

PokeImage.prototype.color = function(callback){
	if (!this.url){
		return "image must have a url";
	}

	var cur_url = this.url;
	var self = this;

	request.post({
		url:"https://api.clarifai.com/v1/token",
		form:{
			"grant_type":"client_credentials",
			"client_id": "LtBAeH3T5UdE9uTYaiehZObqh1PZehqGOEwr064G",
			"client_secret":"BddH4Yro_9WsszRNkfyVLPNCGdcKk7Ljiooxbzm5"
		}
	},function(err,res,body){

		if (err){
			return err;
		}

		var token_data = JSON.parse(body);
		token = token_data.access_token;

		request.get({
			url:"http://api.clarifai.com/v1/color?url="+cur_url,
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){
			var data = JSON.parse(body);
			if (!data.results){
				if (data.errors){
					console.log(data.errors[0].error.message);
				}else{
					console.log("some other error");
				}
				callback(false);
				return;
			}
			var raw = data.results[0].colors;

			for (i=0;i<raw.length;i++){
				self.colors.push({hex:raw[i].hex,density:raw[i].density});
			}

			MongoClient.connect(mongo_url,function(err,db){
				if (err){
					console.log(err);
					callback(false);
					return;
				}

				self.updateColors(db,function(image){
					callback(image);
				});
			});
		});

	});
}

PokeImage.prototype.updateColors = function(db,callback){
	var self = this;

	db.collection("colors").findOne({name:this.keyword},function(err,doc){
		if (err){
			console.log(err);
			callback(false);
			return;
		}

		if (!doc){
			doc = {name:self.keyword};
		}

		for (i=0;i<self.colors.length;i++){
			if (!doc[self.colors[i].hex]){
				doc[self.colors[i].hex] = 0;
			}

			doc[self.colors[i].hex] += self.colors[i].density;
		}

		db.collection("colors").update({name:self.keyword},doc,{upsert:true});

		callback(self);
	});
}

PokeImage.prototype.tag = function(callback){

	if (!this.url){
		return "First have a url before tagging";
	}

	console.log("Analyzing "+this.url);
	var cur_url = this.url;
	var self = this;

	request.post({
		url:"https://api.clarifai.com/v1/token",
		form:{
			"grant_type":"client_credentials",
			"client_id": "LtBAeH3T5UdE9uTYaiehZObqh1PZehqGOEwr064G",
			"client_secret":"BddH4Yro_9WsszRNkfyVLPNCGdcKk7Ljiooxbzm5"
		}
	},function(err,res,body){

		if (err){
			return err;
		}

		var token_data = JSON.parse(body);
		token = token_data.access_token;

		request.get({
			url:"http://api.clarifai.com/v1/tag?url="+cur_url,
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){
			if (err){
				return err;
			}

			var data = JSON.parse(body);

			if (data.results && data.results[0].result && data.results[0].result.tag && data.results[0].result.tag.classes){
				self.tags = data.results[0].result.tag.classes;
			}

			callback(self);
/*			MongoClient.connect(monogo_url,function(err,db){
				updateImage(self.url,{tags:self.tags},db,function(){
					callback(self)
				});
			});*/

		});
	});
};

module.exports = PokeImage;
