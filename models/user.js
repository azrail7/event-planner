const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");

//User schema for local db.
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String
});

//Use for salt & hash our passwords and to save our users to db.
userSchema.plugin(passportLocalMongoose);
//This is for Google Auth method.
userSchema.plugin(findOrCreate);

module.exports = new mongoose.model("User", userSchema);
