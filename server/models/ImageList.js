var PokeImage = require("./PokeImage");
var async = require("async");
var secrets = require("../config/secrets.js");
var Pokedex = require("pokedex-promise-v2");
var request = require("request");
var MongoClient = require("mongodb").MongoClient;
var P = new Pokedex();

function ImageList(){
	this.gifs = [];
};

ImageList.getTopColors = function(callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		if (err){
			callback();
			return;
		}

		db.collection("colors").find({}).toArray(function(err,docs){
			var top_colors = {};
			var i;
			for (i=0;i<docs.length;i++){
				var keys = Object.keys(docs[i]);

				for (var j=0;j<keys.length;j++){
					var cur = keys[j];
					if (cur == "name" || cur == "_id"){
						continue;
					}

					if (!top_colors[cur]){
						top_colors[cur] = {value:0,type:cur};
					}

					top_colors[cur].value += docs[i][cur];
				}
			}

			var k = Object.keys(top_colors);
			var sorted = [];
			for (i=0;i<k.length;i++){
				sorted.push([top_colors[k[i]].type,top_colors[k[i]].value]);
			}

			sorted.sort(function (a, b) {
				return a[1] - b[1];
			});

			callback(sorted);
		});
	});
}

ImageList.getImageList = function(q,list,max,classifier,callback){
	var self = this;
	P.getPokemonByName(q.toLowerCase()).then(function(){
		self.getPokeImageCount(q,function(count){
			var num = count || 1;
			return ImageList.getValidatedImageList(q,list,num,num+max,classifier,function(images){
				callback(images);
			});
		});
	}).catch(function(error){
		callback({error:true,message:"No pokemon found called "+q,data:error});
	});
}

ImageList.getValidatedImageList = function(q,list,num,max,classifier,callback){
	var params = {};
	params.q = q.toLowerCase(); // search text
	params.start = num;
	params.searchType = "image";
	params.key = "AIzaSyCQoSJD2HCo0GURiQCUGWJdGxRZ_PqMbh0";
	params.cx = "002048660896144254022:jshmqe2fopw";
	params.fields = "items(displayLink,formattedUrl,htmlFormattedUrl,image(height,width),link)";

	var self=  this;

	var url = "https://www.googleapis.com/customsearch/v1?q="+params.q+
		"&cx="+params.cx+
		"&searchType="+params.searchType+
		"&fields="+params.fields+
		"&key="+params.key+
		"&start="+params.start;

	request(url,function(err,response,body){
		if (err){
			return list;
		}

		var data = JSON.parse(body);

		if (data.error){
			return list
		}

		for (var i=0;i<data["items"].length;i++){
			list.push(data["items"][i]);

			var image = new PokeImage(null,data["items"][i]["link"],params.q);
			image.tag(self._tagCallback);
		}

		if (num + data["items"].length < max){
			return ImageList.getValidatedImageList(params.q,list,num+data["items"].length,max,classifier,function(images){
				callback(images);
			});
		}else{
			self.setPokeImageCount(params.q,num+data["items"].length)

			callback(list);
		}

	});
}

ImageList.prototype._tagCallback = function (image) {
	image.color(this._colorCallback);
}

ImageList.prototype._colorCallback = function(image){
	PokeImage.insertImage(image,function(){
		image.classify(classifier);
	});
}

ImageList.updateAllColor = function(classifier,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){

		db.collection("images").find({"$or":[{tags:{"$size":0}},{colors:{"$size":0}}]}).toArray(function(err,docs){
			ImageList.updateTags(docs,classifier,function(updated){
				callback(updated);
			});
		});
	});
}

ImageList.updateTags = function(list,classifier,callback){
	if (!list || list.length === 0){
		callback();
		return;
	}

	var splicesize = 10;
	if (list.length < splicesize){
		splicesize = list.length;
	}

	var front_list = list.splice(0,splicesize);

	var urls = [];
	for (var i=0;i<front_list.length;i++){
		var cur_url = front_list[i]["url"];
		if (cur_url){
			urls.push(cur_url);
		}
	}

	ImageList.multiTag(urls,front_list,classifier,function(updated){

		if (list.length > 0){
			ImageList.updateTags(list,classifier,function(u){
				callback(u);
			});
		}else{
			callback(updated);
		}
	 });
}

ImageList.multiTag = function(urls,list,classifier,callback){

	var self = this;

	PokeImage.getClarifaiToken(function(token){

		request.post({
			url:"https://api.clarifai.com/v1/tag",
			form:"url="+urls.join("&url="),
			headers: {
				'Authorization':'Bearer '+token
			}
		},function(err,res,body){
			var data = JSON.parse(body);
			if (!data.results){
				callback(self);
				return;
			}
			var raw = data.results;
			for (var i=0;i<raw.length;i++){
				if (raw[i].result.tag){
					var cur = list[i];
					cur["tags"] = raw[i].result.tag.classes;
					var image = new PokeImage("",cur["url"],cur["keyword"],cur["tags"],cur["colors"]);
					image.classify(classifier);
					image.updateTags();
				}
			}

			callback(list);
		});

	});
}

ImageList.getPokeImageCount = function(q,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		if (err){
			callback(0);
		}

		db.collection("counts").findOne({name:q},{},function(err,doc){
			var final_count = 0;

			if (doc){
				final_count = doc.count;
			}

			callback(final_count);

			db.close();
		});
	});
}

ImageList.setPokeImageCount = function(name,val,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		var col = db.collection("counts");

		col.update({"name":name},{"name":name,"count":val},{upsert:true});

		if (callback){
			callback();
		}
	});

}

ImageList.insertPokeImageCount = function(name,val,callback){
	MongoClient.connect(secrets.mongo_url,function(err,db){
		db.collection("counts").insertOne({
			"name":name,
			"count":val
		},function(err,result){
			if (err){
				callback();
				db.close();
				return;
			}

			callback(result);
			db.close();
		})
	});
}

ImageList.LevDist = function(s,len_s, t, len_t){
	var cost;

	/* base case: empty strings */
	if (len_s == 0) {
		return len_t;
	}
	if (len_t == 0) {
		return len_s;
	}

	/* test if last characters of the strings match */
	if (s.charAt(len_s-1) == t.charAt(len_t-1)){
		cost = 0;
	}else{
		cost = 1;
	}
	/* return minimum of delete char from s, delete char from t, and delete char from both */
	return ImageList.minimum(ImageList.LevDist(s, len_s - 1, t, len_t) + 1,
		   ImageList.LevDist(s, len_s, t, len_t - 1) + 1,
		   ImageList.LevDist(s, len_s - 1, t, len_t - 1) + cost);
}

ImageList.minimum = function(one,two,three){
	if (one<=two && one <= three){
		return one;
	}

	if (two <= one && two <= three){
		return two;
	}

	if (three <= one && three <= two){
		return three;
	}

	return one;
}

module.exports = ImageList;
