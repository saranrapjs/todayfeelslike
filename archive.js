var csv = require('csv'),
	moment = require('moment'),
	fs = require('fs'),
	date_format = 'MM-DD-YYYY',
	filename = 'history.csv';

var weekdays = moment.weekdays();

function get_csv(cb) {
	var sample = fs.createReadStream(filename),
		parser = csv.parse({ columns: true }),
		rows = [];

	parser.on('readable', function() {
		while(record = parser.read()){
			weekdays.forEach(function(day, n) {
				if (record[day]) {
					record[day] = parseInt(record[day]);
				} else {
					record[day] = 0;
				}
			});
			rows.push(record);
		}
	});

	parser.on('finish', function() {
		if (cb) cb(rows);
	})
	sample.pipe(parser);
	return {
		get_current: function(current_cb) {
			parser.on('finish', function() {
				var current = get_current(rows);
				if (current_cb) {
					current_cb(current);
				}
			});
		}
	}
}

function write_csv(rows) {
	var file = fs.createWriteStream(filename),
		stringifier = csv.stringify({ header: true });

	stringifier.pipe(file);

	// this is stupid
	rows.forEach(function(row) {
		stringifier.write(row);
	});
	stringifier.end();
}

function record_rows(rows, d) {
	d = d || moment();
	var data = {
		'Date': d.format(date_format),
		'Day of Week': d.format('dddd')
	};
	weekdays.forEach(function(day, n) {
		data[day] = rows[n]
	});

	write_row(data);
}

function get_current(rows) {
	var d = moment(),
		compare_date = d.format(date_format);
	for (var i = 0; i < rows.length; i++) {
		if (rows[i].Date === compare_date) {
			return rows[i];
		}
	};
	return false;
}

function write_row(data) {
	var resulting_csv,
		row_found = false;
	get_csv(function(the_csv) {
		resulting_csv = the_csv.map(function(row) {
			if (row.Date === data.Date) {
				row_found = true;
				return data;
			} else {
				return row;
			}
		});
		if (row_found === false) {
			resulting_csv.unshift(data);
		}
		write_csv(resulting_csv);
	});
}

module.exports = {
	record: record_rows,
	read: get_csv
};