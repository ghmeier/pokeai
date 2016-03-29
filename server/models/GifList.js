var Firebase = require("firebase");
var Gif = require("./Gif");
var async = require("async");
var fb_root = new Firebase("https://pokeai.firebaseio.com");

function GifList(){
	var gifs = fb_root.child("gifs");
	this.gifs = new Array();

	gifs.once("value",function(snap){
		var data = snap.val();
		var keys = Object.keys(data);

		for (id in keys){
			var current = data[keys[id]];

			this.gifs.push(new Gif(current.url,current.id,current.tags));

		}

	});
};

function GifList(tag,start,limit,do_done){
	var gif_ref = fb_root.child("tags").child(tag);
	this.gifs = new Array();
	var self = this;
	var callback = do_done;
	gif_ref.once("value",function(snap){
		var data = snap.val();
		var keys = Object.keys(data);
		var list = [];

		async.forEachOf(keys,function(current,key,callback){
			Gif.getGifById(current,function(gif){
				list.push(gif);
				callback();
			});

		},function(err){
			if (err){
				console.log(err.message);
			}

			do_done(list.slice(start,start+limit));
		});
	});

};

GifList.listTags = function(start,limit,callback){
	var tags = new Array();
	var tag_ref = fb_root.child("tags");
	tag_ref.once("value",function(snap){
		var data = snap.val();

		if (data){
			var keys = Object.keys(data);
			console.log(keys[start] + " " + keys[start+limit]);

			callback(keys.slice(start,start+limit));
		}else{
			callback(null);
		}
	});

};

GifList.searchByTag = function(query,start,limit,callback){
	var tag_ref = fb_root.child("tags");
	var end_cb = callback;
	tag_ref.once("value",function(snap){
		var data = snap.val();
		if (data){
			var keys = Object.keys(data);
			var relevence = {};
			var min_rel = 100;
			for (i=0;i<keys.length;i++){
				var gif_rel = GifList.LevDist(query,query.length,keys[i],keys[i].length);
				if (!relevence[gif_rel]){
					relevence[gif_rel] = [];
				}

				if (gif_rel < min_rel){
					min_rel = gif_rel;
				}
				relevence[gif_rel].push(keys[i]);
			}
			var gifs = [];
			// console.log(relevence[min_rel]);
			async.forEachOf(relevence[min_rel],function(current,key,cb){
				if (gifs.length < limit){
					var list = new GifList(current,start,limit - gifs.length,function(list){
						gifs = gifs.concat(list);
						cb();
					});
				}else{
					cb();
				}

			},function(err){
				if (err){
					console.log(err.message);
				}

				end_cb({tags:relevence[min_rel],list:gifs});
			});
			//callback(relevence[min_rel]);
		}else{
			end_cb(null);
		}
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
