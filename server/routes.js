var secrets = require("./config/secrets");
var PokeImage = require("./models/Gif");
var ImageList = require("./models/GifList");
var request = require("request");

module.exports = function(app,classifier,passport){

	app.get("/ping",function(req,res){
		res.send("pong");
	});

	app.post("/analyze",function(req,res){
		var max = req.query.num || 1;
		var x = 0,fin = 0, success = 0;
		while (x < max){
			var current = new Gif();
			current.create(function(done){
				done.tag(function(tagged){
					tagged.push(function(up){
						if (++fin >= max){
							res.json({success:success,message:"Tagged "+success+" gifs."});
						}

						if (up.tags){
							success++;
						 //res.json(up);
						}
					});
				});
			});
			x++;
		}			MongoClient.connect(monogo_url,function(err,db){
				updateImage(self.url,{tags:self.tags},db,function(){
					callback(self)
				});
			});
        //res.json({success:false,message:"Tagged "+success+" gifs."});

	});

	app.post("/analyze/url",function(req,res){
		var url = req.query.u;

		if (!url || url == ""){
			res.json({success:false,message:"Must provide url to analyze"});
			return;
		}

		var current = new Gif(url,null,new Array());
		current.tag(function(tagged){
			tagged.push(function(up){
				res.json({success:true,gif:up.url,tags:up.tags});
			});
		});

	});

	app.post("/tags",function(req,res){
		var start = parseInt(req.query.offset) || 0;
		var limit = parseInt(req.query.limit) || 25;

		GifList.listTags(start,limit,function(tags){
			res.json({tags:tags});
		});
	});

	app.post("/tags/:tag",function(req,res){
        var start = parseInt(req.query.offset) || 0;
        var limit = parseInt(req.query.limit) || 25;
		var list = new GifList(req.params.tag,start,limit,function(list){
			res.json({list:list});
		});
	});

	app.post("/tags/:tag/ignore",function(req,res){
		var id = req.query.id;
		var tag = req.params.tag;

		if (!id || id == ""){
			res.json({success:false,message:"Must provide a gif id"});
			return;
		}

		var current = Gif.getGifById(id,function(gif){
			if (!gif || !gif.url || gif.url == ""){
				res.json({success:false,message:"Invalid gif id "+id});
				return;
			}

			gif.ignore(tag,function(removed){
				if (removed){
					res.json({success:true,message:"removed tag"});
					return;
				}

				res.json({success:false,message:"error removing tag"});
			})
		});
	});

	app.get("/categorize",function(req,res){
		var url = req.query.url;

		var image = new PokeImage(null,url,null,null,null);

		image.tag(function(img){
			var keyword = img.categorize(classifier);

			res.json({pokemon:keyword});
		});
	});

	app.get("/search",function(req,res){
		var query = req.query.q;
		var limit = parseInt(req.query.limit) || 10;

		ImageList.getImageList(query,new Array(),limit,classifier,function(list){
			res.json({data:list});
		});
	})

	app.get("/images",function(req,res){
		res.json({});
	});

	app.get("*",function(req,res){
		res.render("index.html");
	});


};
