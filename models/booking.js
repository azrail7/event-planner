const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  eventTitle: String,
  firstName: String,
  lastName: String,
  username: String,
  phone: String,
  img: String
});

module.exports = new mongoose.model("Booking", bookingSchema);
