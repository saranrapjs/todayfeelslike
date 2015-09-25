var fs = require('fs');
var url = require("url");
var moment = require('moment');
var archiver = require('./archive.js');
var config = require(__dirname + '/config.json');
var filter = require('./filter.js');

var days_of_week = moment.weekdays(),
	counts = freshCounts(),
	the_archives = [],
	update_frequency = 1000 * 60 * 2;

var today = new Date().getDay();

function freshCounts() {
	return days_of_week.map(function() {
		return 0;
	});
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

function populate_archives(rows) {
	the_archives = rows.slice(0, 5).map(function(row) {
		var greatest_virtual_day, // sunday default?
			greatest_virtual_day_count = 0;
		days_of_week.forEach(function(day, n) {
			if (row[day] > greatest_virtual_day_count) {
				greatest_virtual_day_count = row[day];
				greatest_virtual_day = day;
			}
		});
		row.max = greatest_virtual_day;
		return row;
	});
}

function render_tpl() {
	var tpl = fs.readFileSync(__dirname + '/template.html').toString(),
		today = moment(),
		today_formatted = today.format('MM-DD-YYYY');

	tpl = tpl.replace('data-chart=""', 'data-chart="'+ JSON.stringify(counts) + '"');

	tpl = tpl.replace('<ul class="statistics"></ul>', '<ul class="statistics"><li>' + 
		the_archives
			.filter(function(day) {
				return day.Date !== today_formatted;
			})
			.map(function(day) {
				return '...on ' + day['Day of Week'] + ' (' + day.Date + ') it tended to feel like ' + day.max;
			})
			.join('</li><li>')
	+ '</li></ul>');

	tpl = tpl.replace('data-nextrefresh=""', 'data-nextrefresh="' + moment().add(update_frequency, 'milliseconds').toDate() + '"');

	tpl = tpl.replace('<span class="generated-time"></span>', '<span class="generated-time">' + today.format("dddd, MMMM Do YYYY, h:mm:ss a") + '</span>');

	fs.writeFileSync(__dirname + '/index.html', tpl);
}

var Twit = require('twit')

var T = new Twit(config);

archiver
	.read(populate_archives)
	.get_current(function(current) {
		if (current) {
			counts = days_of_week.map(function(day) {
				return current[day];
			});
		}

		var stream = T.stream('statuses/filter', { 
			track: [
				'today feels like'
			] 
		});

		stream.on('tweet', function (tweet) {
			var day;
			if ((day = filter(tweet.text)) !== false) {
				increment_counts(day);
				console.log(tweet.text, 'day:', day);
			}
		});

		render_tpl();
		setInterval(render_tpl, update_frequency);
	});
