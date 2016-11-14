var MongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectID;
var request = require("request");

var mongo_url = "mongodb://heroku_qs4vjvqc:gsnlshm4n071a1jplocgesdd3q@ds011810.mlab.com:11810/heroku_qs4vjvqc";

function MongoStreamService(){
    this.stream = [];
    this.updating = false;
}

MongoStreamService.getStreamItem = function(type,update,new_data){
    if (!type){
        return null;
    }

    return {type:type,update:update,new_data:new_data};
}

MongoStreamService.prototype.commit = function(){
    //commit stuff in the stream
    if (this.stream.length < 1 || this.updating){
        return;
    }

    this.updating = true;
    MongoClient.connect(mongo_url,function(db){
        if (err){
            return;
        }

        this.commitDB(db);
    }).bind(this);
}

MongoStreamService.prototype.commitDB = function(db){
    var popped = this.stream.shift();
    var collection_name = popped.type;

    db.collection(collection_name).update({"_id":popped.update._id},popped.update,{upsert:true},function(){
        if (this.stream.length > 0){
            this.commitDB(db);
        }else{
            this.updating = false;
        }
    });
}

MongoStreamService.prototype.push = function(item){
    this.merge(item);
    this.commit()
}

MongoStreamService.prototype.merge = function(item){
    var mp = this.getMergePosition(item.type);

    if (merge_position < 0){
        this.stream.push(item);
        return;
    }

    if (!this.stream[mp].new_data){
        this.stream[mp].new_data = [];
    }

    this.stream[mp].new_data.concat(item.new_data);

    //now we can assume that the update object exists after this
    if (!item.update){
        return;
    }

    var update_keys = Object.keys(item.update);

    for (var i=0;i<update_keys.length;i++){
        var key = update_keys[i];
        var update_item = item.update[key];

        if (this.stream[mp].update[key]){
            update_item = this.getUpdateItem(mp,key,item.update[key]);
        }

        this.stream[mp].update[key] = update_item;
    }

}

MongoStreamService.prototype.getUpdateItem = function (merge_position,key,update_item){
    var new_item = {};
    var cur_keys = Object.keys(this.stream[merge_position].update[key]);

    // copy existing item
    for (i=0;i<cur_keys.length;i++){
        new_item[cur_keys[i]] = this.stream[merge_position].update[key][cur_keys[i]];
    }

    //add new values
    var new_keys = Object.keys(update_item);
    for (i=0;i<new_keys.length;i++){
        if (new_item[new_keys[i]] && typeof new_item[new_keys[i]] === "number"){
            new_item[new_keys[i]] += update_item[new_keys[i]];
        }else{
            new_item[new_keys[i]] = update_item[new_keys[i]];
        }
    }

}

MongoStreamService.prototype.getMergePosition = function(type){
    var merge_position = -1;
    var i = 0 ;
    while (i< this.size() && this.stream[i].type !== type){
        i++;
    }

    if (i < this.size()){
        merge_position = i;
    }

    return merge_position;
}

MongoStreamService.prototype.dump = function(){
    console.log(this.stream);
}

MongoStreamService.prototype.size = function(){
    return this.stream.length;
}

module.exports = MongoStreamService;