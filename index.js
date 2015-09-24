var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var url = require("url");
var moment = require('moment');
var archiver = require('./archive.js');

var days_of_week = moment.weekdays(),
	counts;

function handler(req, res) {
  var uri = url.parse(req.url).pathname,
  	filename;
  	if (uri === '/style.css') {
  		filename = '/style.css';
  	} else if (uri === '/script.js') {
  		filename = '/script.js';
  	} else {
  		filename = '/index.html';
  	}
  fs.readFile(__dirname + filename,
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}

var day_matches = {
	'sunday': 0,
	'monday': 1,
	'tuesday': 2,
	'wednesday': 3,
	'wensday': 3,
	'thursday': 4,
	'friday': 5,
	'saturday': 6
};

var today = new Date().getDay();

var counts = freshCounts();

function freshCounts() {
	return days_of_week.map(function() {
		return 0;
	});
}

function filter(text) {
	var text = text.toLowerCase(),
		smallestIndex = false;
	for (var i in day_matches) {
		var index = text.indexOf(i);
		if (index !== -1) {
			// we look for earlier uses of day-words, a dumb way to deal with "Today feels more like a Friday than a Thursday."
			if (smallestIndex === false || (index < smallestIndex.index)) {
				smallestIndex = {
					index: index,
					day: day_matches[i]
				};
			}
		}
	}
	return smallestIndex ? smallestIndex.day : false;
}

function increment_counts(day) {
	var currentDay = new Date().getDay();
	if (currentDay !== today) {
		today = currentDay;
		counts = freshCounts();
	}
	counts[day]++;
	archiver.record(counts);
}

var Twit = require('twit')

var config = require(__dirname + '/config.json');

var T = new Twit(config);

archiver.get_current(null, function(current) {
	if (current) {
		counts = days_of_week.map(function(day) {
			return current[day];
		});
	}
	app.listen(4242);

	var stream = T.stream('statuses/filter', { 
		track: [
			'today feels like'
		] 
	});

	io.on('connection', function (socket) {
		io.emit('feelslike', counts);
	});

	stream.on('tweet', function (tweet) {
		var day;
		if ((day = filter(tweet.text)) !== false) {
			increment_counts(day);
			console.log(tweet.text, 'day:', day);
			io.emit('feelslike', counts);
		}
	});

});
