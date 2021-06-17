const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  capacity: Number,
  price: Number
});

module.exports = new mongoose.model("Event", eventSchema);
