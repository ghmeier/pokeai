var PokeImage = require("./Gif");
var async = require("async");
var Pokedex = require("pokedex-promise-v2");
var request = require("request");
var MongoClient = require("mongodb").MongoClient;
var P = new Pokedex();

var mongo_url = "mongodb://heroku_qs4vjvqc:gsnlshm4n071a1jplocgesdd3q@ds011810.mlab.com:11810/heroku_qs4vjvqc";

function GifList(){

	this.gifs = new Array();


};

function GifList(tag,start,limit,do_done){
	this.gifs = new Array();
	var self = this;
	var callback = do_done;


};

GifList.getImageList = function(q,list,max,classifier,callback){
    var self = this;
    P.getPokemonByName(q.toLowerCase()).then(function(response){
    	console.log("Validated Pokemon Name");
        self.getPokeImageCount(q,function(count){
            var num = count || 1;
        	return GifList.getValidatedImageList(q,list,num,num+max,classifier,function(images){
        		callback(images);
        	});
        });
	}).catch(function(error){
		return {error:true,message:"No pokemon found called "+q,data:error};
	});
}

GifList.getValidatedImageList = function(q,list,num,max,classifier,callback){
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
        	console.log("Error with google.");
        	return list
        }

        for (i=0;i<data["items"].length;i++){
        	list.push(data["items"][i]);

            var pokeimage = new PokeImage(null,data["items"][i]["link"],params.q);

            pokeimage.tag(function(image){
                PokeImage.insertImage(image,function(){
                    image.classify(classifier);
                });
            });
        }

        if (num + data.length < max){
            return GifList.getValidatedImageList(params.q,list,num+data["items"].length,max,classifier,function(images){
           		callback(images);
           	});
        }else{
            self.setPokeImageCount(params.q,num+data["items"].length)

            callback(list);
       	}

    });
}

GifList.listTags = function(start,limit,callback){
	var tags = new Array();


};

GifList.searchByTag = function(query,start,limit,callback){
	var end_cb = callback;

}

GifList.getPokeImageCount = function(q,callback){
    MongoClient.connect(mongo_url,function(err,db){
        if (err){
            console.log(err)
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

GifList.setPokeImageCount = function(name,val,callback){
    MongoClient.connect(mongo_url,function(err,db){
        var col = db.collection("counts");

        col.update({"name":name},{"name":name,"count":val},{upsert:true});

        if (callback){
            callback();
        }
    });

}

GifList.insertPokeImageCount = function(name,val,callback){
    MongoClient.connect(mongo_url,function(err,db){
        db.collection("counts").insertOne({
            "name":name,
            "count":val
        },function(err,result){
            if (err){
                console.log(err);
                callback();
                db.close();
                return;
            }

            callback(result);
            db.close();
        })
    });
}

GifList.LevDist = function(s,len_s, t, len_t){
	var cost = 0;

  /* base case: empty strings */
  if (len_s == 0) return len_t;
  if (len_t == 0) return len_s;

  /* test if last characters of the strings match */
  if (s.charAt(len_s-1) == t.charAt(len_t-1)){
     cost = 0;
  }else{
      cost = 1;
  }
  /* return minimum of delete char from s, delete char from t, and delete char from both */
  return GifList.minimum(GifList.LevDist(s, len_s - 1, t, len_t    ) + 1,
                 GifList.LevDist(s, len_s    , t, len_t - 1) + 1,
                 GifList.LevDist(s, len_s - 1, t, len_t - 1) + cost);
}

GifList.minimum = function(one,two,three){
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

module.exports = GifList;
