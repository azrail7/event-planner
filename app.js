//Required packages.
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require("multer");
const qrcode = require("qrcode");
const fs = require("fs");

//Import mongoose schemas from models folder.
const User = require("./models/user");
const Event = require("./models/event");
const Booking = require("./models/booking");

const app = express();

app.use(express.static( __dirname + "/public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
  })
);

//Define storage for the upload images.
const storage = multer.diskStorage({
  //Destination for files.
  destination: function (req, file, callback) {
    callback(null, "./public/uploads/images");
  },
  //Add back the extension.
  filename: function (req, file, callback) {
    callback(null, new Date().toISOString().replace(/:/g,'-') + "-" + file.originalname);
  }
});

//Upload parameters for multer.
const upload = multer({ storage: storage });

//Set up passport and start using it for authentecation.
app.use(passport.initialize());
//Use passport to set up our session.
app.use(passport.session());

//Connect to mongodb base, specify the url of our db locally.
mongoose.connect(process.env.DB_CONNECTION,
  { useNewUrlParser: true, useUnifiedTopology: true },
  () => console.log("Connected to DB.")
);
mongoose.set("useCreateIndex", true);

//Current loged in username in our web site.
var thisUsername = "";

//Set up a local login strategy.
passport.use(User.createStrategy());

//Serialize and deserialize our user, not only for local machine.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//Create Google Strategy.
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/user",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

//Create root/home route, render the proper page.
app.get("/", (req, res) => {
  res.render("home");
});

//Route for Google Auth button, when clicked.
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  })
);

//Authenticate user with Google account.
app.get("/auth/google/user",
  passport.authenticate("google", {
    failureRedirect: "/"
  }),
  function(req, res) {
    // Successful authentication, redirect to user.ejs page.
    res.redirect("/user");
  });

//Register route.
app.get("/register", function(req, res) {
  res.render("register", { msg: "" });
});

//If user log in, render user.ejs route.
app.get("/user", function(req, res) {
  //If user is authenticated then show the user.ejs page.
  if (req.isAuthenticated()) {
    Event.find({}, function(err, events) {
      res.render("user", {
        events: events
      });
    });
  } else {
    //If the user is not authenticated redirect to home.ejs page to start over.
    res.redirect("/");
  }
});


app.get("/my_bookings", (req, res) => {

  Booking.find({ username: thisUsername }, (err, bookings) => {
    res.render("my_bookings",
    { bookings: bookings, qr_code_label: "", src: "" });
  });
});

app.post("/my_bookings", (req, res) => {

  const qr_code = req.body.qrCodeBtn;

  if (qr_code.length === 0) { console.log("Empty data to QR code!"); }

  qrcode.toDataURL(qr_code, (err, src) => {
    if (err){
      console.log(err);
    }else{
      Booking.find({ _id: qr_code }, (err, bookings) => {
        res.render("my_bookings",
        { bookings: bookings, qr_code_label: "Ticket's QR Code:", src: src });
      });
    }
  });

});

//Log-out route handler.
app.get("/logout", function(req, res) {
  //Log out the user and redirect to home route.
  req.logout();
  res.redirect("/");
});

//If admin log in, render admin.ejs route.
app.get("/admin", function(req, res) {
  //If admin is authenticated then show the admin.ejs page.
  if (req.isAuthenticated()) {
    Event.find({}, function(err, events) {
      res.render("admin", {
        events: events
      });
    });
  } else {
    //If the user is not authenticated redirect to home.ejs page to start over.
    res.redirect("/");
  }
});

//If ticket collector log in, render collector.ejs route.
app.get("/collector", (req, res) => {

  if (req.isAuthenticated()) {

      res.render("collector",
      {
        label_fname: "", label_lname: "",
        label_phone: "", label_image: "",
        bookingFistName: "",
        bookingLastName: "",
        bookingPhone: "",
        bookingImage: "uploads/images/image_scan.png",
        width: "250", height: "250" });
  } else {
    //If the user is not authenticated redirect to home.ejs page to start over.
    res.redirect("/");
  }
});

//Take the booking ID from ticket collector's form and delete it.
app.post("/collector", (req, res) => {

  const deletedItemId = req.body.bookingID;

  Booking.findByIdAndDelete(deletedItemId, (err) => {
    if (!err) {
      console.log("Successfully deleted");
      res.redirect("/collector");
    } else {
      console.log(err);
    }
  });
});

app.post("/scan_qr", (req, res) => {

  const booking_id = req.body.qr_code;

  Booking.findOne( { _id: booking_id }, (err, thisBooking) => {

    res.render("collector",
    {
      label_fname: "Fist Name:",
      label_lname: "Last Name:",
      label_phone: "Phone",
      label_image: "Image:",
      bookingFistName: thisBooking.firstName,
      bookingLastName: thisBooking.lastName,
      bookingPhone: thisBooking.phone,
      bookingImage: "uploads/images/" + thisBooking.img,
      width: "100", height: "100" });
  });

});

// Register form handler.
app.post("/register", function(req, res) {

  User.register({
      username: req.body.username,
    },
    req.body.password,
    function(err, user) {
      if (err) {
        //If error happens redirect to the register page to try again.
        console.log(err);
        res.render("register", { msg: "Error" });
      } else {
        //If no errors.
        //Authenticate the new user locally with passport module.
        passport.authenticate("local")(req, res, function() {
          res.render("register", { msg: "Success" });
        });
      }
    }
  );
});

// Login form handler.
app.post("/", function(req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  //1st param: the new user with credentials that types in login form.
  req.login(user, function(err) {
    if (err) {
      //If an error happens print it in cmd.
      console.log(err);
    } else {
      //If user exists authenticate and show the proper page for each role.
      passport.authenticate("local")(req, res, function() {
        if (req.body.username === "admin@unipi.gr") {
          res.redirect("/admin");
        } else if (req.body.username === "collector@unipi.gr") {
          res.redirect("/collector");
        } else {
          thisUsername = user.username;
          res.redirect("/user");
        }
      });
    }
  });
});

//Admin route, create a new event page.
app.get("/create_event", function(req, res) {
  res.render("create_event");
});

//Create new event route, insert data from the form.
app.post("/create_event", function(req, res) {

  const event = new Event({
    title: req.body.ev_title,
    description: req.body.ev_desc,
    date: req.body.ev_date,
    capacity: req.body.ev_cap,
    price: req.body.ev_price
  });

  event.save(function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/admin");
    }
  });
});

//Update an event by admin only.
app.get("/update/:eventTitle", function(req, res) {

  const requestedTitle = _.lowerCase(req.params.eventTitle);

  Event.find({}, function(err, events) {

    events.forEach(function(event) {

      const storedTitle = _.lowerCase(event.title);

      if (storedTitle === requestedTitle) {

        res.render("update", {
          id: event._id,
          title: event.title,
          description: event.description,
          date: event.date,
          capacity: event.capacity,
          price: event.price
        });
      }
    });
  });
});

//Take the data from Update form and change the event elements.
app.post("/update", function(req, res) {

  const thisID = req.body.updateBtn;

  Event.updateOne({
      _id: thisID
    }, {
      title: req.body.new_title,
      description: req.body.new_desc,
      date: req.body.new_date,
      capacity: req.body.new_cap,
      price: req.body.new_price
    },
    function(err) {
      if (err) {
        console.log(err);
      } else {
        res.redirect("/admin");
      }
    });
});

//Delete an event by admin only.
app.post("/delete", function(req, res) {

  const deletedItemId = req.body.deleteBtn;

  Event.findByIdAndDelete(deletedItemId, function(err) {
    if (!err) {
      console.log("Successfully deleted");
      res.redirect("/admin");
    } else {
      console.log(err);
    }
  });
});

//User cancels a ticket, if booking already exists.
app.post("/cancel", (req, res) => {

  const cancelBooking = req.body.cancelBtn;

  //Find this booking in our db.
  Booking.findOne( { eventTitle: cancelBooking }, (err, thisBooking) => {
    if (!err){
      //Delete current booking.
      Booking.deleteOne( { eventTitle: cancelBooking }, (err) => {
        if (!err){
          console.log("Successfully deleted");
          res.redirect("/my_bookings");
        }else{
          console.log(err);
        }
      });
      //Delete the local image that user uploads with this booking.
      const path = "./public/uploads/images/" + thisBooking.img;
      fs.unlink(path, (err) => {
        if (err) { console.log(err); }
      });
    }else{
      console.log(err);
    }
  });

  //Update the event capacity, increase by one cause user cancel it.
  Event.findOne( { title: cancelBooking }, (err, thisEvent) => {
    if (!err) {
      Event.updateOne( { title: cancelBooking },
         { capacity: thisEvent.capacity + 1 },
         (err) => {
           if (err) {
             console.log(err);
           } else {
             console.log("Succesfully updated the document.");
           }
      });
    } else {
      console.log(err);
    }
  });
});

//Join an event by the user.
app.post("/join", upload.single("image"), function(req, res) {

  //Create a new booking document.
  const booking = new Booking({
    eventTitle: req.body.eventTitle,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    username: thisUsername,
    phone: req.body.phone,
    img: req.file.filename
  });

  //Update this event and reduce capacity by one, cause a user join it.
  const thisCapacity = req.body.joinBtn;

  Event.updateOne({
    title: req.body.eventTitle
  }, {
    capacity: thisCapacity - 1
  }, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Succesfully updated the document.");
    }
  });

  //Insert the new booking record into the db.
  booking.save(function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/user");
    }
  });
});

app.get("/events/:eventTitle", function(req, res) {

  const requestedTitle = _.lowerCase(req.params.eventTitle);

  Event.find({}, function(err, events) {

    events.forEach(function(event) {

      const storedTitle = _.lowerCase(event.title);

      if (storedTitle === requestedTitle) {
        res.render("events", {
          title: event.title,
          description: event.description,
          date: event.date.toString().substr(0, 15),
          capacity: event.capacity,
          price: event.price,
          email: thisUsername
        });
      }
    });
  });
});

var port  = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server started on port 3000");
});
