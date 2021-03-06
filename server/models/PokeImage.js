var MongoClient = require("mongodb").MongoClient;
var secrets = require("../config/secrets.js");
var ObjectId = require("mongodb").ObjectID;
var request = require("request");
var bayes = require("bayes");
var fs = require("fs");
var Pokedex = require("pokedex-promise-v2");
var P = new Pokedex();

var findImage = function(query,db,callback){
	db.collection("images").find(query,{}).toArray(function(err,docs){
		if (err){
			callback(false);
			return;
		}

		if (!docs){
			callback(null);
			return;
		}

		var pos = Math.floor(Math.random()*docs.length);
		var doc = docs[pos];

		return new PokeImage(doc._id,doc.url,doc.keyword,doc.tags,doc.colors,function(image){
			db.close();
			callback(image);
		});
	});

}

var updateImage = function(url,data,db){
	var col = db.collection("images");

	col.updateOne({url:url},{$set:data});
	db.close();
}

function PokeImage(id,url,keyword,tags,colors,callback){
	this.url = url || "";
	this.keyword = keyword;
	this.tags=tags || [];
	this.colors = colors || []
	if (callback && typeof(callback) == 'function'){
		callback(this);
	}
}

PokeImage.getImageByUrl = function(url,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		if (err){
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
	P.getPokemonByName(keyword.toLowerCase()).then(function(){
		MongoClient.connect(secrets.mongo_url,function(err,db){
			if (err){
				callback(false);
				return;
			}

			findImage({keyword:keyword,tags:{"$not":{"$size":0}}},db,function(image){
				if (!image){
					callback(null);
					return;
				}

				callback(image);
			});
		});
	}).catch(function(error){
		return {error:true,message:"No pokemon found called "+keyword,data:error};
	});
}

var insertImage = function(url,keyword,tags,colors,db,callback){
	db.collection("images").insertOne({
		"url":url,
		"keyword":keyword,
		"tags":tags,
		"colors":colors
	}, function (err){
		if (err){
			callback(false);
		}

		callback(true);
		db.close();
	});
};

PokeImage.insertImage = function(image,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		if (err){
			callback(false);
		}

		insertImage(image.url,image.keyword,image.tags,image.colors,db,function(success){
			callback(success);
		})

	});
}

PokeImage.prototype.classify = function(classifier){
	var self = this;

	classifier.learn(self.tags.join(","),self.keyword);
	fs.writeFileSync("classifier.json",classifier.toJson());

}

PokeImage.prototype.guessPokemon = function(classifier,callback){
	var self = this;

		self.tag(function(img){
			var keyword = img.categorize(classifier);
			img.keyword = keyword;
			callback(img);
		});
}

PokeImage.prototype.categorize = function(classifier){
	return classifier.categorize(this.tags.join(", "));
}

PokeImage.prototype.color = function(callback){
	if (!this.url){
		return "image must have a url";
	}

	var cur_url = this.url;
	var match      = cur_url.match(/[\.](png|jpg)/gi);
	var lastIndex  = -1;
	if (match){
		lastIndex = cur_url.lastIndexOf(match[match.length-1]);
	}

	if (lastIndex >= 0){
		cur_url = cur_url.substring(0,lastIndex+1);
	}
	var self = this;

	PokeImage.getClarifaiToken(function(token){

		request.get({
			url:"http://api.clarifai.com/v1/color?url="+cur_url,
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){
			var data = JSON.parse(body);
			if (!data.results){
				callback(self);
				return;
			}
			var raw = data.results[0].colors;

			for (var i=0;i<raw.length;i++){
				self.colors.push({hex:raw[i].hex,density:raw[i].density});
			}

			MongoClient.connect(secrets.mongo_url,function(err,db){
				if (err){
					callback(self);
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
			callback(self);
			return;
		}

		if (!doc){
			doc = {name:self.keyword};
		}

		for (var i=0;i<self.colors.length;i++){
			if (!doc[self.colors[i].hex]){
				doc[self.colors[i].hex] = 0;
			}

			doc[self.colors[i].hex] += self.colors[i].density;
		}

		db.collection("colors").update({name:self.keyword},doc,{upsert:true});

		callback(self);
	});
}

PokeImage.prototype.updateTags = function(){
	var self = this;

	MongoClient.connect(secrets.mongo_url,function(err,db){
		if (err){
			return;
		}

		db.collection("images").findOne({url:this.url},function(err){
			if (err){
				return;
			}

			db.collection("images").update({url:self.url},self,{upsert:true});
		});
	});
}

PokeImage.getClarifaiToken = function(callback){
	request.post({
		url:"https://api.clarifai.com/v1/token",
		form:{
			"grant_type":"client_credentials",
			"client_id": "KvWTcDDBcD4iDhzazoccxjduAZji92Y7S86Jb1uG",
			"client_secret":"D21wcrABg2siHeIAhdQcsmb3YC13kZO_gCjCG9Cl"
		}
	},function(err,res,body){

		if (err){
			return err;
		}

		var token = JSON.parse(body).access_token;

		callback(token);
	});
}

PokeImage.prototype.tag = function(callback){

	if (!this.url){
		return "First have a url before tagging";
	}

	var cur_url = this.url;
	var self = this;

	PokeImage.getClarifaiToken(function(token){

		request.get({
			url:"http://api.clarifai.com/v1/tag?url="+cur_url,
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){
			if (err){
				callback(self);
				return err;
			}

			var data = JSON.parse(body);

			if (data.results && data.results[0].result && data.results[0].result.tag && data.results[0].result.tag.classes){
				self.tags = data.results[0].result.tag.classes;
			}

			callback(self);

		});
	});
};

module.exports = PokeImage;
