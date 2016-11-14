var secrets = require("./config/secrets");
var PokeImage = require("./models/PokeImage");
var ImageList = require("./models/ImageList");
var request = require("request");

module.exports = function(app,classifier){

	app.get("/categorize",function(req,res){
		var url = req.query.url;

		var image = new PokeImage(null,url,null,null,null);

		image.guessPokemon(classifier,function(pokemon){
			res.json({url:pokemon.url,pokemon:pokemon.keyword});
		});
	});

	app.get("/find",function(req,res){
		var query = req.query.q;

		PokeImage.getImageByKeyword(query,function(image){
			res.json(image);
		});
	})

	app.get("/search",function(req,res){
		//ended with psyduck
		var query = req.query.q;
		var limit = parseInt(req.query.limit) || 10;

		ImageList.getImageList(query,new Array(),limit,classifier,function(list){
			res.json({data:list});
		});
	});

	app.get("/update_tag",function(req,res){

		ImageList.updateAllColor(classifier,function(){
			res.json({success:true});
		});
	});

	app.get("/colors/top",function(req,res){
		ImageList.getTopColors(function(colors){
			res.json({data:colors});
		});
	});

	app.get("/images",function(req,res){
		res.json({});
	});

	app.get("*",function(req,res){
		res.render("index.html");
	});


};
